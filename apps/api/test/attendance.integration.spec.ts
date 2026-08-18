import { randomUUID } from 'node:crypto';

import { businessDateFromInstant } from '@ph-ponto/shared';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { PasswordService } from '../src/auth/password.service.js';
import { configureApplication } from '../src/bootstrap.js';
import { PrismaService } from '../src/database/prisma.service.js';
import {
  AuditAction,
  CalendarExceptionKind,
  UserRole,
  Weekday,
} from '../src/generated/prisma/client.js';
import { addBusinessDateDays } from '../src/attendance/business-date.js';
import { clearApplicationData } from './database-test-helpers.js';

const ADMIN_PASSWORD = 'admin-attendance-password';
const EMPLOYEE_PASSWORD = 'employee-attendance-password';
const BASELINE_EFFECTIVE_DATE = '2025-01-01';

function scheduleDays(weekdayMinutes = 480) {
  return Object.values(Weekday).map((weekday) => {
    if (weekday === Weekday.SUNDAY) {
      return {
        weekday,
        isOpen: false,
        openingMinute: null,
        closingMinute: null,
        lunchEnabled: false,
        lunchStartMinute: null,
        lunchEndMinute: null,
      };
    }
    if (weekday === Weekday.SATURDAY) {
      return {
        weekday,
        isOpen: true,
        openingMinute: 480,
        closingMinute: 720,
        lunchEnabled: false,
        lunchStartMinute: null,
        lunchEndMinute: null,
      };
    }

    return {
      weekday,
      isOpen: true,
      openingMinute: 480,
      closingMinute: 480 + weekdayMinutes + 60,
      lunchEnabled: true,
      lunchStartMinute: 720,
      lunchEndMinute: 780,
    };
  });
}

