import type { DailyAttendanceSummary } from '@ph-ponto/shared';
import { describe, expect, it, vi } from 'vitest';

import type { AuditService } from '../audit/audit.service.js';
import type { PrismaService } from '../database/prisma.service.js';
import { TimePunchKind, TimePunchOrigin } from '../generated/prisma/client.js';
import type { IdempotencyService } from '../idempotency/idempotency.service.js';
import type { MutationLockService } from '../idempotency/mutation-lock.service.js';
import type { AttendanceSummaryResolver } from './attendance-summary.port.js';
import type { EffectiveTimePunchService } from './effective-time-punch.service.js';
import { TimePunchService } from './time-punch.service.js';

const employee = {
  id: '487d962c-c34d-486b-83be-c1aac9772f9d',
  name: 'Ana Souza',
  login: 'ana.souza',
  role: 'EMPLOYEE' as const,
  sessionId: '23144362-e369-49e4-9241-1920b05e32f7',
};
const admin = { ...employee, id: 'ad49c9bd-9bde-4c4c-bcec-bf209a3d8507', role: 'ADMIN' as const };
const key = 'a46542bd-2149-46b9-99e8-46c580657f1a';
const context = { ipHash: 'a'.repeat(64), requestId: 'punch-test' };

const summary = {
  businessDate: '2026-08-14',
  isFinalized: false,
  status: null,
  workState: 'WORKING',
  expectedMinutes: 480,
  workedMinutes: 0,
  balanceMinutes: null,
  punchCount: 1,
  completedIntervalCount: 0,
  correctionCount: 0,
  expectation: {
    businessDate: '2026-08-14',
    expectedMinutes: 480,
    source: 'WEEKLY_SCHEDULE',
    calendarStatus: null,
    scheduleVersionId: 'schedule',
    scheduleEffectiveDate: '2026-01-01',
    exceptionRevisionId: null,
    exceptionName: null,
    isOpen: true,
    openingMinute: 480,
    closingMinute: 1020,
    lunchEnabled: true,
    lunchStartMinute: 720,
    lunchEndMinute: 780,
  },
  chronology: {
    punches: [],
    integrityIssues: [],
    intervals: [],
    punchCount: 1,
    completedIntervalCount: 0,
    hasOpenInterval: true,
    isIncomplete: true,
    workedMilliseconds: 0,
    workedMinutes: 0,
  },
} satisfies DailyAttendanceSummary;

function existingPunch(occurredAt: Date, kind: TimePunchKind) {
  return {
    id: '74134cf8-b7ec-48a7-b7c1-6f9ce60c37ea',
    employeeId: employee.id,
    originalOccurredAt: occurredAt,
    effectiveOccurredAt: occurredAt,
    kind,
    origin: TimePunchOrigin.EMPLOYEE,
    createdByAdminId: null,
    insertionReason: null,
    adjustmentSequence: 0,
    createdAt: occurredAt,
  };
}

function createHarness(clockValues: Date[]) {
  const transaction = {
    timePunch: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: '228e5eb3-1f64-4ed0-bf40-80dcc19e0a33' }),
    },
  };
  const prisma = {
    $transaction: vi.fn(
      async (callback: (client: typeof transaction) => Promise<unknown>): Promise<unknown> =>
        callback(transaction),
    ),
  } as unknown as PrismaService;
  const idempotencyShape = {
    begin: vi.fn().mockResolvedValue({
      kind: 'CLAIM',
      recordId: '2a525b51-3f49-4113-8ebf-ddd63f69307c',
    }),
    complete: vi.fn().mockResolvedValue(undefined),
  };
  const locksShape = {
    lockEmployee: vi.fn().mockResolvedValue({}),
    lockEmployeeStream: vi.fn().mockResolvedValue(undefined),
  };
  const effectiveShape = {
    listForBusinessDate: vi.fn().mockResolvedValue([]),
  };
  const summariesShape = { resolveDaily: vi.fn().mockResolvedValue(summary) };
  const auditShape = { record: vi.fn().mockResolvedValue('audit-event-id') };
  const clock = vi.fn<() => Date>();
  for (const value of clockValues) {
    clock.mockReturnValueOnce(value);
  }
  const service = new TimePunchService(
    prisma,
    idempotencyShape as unknown as IdempotencyService,
    locksShape as unknown as MutationLockService,
    effectiveShape as unknown as EffectiveTimePunchService,
    auditShape as unknown as AuditService,
    summariesShape as unknown as AttendanceSummaryResolver,
    clock,
  );

  return {
    service,
    transaction,
    idempotencyShape,
    locksShape,
    effectiveShape,
    summariesShape,
    auditShape,
  };
}

