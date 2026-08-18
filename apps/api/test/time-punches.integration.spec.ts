import { randomUUID } from 'node:crypto';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { ATTENDANCE_CLOCK } from '../src/attendance/attendance-clock.js';
import { PasswordService } from '../src/auth/password.service.js';
import { configureApplication } from '../src/bootstrap.js';
import { PrismaService } from '../src/database/prisma.service.js';
import {
  AuditAction,
  TimePunchKind,
  TimePunchOrigin,
  UserRole,
  Weekday,
} from '../src/generated/prisma/client.js';
import { TIME_PUNCH_CLOCK } from '../src/time-punches/clock.js';
import { EffectiveTimePunchService } from '../src/time-punches/effective-time-punch.service.js';
import { clearApplicationData } from './database-test-helpers.js';

const ADMIN_PASSWORD = 'admin-punch-password';
const EMPLOYEE_PASSWORD = 'employee-punch-password';
const WORK_DATE = '2026-01-05';

function baselineScheduleDays() {
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
      closingMinute: 1_020,
      lunchEnabled: true,
      lunchStartMinute: 720,
      lunchEndMinute: 780,
    };
  });
}

describe('authoritative and idempotent time punches with real PostgreSQL', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let adminPasswordHash: string;
  let employeePasswordHash: string;
  let adminId: string;
  let employeeId: string;
  let adminAccessToken: string;
  let employeeAccessToken: string;
  let clockInstant = new Date('2026-01-05T11:00:00.000Z');

  const setClock = (instant: string): void => {
    clockInstant = new Date(instant);
  };

  beforeAll(async () => {
    const moduleReference = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TIME_PUNCH_CLOCK)
      .useValue(() => new Date(clockInstant.getTime()))
      .overrideProvider(ATTENDANCE_CLOCK)
      .useValue(() => new Date(clockInstant.getTime()))
      .compile();
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
    setClock('2026-01-05T11:00:00.000Z');
    await clearApplicationData(prisma);
    const [admin, employee] = await Promise.all([
      prisma.user.create({
        data: {
          name: 'Administrador de pontos',
          login: 'admin.punches',
          normalizedLogin: 'admin.punches',
          passwordHash: adminPasswordHash,
          role: UserRole.ADMIN,
          createdAt: new Date('2015-01-01T00:00:00.000Z'),
        },
      }),
      prisma.user.create({
        data: {
          name: 'Funcionário de pontos',
          login: 'employee.punches',
          normalizedLogin: 'employee.punches',
          passwordHash: employeePasswordHash,
          role: UserRole.EMPLOYEE,
          createdAt: new Date('2015-01-01T00:00:00.000Z'),
        },
      }),
    ]);
    adminId = admin.id;
    employeeId = employee.id;
    await prisma.businessScheduleVersion.create({
      data: {
        effectiveDate: new Date('2015-01-01T00:00:00.000Z'),
        createdById: adminId,
        days: { create: baselineScheduleDays() },
      },
    });

    const [adminLogin, employeeLogin] = await Promise.all([
      request(app.getHttpServer())
        .post('/auth/login')
        .send({ login: 'admin.punches', password: ADMIN_PASSWORD })
        .expect(200),
      request(app.getHttpServer())
        .post('/auth/login')
        .send({ login: 'employee.punches', password: EMPLOYEE_PASSWORD })
        .expect(200),
    ]);
    adminAccessToken = adminLogin.body.accessToken as string;
    employeeAccessToken = employeeLogin.body.accessToken as string;
  });

  afterAll(async () => {
    await clearApplicationData(prisma);
    await app.close();
  });

  async function punch(idempotencyKey = randomUUID()) {
    return request(app.getHttpServer())
      .post('/time-punches')
      .set('Idempotency-Key', idempotencyKey)
      .auth(employeeAccessToken, { type: 'bearer' })
      .send({});
  }

  async function insertManual(occurredAt: string, reason: string, idempotencyKey = randomUUID()) {
    return request(app.getHttpServer())
      .post('/time-punches/manual')
      .set('Idempotency-Key', idempotencyKey)
      .auth(adminAccessToken, { type: 'bearer' })
      .send({ employeeId, occurredAt, reason });
  }

  it('uses server time, serializes concurrent retries, alternates intervals, and blocks rapid duplicates', async () => {
    const key = randomUUID();
    const [first, replay] = await Promise.all([punch(key), punch(key)]);
    expect(first.status).toBe(201);
    expect(replay.status).toBe(201);
    expect(first.body.punch.id).toBe(replay.body.punch.id);
    expect([
      first.headers['idempotency-replayed'],
      replay.headers['idempotency-replayed'],
    ]).toContain('true');
    expect(first.body.punch).toMatchObject({
      occurredAt: '2026-01-05T11:00:00.000Z',
      kind: TimePunchKind.CLOCK_IN,
      origin: TimePunchOrigin.EMPLOYEE,
    });
    expect(await prisma.timePunch.count({ where: { employeeId } })).toBe(1);

    const current = await request(app.getHttpServer())
      .get('/attendance/today')
      .auth(employeeAccessToken, { type: 'bearer' })
      .expect(200);
    expect(current.body).toMatchObject({
      businessDate: WORK_DATE,
      isFinalized: false,
      workState: 'WORKING',
      status: null,
      balanceMinutes: null,
      punchCount: 1,
    });

    setClock('2026-01-05T11:00:05.000Z');
    const duplicate = await punch();
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe('DUPLICATE_PUNCH_WINDOW');

    for (const instant of [
      '2026-01-05T15:00:00.000Z',
      '2026-01-05T16:00:00.000Z',
      '2026-01-05T20:00:00.000Z',
    ]) {
      setClock(instant);
      const response = await punch();
      expect(response.status).toBe(201);
      if (instant === '2026-01-05T20:00:00.000Z') {
        expect(response.body.dailySummary).toMatchObject({
          expectedMinutes: 480,
          workedMinutes: 480,
          balanceMinutes: 0,
          status: 'NORMAL',
          punchCount: 4,
        });
      }
    }

    const persisted = await prisma.timePunch.findMany({
      where: { employeeId },
      orderBy: { occurredAt: 'asc' },
      select: { occurredAt: true, kind: true },
    });
    expect(persisted.map((entry) => entry.kind)).toEqual([
      TimePunchKind.CLOCK_IN,
      TimePunchKind.CLOCK_OUT,
      TimePunchKind.CLOCK_IN,
      TimePunchKind.CLOCK_OUT,
    ]);
    expect(persisted.map((entry) => entry.occurredAt.toISOString())).toEqual([
      '2026-01-05T11:00:00.000Z',
      '2026-01-05T15:00:00.000Z',
      '2026-01-05T16:00:00.000Z',
      '2026-01-05T20:00:00.000Z',
    ]);

    setClock('2026-01-06T11:00:00.000Z');
    const history = await request(app.getHttpServer())
      .get('/attendance/history')
      .query({ from: WORK_DATE, to: WORK_DATE })
      .auth(employeeAccessToken, { type: 'bearer' })
      .expect(200);
    expect(history.body.days[0]).toMatchObject({
      isFinalized: true,
      status: 'NORMAL',
      workedMinutes: 480,
      expectedMinutes: 480,
      balanceMinutes: 0,
    });
  });

  it('keeps original punches immutable while multiple corrections recalculate reports and audit every change', async () => {
    setClock('2026-01-20T15:00:00.000Z');
    const inserted = [];
    for (const [occurredAt, reason] of [
      ['2026-01-05T08:00:00-03:00', 'Entrada não registrada'],
      ['2026-01-05T12:00:00-03:00', 'Saída para almoço não registrada'],
      ['2026-01-05T13:00:00-03:00', 'Volta do almoço não registrada'],
      ['2026-01-05T15:00:00-03:00', 'Saída registrada incorretamente'],
    ] as const) {
      const response = await insertManual(occurredAt, reason);
      expect(response.status).toBe(201);
      inserted.push(response.body.punch);
    }
    const target = inserted.at(-1)!;
    expect(target).toMatchObject({
      occurredAt: '2026-01-05T18:00:00.000Z',
      effectiveOccurredAt: '2026-01-05T18:00:00.000Z',
      kind: TimePunchKind.CLOCK_OUT,
      origin: TimePunchOrigin.ADMIN_INSERTION,
    });

    const firstCorrectionKey = randomUUID();
    const firstCorrection = await request(app.getHttpServer())
      .post(`/time-punches/${target.id}/adjustments`)
      .set('Idempotency-Key', firstCorrectionKey)
      .auth(adminAccessToken, { type: 'bearer' })
      .send({
        correctedOccurredAt: '2026-01-05T17:00:00-03:00',
        expectedCurrentOccurredAt: '2026-01-05T15:00:00-03:00',
        expectedSequence: 0,
        reason: 'Correção confirmada pelo funcionário',
      })
      .expect(201);
    expect(firstCorrection.body.dailySummary).toMatchObject({
      workedMinutes: 480,
      balanceMinutes: 0,
      status: 'NORMAL',
      correctionCount: 1,
    });

    const afterFirst = await request(app.getHttpServer())
      .get('/attendance/history')
      .query({ from: WORK_DATE, to: WORK_DATE })
      .auth(employeeAccessToken, { type: 'bearer' })
      .expect(200);
    expect(afterFirst.body.days[0]).toMatchObject({
      workedMinutes: 480,
      balanceMinutes: 0,
      status: 'NORMAL',
      correctionCount: 1,
    });

    const secondCorrectionKey = randomUUID();
    const secondCorrectionBody = {
      correctedOccurredAt: '2026-01-05T18:00:00-03:00',
      expectedCurrentOccurredAt: '2026-01-05T17:00:00-03:00',
      expectedSequence: 1,
      reason: 'Revisão final aprovada pelo administrador',
    };
    const secondCorrection = await request(app.getHttpServer())
      .post(`/time-punches/${target.id}/adjustments`)
      .set('Idempotency-Key', secondCorrectionKey)
      .auth(adminAccessToken, { type: 'bearer' })
      .send(secondCorrectionBody)
      .expect(201);
    expect(secondCorrection.body.dailySummary).toMatchObject({
      workedMinutes: 540,
      balanceMinutes: 60,
      status: 'OVERTIME',
      correctionCount: 2,
    });

    const replay = await request(app.getHttpServer())
      .post(`/time-punches/${target.id}/adjustments`)
      .set('Idempotency-Key', secondCorrectionKey)
      .auth(adminAccessToken, { type: 'bearer' })
      .send(secondCorrectionBody)
      .expect(201);
    expect(replay.headers['idempotency-replayed']).toBe('true');
    expect(replay.body.auditEventId).toBe(secondCorrection.body.auditEventId);

    const stale = await request(app.getHttpServer())
      .post(`/time-punches/${target.id}/adjustments`)
      .set('Idempotency-Key', randomUUID())
      .auth(adminAccessToken, { type: 'bearer' })
      .send({
        correctedOccurredAt: '2026-01-05T16:30:00-03:00',
        expectedCurrentOccurredAt: '2026-01-05T15:00:00-03:00',
        expectedSequence: 0,
        reason: 'Tentativa com versão antiga',
      })
      .expect(409);
    expect(stale.body.code).toBe('STALE_ADJUSTMENT_VERSION');

    const mismatchedReplay = await request(app.getHttpServer())
      .post(`/time-punches/${target.id}/adjustments`)
      .set('Idempotency-Key', secondCorrectionKey)
      .auth(adminAccessToken, { type: 'bearer' })
      .send({ ...secondCorrectionBody, reason: 'Outro motivo' })
      .expect(409);
    expect(mismatchedReplay.body.code).toBe('IDEMPOTENCY_KEY_REUSED');

    await request(app.getHttpServer())
      .post(`/time-punches/${target.id}/adjustments`)
      .set('Idempotency-Key', randomUUID())
      .auth(employeeAccessToken, { type: 'bearer' })
      .send(secondCorrectionBody)
      .expect(403);

    const futureInsertion = await insertManual(
      '2026-01-21T08:00:00-03:00',
      'Tentativa em data futura',
    );
    expect(futureInsertion.status).toBe(400);
    expect(futureInsertion.body.code).toBe('FUTURE_TIME_PUNCH');

    const original = await prisma.timePunch.findUniqueOrThrow({
      where: { id: target.id as string },
      select: { occurredAt: true, adjustments: { orderBy: { sequence: 'asc' } } },
    });
    expect(original.occurredAt.toISOString()).toBe('2026-01-05T18:00:00.000Z');
    expect(original.adjustments).toHaveLength(2);
    expect(original.adjustments.map((adjustment) => adjustment.sequence)).toEqual([1, 2]);
    expect(original.adjustments[0]).toMatchObject({
      previousOccurredAt: new Date('2026-01-05T18:00:00.000Z'),
      correctedOccurredAt: new Date('2026-01-05T20:00:00.000Z'),
    });
    expect(original.adjustments[1]).toMatchObject({
      previousOccurredAt: new Date('2026-01-05T20:00:00.000Z'),
      correctedOccurredAt: new Date('2026-01-05T21:00:00.000Z'),
    });

    const finalHistory = await request(app.getHttpServer())
      .get('/attendance/history')
      .query({ from: WORK_DATE, to: WORK_DATE })
      .auth(employeeAccessToken, { type: 'bearer' })
      .expect(200);
    expect(finalHistory.body.days[0]).toMatchObject({
      workedMinutes: 540,
      balanceMinutes: 60,
      status: 'OVERTIME',
      correctionCount: 2,
    });
    expect(finalHistory.body.days[0].chronology.punches.at(-1)).toMatchObject({
      originalOccurredAt: '2026-01-05T18:00:00.000Z',
      effectiveOccurredAt: '2026-01-05T21:00:00.000Z',
      appliedAdjustmentCount: 2,
    });
    expect(
      await prisma.auditLog.count({
        where: { actorId: adminId, action: AuditAction.TIME_PUNCH_INSERTED },
      }),
    ).toBe(4);
    expect(
      await prisma.auditLog.count({
        where: { actorId: adminId, action: AuditAction.TIME_PUNCH_CORRECTED },
      }),
    ).toBe(2);
  });

  it('marks a finalized odd sequence incomplete and excludes it from monthly balance totals', async () => {
    setClock('2026-01-20T15:00:00.000Z');
    for (const [occurredAt, reason] of [
      ['2026-01-05T08:00:00-03:00', 'Entrada adicionada'],
      ['2026-01-05T12:00:00-03:00', 'Saída para almoço adicionada'],
      ['2026-01-05T13:00:00-03:00', 'Volta do almoço adicionada'],
    ] as const) {
      await insertManual(occurredAt, reason).then((response) => expect(response.status).toBe(201));
    }

    const day = await request(app.getHttpServer())
      .get('/attendance/history')
      .query({ from: WORK_DATE, to: WORK_DATE })
      .auth(employeeAccessToken, { type: 'bearer' })
      .expect(200);
    expect(day.body.days[0]).toMatchObject({
      isFinalized: true,
      status: 'INCOMPLETE',
      expectedMinutes: 480,
      workedMinutes: 240,
      balanceMinutes: null,
      punchCount: 3,
    });
    expect(day.body.totals).toMatchObject({
      completeDayCount: 0,
      incompleteDayCount: 1,
      expectedMinutes: 0,
      workedMinutes: 0,
      balanceMinutes: 0,
      knownPartialWorkedMinutes: 240,
    });

    const monthly = await request(app.getHttpServer())
      .get('/attendance/monthly')
      .query({ month: '2026-01' })
      .auth(employeeAccessToken, { type: 'bearer' })
      .expect(200);
    expect(monthly.body.days).toHaveLength(17);
    expect(monthly.body.days.at(-1)).toMatchObject({
      businessDate: '2026-01-20',
      isFinalized: false,
    });
    expect(monthly.body.totals).toMatchObject({
      year: 2026,
      month: 1,
      incompleteDayCount: 1,
      knownPartialWorkedMinutes: 240,
      provisionalDayCount: 1,
    });
  });

  it('keeps historical São Paulo DST-day punch queries inside the correct local date', async () => {
    setClock('2026-01-20T15:00:00.000Z');
    const priorDay = await insertManual(
      '2018-11-03T23:30:00-03:00',
      'Ponto limítrofe do dia anterior',
    );
    expect(priorDay.status).toBe(201);
    expect(priorDay.body.punch.kind).toBe(TimePunchKind.CLOCK_IN);
    expect(
      await app.get(EffectiveTimePunchService).listForBusinessDate(employeeId, '2018-11-04'),
    ).toEqual([]);

    const transitionKinds = [];
    for (const [occurredAt, reason] of [
      ['2018-11-04T01:30:00-02:00', 'Entrada no dia de transição'],
      ['2018-11-04T02:30:00-02:00', 'Saída no dia de transição'],
    ] as const) {
      const response = await insertManual(occurredAt, reason);
      expect(response.status, `${occurredAt}: ${JSON.stringify(response.body)}`).toBe(201);
      transitionKinds.push(response.body.punch.kind);
    }
    expect(transitionKinds).toEqual([TimePunchKind.CLOCK_IN, TimePunchKind.CLOCK_OUT]);

    const persisted = await prisma.timePunch.findMany({
      where: { employeeId },
      orderBy: { occurredAt: 'asc' },
      select: { occurredAt: true, kind: true },
    });
    expect(persisted).toEqual([
      {
        occurredAt: new Date('2018-11-04T02:30:00.000Z'),
        kind: TimePunchKind.CLOCK_IN,
      },
      {
        occurredAt: new Date('2018-11-04T03:30:00.000Z'),
        kind: TimePunchKind.CLOCK_IN,
      },
      {
        occurredAt: new Date('2018-11-04T04:30:00.000Z'),
        kind: TimePunchKind.CLOCK_OUT,
      },
    ]);

    const history = await request(app.getHttpServer())
      .get('/attendance/history')
      .query({ from: '2018-11-04', to: '2018-11-04' })
      .auth(employeeAccessToken, { type: 'bearer' })
      .expect(200);
    expect(history.body.days[0]).toMatchObject({
      businessDate: '2018-11-04',
      punchCount: 2,
      completedIntervalCount: 1,
      workedMinutes: 60,
      expectedMinutes: 0,
      balanceMinutes: 60,
      status: 'DAY_OFF',
    });
    expect(history.body.days[0].chronology.punches).toHaveLength(2);
  });
});