describe('attendance schedules and calendar exceptions with real PostgreSQL', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let adminPasswordHash: string;
  let employeePasswordHash: string;
  let adminId: string;
  let employeeId: string;
  let adminAccessToken: string;
  let employeeAccessToken: string;

  beforeAll(async () => {
    const moduleReference = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleReference.createNestApplication<NestExpressApplication>();
    configureApplication(app);
    await app.init();

    prisma = app.get(PrismaService);
    const passwords = app.get(PasswordService);
    [adminPasswordHash, employeePasswordHash] = await Promise.all([
      passwords.hash(ADMIN_PASSWORD),
      passwords.hash(EMPLOYEE_PASSWORD),
    ]);
  });

  beforeEach(async () => {
    await clearApplicationData(prisma);
    const [admin, employee] = await Promise.all([
      prisma.user.create({
        data: {
          name: 'Administrador de frequência',
          login: 'admin.attendance',
          normalizedLogin: 'admin.attendance',
          passwordHash: adminPasswordHash,
          role: UserRole.ADMIN,
          createdAt: new Date('2025-01-01T00:00:00.000Z'),
        },
      }),
      prisma.user.create({
        data: {
          name: 'Funcionário de frequência',
          login: 'employee.attendance',
          normalizedLogin: 'employee.attendance',
          passwordHash: employeePasswordHash,
          role: UserRole.EMPLOYEE,
          createdAt: new Date('2025-01-01T00:00:00.000Z'),
        },
      }),
    ]);
    adminId = admin.id;
    employeeId = employee.id;
    await prisma.businessScheduleVersion.create({
      data: {
        effectiveDate: new Date(`${BASELINE_EFFECTIVE_DATE}T00:00:00.000Z`),
        createdById: adminId,
        note: 'Horário base de integração',
        days: { create: scheduleDays() },
      },
    });

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Request-Id', `attendance-admin-${randomUUID()}`)
      .send({ login: 'admin.attendance', password: ADMIN_PASSWORD })
      .expect(200);

    const employeeLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Request-Id', `attendance-employee-${randomUUID()}`)
      .send({ login: 'employee.attendance', password: EMPLOYEE_PASSWORD })
      .expect(200);

    adminAccessToken = adminLogin.body.accessToken as string;
    employeeAccessToken = employeeLogin.body.accessToken as string;
  });

  afterAll(async () => {
    await clearApplicationData(prisma);
    await app.close();
  });

  it('resolves weekday, Saturday, and closed Sunday expectations without hardcoded punch counts', async () => {
    const response = await request(app.getHttpServer())
      .get('/attendance/history')
      .query({ from: '2026-01-05', to: '2026-01-11' })
      .auth(employeeAccessToken, { type: 'bearer' })
      .expect(200);

    expect(response.body.days).toHaveLength(6);
    expect(response.body.days[0]).toMatchObject({
      businessDate: '2026-01-05',
      expectedMinutes: 480,
      workedMinutes: 0,
      balanceMinutes: -480,
      status: 'MISSING_HOURS',
    });
    expect(response.body.days[5]).toMatchObject({
      businessDate: '2026-01-10',
      expectedMinutes: 240,
      balanceMinutes: -240,
      status: 'MISSING_HOURS',
    });
    expect(response.body.totals).toMatchObject({
      finalizedDayCount: 6,
      completeDayCount: 6,
      expectedMinutes: 2_640,
      missingMinutes: 2_640,
    });
  });

  it('applies immutable holiday, closed-day, and special-hour revisions over the weekly schedule', async () => {
    const exceptions = [
      {
        businessDate: '2026-01-06',
        kind: CalendarExceptionKind.HOLIDAY,
        name: 'Feriado de teste',
        lunchEnabled: false,
      },
      {
        businessDate: '2026-01-07',
        kind: CalendarExceptionKind.SPECIAL_HOURS,
        name: 'Horário especial de teste',
        openingMinute: 480,
        closingMinute: 720,
        lunchEnabled: false,
      },
      {
        businessDate: '2026-01-08',
        kind: CalendarExceptionKind.CLOSED,
        name: 'Fechado para inventário',
        lunchEnabled: false,
      },
    ];
    const createdExceptions = [];
    for (const exception of exceptions) {
      const created = await request(app.getHttpServer())
        .post('/calendar-exceptions')
        .auth(adminAccessToken, { type: 'bearer' })
        .send(exception)
        .expect(201);
      createdExceptions.push(created.body);
    }

    const response = await request(app.getHttpServer())
      .get('/attendance/history')
      .query({ from: '2026-01-06', to: '2026-01-08' })
      .auth(employeeAccessToken, { type: 'bearer' })
      .expect(200);
    expect(response.body.days).toEqual([
      expect.objectContaining({
        businessDate: '2026-01-06',
        expectedMinutes: 0,
        balanceMinutes: 0,
        status: 'HOLIDAY',
      }),
      expect.objectContaining({
        businessDate: '2026-01-07',
        expectedMinutes: 240,
        balanceMinutes: -240,
        status: 'MISSING_HOURS',
      }),
      expect.objectContaining({
        businessDate: '2026-01-08',
        expectedMinutes: 0,
        balanceMinutes: 0,
        status: 'CLOSED',
      }),
    ]);
    expect(
      await prisma.auditLog.count({
        where: { actorId: adminId, action: AuditAction.CALENDAR_EXCEPTION_CREATED },
      }),
    ).toBe(3);

    await request(app.getHttpServer())
      .post(`/calendar-exceptions/${createdExceptions[0]!.id}/retract`)
      .auth(adminAccessToken, { type: 'bearer' })
      .expect(201);
    const afterRetraction = await request(app.getHttpServer())
      .get('/attendance/day')
      .query({ date: '2026-01-06' })
      .auth(employeeAccessToken, { type: 'bearer' })
      .expect(200);
    expect(afterRetraction.body).toMatchObject({
      expectationSource: 'WEEKLY_SCHEDULE',
      expectedMinutes: 480,
      balanceMinutes: -480,
      status: 'MISSING_HOURS',
    });
    expect(
      await prisma.auditLog.count({
        where: { actorId: adminId, action: AuditAction.CALENDAR_EXCEPTION_RETRACTED },
      }),
    ).toBe(1);
  });

  it('preserves historical schedule resolution and serializes competing versions', async () => {
    const today = businessDateFromInstant(new Date());
    const tomorrow = addBusinessDateDays(today, 1);
    const payload = {
      effectiveDate: tomorrow,
      note: 'Jornada futura de sete horas',
      days: scheduleDays(420),
    };
    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post('/schedules')
        .auth(adminAccessToken, { type: 'bearer' })
        .send(payload),
      request(app.getHttpServer())
        .post('/schedules')
        .auth(adminAccessToken, { type: 'bearer' })
        .send(payload),
    ]);
    expect([first.status, second.status].sort()).toEqual([201, 409]);

    const historical = await request(app.getHttpServer())
      .get('/schedules/current')
      .query({ businessDate: '2026-01-05' })
      .auth(adminAccessToken, { type: 'bearer' })
      .expect(200);
    expect(historical.body).toMatchObject({
      effectiveDate: BASELINE_EFFECTIVE_DATE,
      day: { expectedMinutes: 480 },
    });

    const future = await request(app.getHttpServer())
      .get('/schedules/current')
      .query({ businessDate: tomorrow })
      .auth(adminAccessToken, { type: 'bearer' })
      .expect(200);
    const tomorrowWeekday = future.body.day.weekday as Weekday;
    expect(future.body.day.expectedMinutes).toBe(
      tomorrowWeekday === Weekday.SUNDAY ? 0 : tomorrowWeekday === Weekday.SATURDAY ? 240 : 420,
    );

    const pastVersion = await request(app.getHttpServer())
      .post('/schedules')
      .auth(adminAccessToken, { type: 'bearer' })
      .send({ ...payload, effectiveDate: '2026-02-01' })
      .expect(409);
    expect(pastVersion.body.code).toBe('SCHEDULE_EFFECTIVE_DATE_IN_PAST');
  });

  it('enforces own-history and ADMIN-scoped employee boundaries', async () => {
    await request(app.getHttpServer())
      .get(`/attendance/employees/${employeeId}/history`)
      .query({ from: '2026-01-05', to: '2026-01-05' })
      .auth(employeeAccessToken, { type: 'bearer' })
      .expect(403);

    await request(app.getHttpServer())
      .get(`/attendance/employees/${employeeId}/history`)
      .query({ from: '2026-01-05', to: '2026-01-05' })
      .auth(adminAccessToken, { type: 'bearer' })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/attendance/employees/${adminId}/history`)
      .query({ from: '2026-01-05', to: '2026-01-05' })
      .auth(adminAccessToken, { type: 'bearer' })
      .expect(404);

    await request(app.getHttpServer())
      .get('/attendance/history')
      .query({ from: '2026-01-05', to: '2026-01-05' })
      .auth(adminAccessToken, { type: 'bearer' })
      .expect(403);
  });

  it('does not calculate expected minutes or missing hours prior to employee creation date', async () => {
    const passwords = app.get(PasswordService);
    const login = `novato_${randomUUID().slice(0, 8)}`;
    const newEmployee = await prisma.user.create({
      data: {
        id: randomUUID(),
        name: 'Novato Teste',
        login,
        normalizedLogin: login,
        passwordHash: await passwords.hash(EMPLOYEE_PASSWORD),
        role: UserRole.EMPLOYEE,
        createdAt: new Date('2026-08-16T12:00:00Z'),
      },
    });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ login: newEmployee.login, password: EMPLOYEE_PASSWORD })
      .expect(200);

    const token = loginRes.body.accessToken as string;

    const historyRes = await request(app.getHttpServer())
      .get('/attendance/history')
      .query({ from: '2026-08-10', to: '2026-08-15' })
      .auth(token, { type: 'bearer' })
      .expect(200);

    expect(historyRes.body.totals.expectedMinutes).toBe(0);
    expect(historyRes.body.totals.missingMinutes).toBe(0);
    expect(historyRes.body.totals.balanceMinutes).toBe(0);
    expect(historyRes.body.days).toHaveLength(0);
  });
});
