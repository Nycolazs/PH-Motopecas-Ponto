import { randomUUID } from 'node:crypto';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { PasswordService } from '../src/auth/password.service.js';
import { configureApplication } from '../src/bootstrap.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { AuditAction, UserRole, Weekday } from '../src/generated/prisma/client.js';
import { clearApplicationData } from './database-test-helpers.js';

const PASSWORD = 'justification-test-password';

function weekdaySchedule() {
  return Object.values(Weekday).map((weekday) =>
    weekday === Weekday.SUNDAY || weekday === Weekday.SATURDAY
      ? {
          weekday,
          isOpen: false,
          openingMinute: null,
          closingMinute: null,
          lunchEnabled: false,
          lunchStartMinute: null,
          lunchEndMinute: null,
        }
      : {
          weekday,
          isOpen: true,
          openingMinute: 480,
          closingMinute: 1_020,
          lunchEnabled: true,
          lunchStartMinute: 720,
          lunchEndMinute: 780,
        },
  );
}

describe('abono e atestado (absence justifications) with real PostgreSQL', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let passwordHash: string;
  let employeeId: string;
  let adminToken: string;
  let employeeToken: string;

  const http = () => request(app.getHttpServer());
  const asAdmin = <T extends request.Test>(test: T) => test.auth(adminToken, { type: 'bearer' });

  beforeAll(async () => {
    const moduleReference = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleReference.createNestApplication<NestExpressApplication>();
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
    passwordHash = await app.get(PasswordService).hash(PASSWORD);
  });

  beforeEach(async () => {
    await clearApplicationData(prisma);
    const createdAt = new Date('2025-01-01T00:00:00.000Z');
    const [admin, employee] = await Promise.all([
      prisma.user.create({
        data: {
          name: 'Gestora',
          login: 'gestora',
          normalizedLogin: 'gestora',
          passwordHash,
          role: UserRole.ADMIN,
          createdAt,
        },
      }),
      prisma.user.create({
        data: {
          name: 'Colaborador Atestado',
          login: 'colaborador',
          normalizedLogin: 'colaborador',
          passwordHash,
          role: UserRole.EMPLOYEE,
          createdAt,
        },
      }),
    ]);
    employeeId = employee.id;
    await prisma.businessScheduleVersion.create({
      data: {
        effectiveDate: new Date('2025-01-01T00:00:00.000Z'),
        createdById: admin.id,
        days: { create: weekdaySchedule() },
      },
    });
    const login = async (name: string) =>
      (await http().post('/auth/login').send({ login: name, password: PASSWORD }).expect(200)).body
        .accessToken as string;
    adminToken = await login('gestora');
    employeeToken = await login('colaborador');
  });

  afterAll(async () => {
    await clearApplicationData(prisma);
    await app.close();
  });

  const justify = (body: Record<string, unknown>) =>
    asAdmin(http().post('/absence-justifications')).send({ employeeId, ...body });

  it('forgives the missing hours in the day, the history and the timesheet', async () => {
    // Monday 2026-01-05: worked 2h and left with an atestado for the day and Tuesday.
    // 08:00 and 10:00 in the business time zone (UTC-3).
    for (const occurredAt of ['2026-01-05T11:00:00.000Z', '2026-01-05T13:00:00.000Z']) {
      await asAdmin(http().post('/time-punches/manual'))
        .set('Idempotency-Key', randomUUID())
        .send({ employeeId, occurredAt, reason: 'Registro de teste.' })
        .expect(201);
    }
    const medical = await justify({
      kind: 'MEDICAL_CERTIFICATE',
      startDate: '2026-01-05',
      endDate: '2026-01-06',
      reason: 'Atestado de 2 dias',
    }).expect(201);
    expect(medical.body).toMatchObject({
      kind: 'MEDICAL_CERTIFICATE',
      daysCount: 2,
      revokedAt: null,
    });
    // Wednesday: abono.
    await justify({
      kind: 'ALLOWANCE',
      startDate: '2026-01-07',
      endDate: '2026-01-07',
      reason: 'Liberado pela gerência',
    }).expect(201);

    const history = await http()
      .get('/attendance/history')
      .query({ from: '2026-01-05', to: '2026-01-08' })
      .auth(employeeToken, { type: 'bearer' })
      .expect(200);
    const [monday, tuesday, wednesday, thursday] = history.body.days;
    expect(monday).toMatchObject({
      status: 'MEDICAL_LEAVE',
      calendarStatus: 'MEDICAL_LEAVE',
      exceptionName: 'Atestado médico: Atestado de 2 dias',
      expectedMinutes: 120,
      workedMinutes: 120,
      balanceMinutes: 0,
    });
    expect(tuesday).toMatchObject({
      status: 'MEDICAL_LEAVE',
      expectedMinutes: 0,
      balanceMinutes: 0,
    });
    expect(wednesday).toMatchObject({
      status: 'ALLOWANCE',
      exceptionName: 'Abono: Liberado pela gerência',
      balanceMinutes: 0,
    });
    expect(thursday).toMatchObject({ status: 'MISSING_HOURS', balanceMinutes: -480 });
    expect(history.body.totals).toMatchObject({ missingMinutes: 480, balanceMinutes: -480 });

    const report = await asAdmin(http().get('/attendance/reports/timesheets'))
      .query({ from: '2026-01-05', to: '2026-01-08' })
      .expect(200);
    expect(report.body.employees[0].totals).toMatchObject({ missingMinutes: 480 });

    const day = await asAdmin(http().get(`/attendance/employees/${employeeId}/day`))
      .query({ date: '2026-01-06' })
      .expect(200);
    expect(day.body.status).toBe('MEDICAL_LEAVE');
  });

  it('enforces one day per abono, no overlaps and no vacation days', async () => {
    await justify({
      kind: 'ALLOWANCE',
      startDate: '2026-01-05',
      endDate: '2026-01-06',
      reason: 'Dois dias',
    })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('ALLOWANCE_SINGLE_DAY'));
    await justify({
      kind: 'MEDICAL_CERTIFICATE',
      startDate: '2026-01-01',
      endDate: '2026-02-15',
      reason: 'Longo demais',
    })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('JUSTIFICATION_TOO_LONG'));
    await justify({
      kind: 'ALLOWANCE',
      startDate: '2026-01-05',
      endDate: '2026-01-05',
      reason: 'ok',
    }).expect(400);

    await justify({
      kind: 'MEDICAL_CERTIFICATE',
      startDate: '2026-01-05',
      endDate: '2026-01-07',
      reason: 'Atestado',
    }).expect(201);
    await justify({
      kind: 'ALLOWANCE',
      startDate: '2026-01-06',
      endDate: '2026-01-06',
      reason: 'Abono',
    })
      .expect(409)
      .expect(({ body }) => {
        expect(body.code).toBe('JUSTIFICATION_OVERLAP');
        expect(body.message).toContain('de 05/01/2026 a 07/01/2026');
      });

    await asAdmin(http().post('/vacations'))
      .send({ employeeId, startDate: '2026-02-02', endDate: '2026-02-13' })
      .expect(201);
    await justify({
      kind: 'ALLOWANCE',
      startDate: '2026-02-03',
      endDate: '2026-02-03',
      reason: 'Abono',
    })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('JUSTIFICATION_DURING_VACATION'));

    await http()
      .post('/absence-justifications')
      .auth(employeeToken, { type: 'bearer' })
      .send({
        employeeId,
        kind: 'ALLOWANCE',
        startDate: '2026-01-09',
        endDate: '2026-01-09',
        reason: 'Eu mesmo',
      })
      .expect(403);
  });

  it('cancels with a reason, keeps the history and audits both actions', async () => {
    const created = await justify({
      kind: 'ALLOWANCE',
      startDate: '2026-01-05',
      endDate: '2026-01-05',
      reason: 'Abono por engano',
    }).expect(201);
    const id = created.body.id as string;

    await asAdmin(http().post(`/absence-justifications/${id}/revoke`))
      .send({ reason: 'x' })
      .expect(400);
    const revoked = await asAdmin(http().post(`/absence-justifications/${id}/revoke`))
      .send({ reason: 'Lançado no dia errado' })
      .expect(200);
    expect(revoked.body).toMatchObject({ revokeReason: 'Lançado no dia errado' });
    expect(revoked.body.revokedBy.login).toBe('gestora');
    await asAdmin(http().post(`/absence-justifications/${id}/revoke`))
      .send({ reason: 'De novo' })
      .expect(409);

    const day = await asAdmin(http().get(`/attendance/employees/${employeeId}/day`))
      .query({ date: '2026-01-05' })
      .expect(200);
    expect(day.body).toMatchObject({ status: 'MISSING_HOURS', balanceMinutes: -480 });

    // The cancelled record stays listed, and the same day can be justified again.
    const list = await asAdmin(http().get('/absence-justifications'))
      .query({ employeeId })
      .expect(200);
    expect(list.body.items).toHaveLength(1);
    await justify({
      kind: 'ALLOWANCE',
      startDate: '2026-01-05',
      endDate: '2026-01-05',
      reason: 'Correto',
    }).expect(201);

    await expect(prisma.absenceJustification.delete({ where: { id } })).rejects.toThrow();
    const actions = await prisma.auditLog.findMany({
      where: { targetId: id },
      select: { action: true },
      orderBy: { createdAt: 'asc' },
    });
    expect(actions.map((log) => log.action)).toEqual([
      AuditAction.ABSENCE_JUSTIFIED,
      AuditAction.ABSENCE_JUSTIFICATION_REVOKED,
    ]);
  });
});