describe('TimePunchService', () => {
  it('uses authoritative server time and alternates the next employee punch', async () => {
    const claimAt = new Date('2026-08-14T14:00:00.000Z');
    const occurredAt = new Date('2026-08-14T16:00:00.000Z');
    const harness = createHarness([claimAt, occurredAt]);
    harness.effectiveShape.listForBusinessDate.mockResolvedValueOnce([
      existingPunch(new Date('2026-08-14T11:00:00.000Z'), TimePunchKind.CLOCK_IN),
    ]);

    const result = await harness.service.createEmployeePunch(employee, key);

    expect(result.replayed).toBe(false);
    expect(result.body.punch).toMatchObject({
      occurredAt: occurredAt.toISOString(),
      kind: TimePunchKind.CLOCK_OUT,
      origin: TimePunchOrigin.EMPLOYEE,
    });
    expect(harness.transaction.timePunch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ occurredAt, kind: TimePunchKind.CLOCK_OUT }),
      }),
    );
    expect(harness.summariesShape.resolveDaily).toHaveBeenCalledWith(
      expect.objectContaining({ evaluationInstant: occurredAt, employeeId: employee.id }),
    );
    expect(harness.idempotencyShape.complete).toHaveBeenCalledOnce();
  });

  it('replays a completed response without touching the employee stream', async () => {
    const harness = createHarness([new Date('2026-08-14T14:00:00.000Z')]);
    const replay = { punch: { id: 'stored' }, dailySummary: summary, idempotencyKey: key };
    harness.idempotencyShape.begin.mockResolvedValueOnce({
      kind: 'REPLAY',
      response: replay,
      responseStatus: 201,
    });

    const result = await harness.service.createEmployeePunch(employee, key);

    expect(result).toEqual({ body: replay, replayed: true });
    expect(harness.locksShape.lockEmployee).not.toHaveBeenCalled();
    expect(harness.transaction.timePunch.create).not.toHaveBeenCalled();
  });

  it('rejects a second employee-origin punch inside thirty seconds', async () => {
    const occurredAt = new Date('2026-08-14T14:00:20.000Z');
    const harness = createHarness([new Date('2026-08-14T14:00:00.000Z'), occurredAt]);
    harness.transaction.timePunch.findFirst.mockResolvedValueOnce({
      occurredAt: new Date('2026-08-14T14:00:00.000Z'),
    });

    await expect(harness.service.createEmployeePunch(employee, key)).rejects.toMatchObject({
      status: 409,
      response: { code: 'DUPLICATE_PUNCH_WINDOW' },
    });
    expect(harness.transaction.timePunch.create).not.toHaveBeenCalled();
  });

  it('rejects a future administrative insertion after acquiring the stream lock', async () => {
    const harness = createHarness([
      new Date('2026-08-14T14:00:00.000Z'),
      new Date('2026-08-14T15:00:00.000Z'),
    ]);

    await expect(
      harness.service.insertManualPunch(
        admin,
        {
          employeeId: employee.id,
          occurredAt: '2026-08-14T16:00:00.000Z',
          reason: 'Saída esquecida',
        },
        key,
        context,
      ),
    ).rejects.toMatchObject({ status: 400, response: { code: 'FUTURE_TIME_PUNCH' } });
    expect(harness.locksShape.lockEmployeeStream).toHaveBeenCalledOnce();
    expect(harness.transaction.timePunch.create).not.toHaveBeenCalled();
  });

  it('derives the manual kind from locked chronology and couples audit and completion', async () => {
    const evaluationInstant = new Date('2026-08-14T20:00:00.000Z');
    const harness = createHarness([new Date('2026-08-14T19:59:00.000Z'), evaluationInstant]);
    harness.effectiveShape.listForBusinessDate.mockResolvedValueOnce([
      existingPunch(new Date('2026-08-14T11:00:00.000Z'), TimePunchKind.CLOCK_IN),
    ]);

    const result = await harness.service.insertManualPunch(
      admin,
      {
        employeeId: employee.id,
        occurredAt: '2026-08-14T15:00:00.000Z',
        reason: 'Saída para almoço esquecida',
      },
      key,
      context,
    );

    expect(result.body.punch.kind).toBe(TimePunchKind.CLOCK_OUT);
    expect(result.body.auditEventId).toBe('audit-event-id');
    expect(harness.auditShape.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'TIME_PUNCH_INSERTED' }),
      transactionLike(harness.transaction),
    );
    expect(harness.idempotencyShape.complete).toHaveBeenCalledOnce();
  });
});

function transactionLike<T>(transaction: T): T {
  return transaction;
}
