import type { DailyAttendanceSummary } from '@ph-ponto/shared';
import { describe, expect, it, vi } from 'vitest';

import type { AuditService } from '../audit/audit.service.js';
import type { PrismaService } from '../database/prisma.service.js';
import { TimePunchKind, TimePunchOrigin } from '../generated/prisma/client.js';
import type { IdempotencyService } from '../idempotency/idempotency.service.js';
import type { MutationLockService } from '../idempotency/mutation-lock.service.js';
import type { AttendanceSummaryResolver } from '../time-punches/attendance-summary.port.js';
import type {
  EffectiveTimePunch,
  EffectiveTimePunchService,
} from '../time-punches/effective-time-punch.service.js';
import { TimeAdjustmentService } from './time-adjustment.service.js';

const admin = {
  id: 'ad49c9bd-9bde-4c4c-bcec-bf209a3d8507',
  name: 'Administrador',
  login: 'admin',
  role: 'ADMIN' as const,
  sessionId: '23144362-e369-49e4-9241-1920b05e32f7',
};
const employeeId = '487d962c-c34d-486b-83be-c1aac9772f9d';
const punchId = '74134cf8-b7ec-48a7-b7c1-6f9ce60c37ea';
const idempotencyKey = 'a46542bd-2149-46b9-99e8-46c580657f1a';
const context = { ipHash: 'a'.repeat(64), requestId: 'adjustment-test' };
const originalOccurredAt = new Date('2026-08-14T18:00:00.000Z');
const correctedOccurredAt = new Date('2026-08-14T20:00:00.000Z');

const summary = {
  businessDate: '2026-08-14',
  isFinalized: false,
  status: null,
  workState: 'OFF_DUTY',
  expectedMinutes: 480,
  workedMinutes: 480,
  balanceMinutes: 0,
  punchCount: 4,
  completedIntervalCount: 2,
  correctionCount: 1,
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
    punchCount: 4,
    completedIntervalCount: 2,
    hasOpenInterval: false,
    isIncomplete: false,
    workedMilliseconds: 28_800_000,
    workedMinutes: 480,
  },
} satisfies DailyAttendanceSummary;

function effectivePunch(
  id: string,
  occurredAt: Date,
  kind: TimePunchKind,
  adjustmentSequence = 0,
): EffectiveTimePunch {
  return {
    id,
    employeeId,
    originalOccurredAt: id === punchId ? originalOccurredAt : occurredAt,
    effectiveOccurredAt: occurredAt,
    kind,
    origin: TimePunchOrigin.EMPLOYEE,
    createdByAdminId: null,
    insertionReason: null,
    adjustmentSequence,
    createdAt: originalOccurredAt,
  };
}

function createHarness(options?: {
  clockValues?: Date[];
  currentAdjustments?: { sequence: number; correctedOccurredAt: Date }[];
  dayPunches?: EffectiveTimePunch[];
}) {
  const target = {
    id: punchId,
    employeeId,
    occurredAt: originalOccurredAt,
    kind: TimePunchKind.CLOCK_OUT,
    origin: TimePunchOrigin.EMPLOYEE,
    createdByAdminId: null,
    insertionReason: null,
    createdAt: originalOccurredAt,
  };
  const queryRaw = vi
    .fn()
    .mockResolvedValueOnce([target])
    .mockResolvedValueOnce(options?.currentAdjustments ?? []);
  const transaction = {
    $queryRaw: queryRaw,
    timeAdjustment: { create: vi.fn().mockResolvedValue({ id: 'adjustment-id' }) },
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
    findEmployeeIdForPunch: vi.fn().mockResolvedValue(employeeId),
    listForBusinessDate: vi
      .fn()
      .mockResolvedValue(
        options?.dayPunches ?? [
          effectivePunch(punchId, originalOccurredAt, TimePunchKind.CLOCK_OUT),
        ],
      ),
  };
  const summariesShape = { resolveDaily: vi.fn().mockResolvedValue(summary) };
  const auditShape = { record: vi.fn().mockResolvedValue('audit-event-id') };
  const clock = vi.fn<() => Date>();
  for (const value of options?.clockValues ?? [
    new Date('2026-08-14T20:59:00.000Z'),
    new Date('2026-08-14T21:00:00.000Z'),
  ]) {
    clock.mockReturnValueOnce(value);
  }
  const service = new TimeAdjustmentService(
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

describe('TimeAdjustmentService', () => {
  it('appends a correction, preserves the original punch, and completes audit atomically', async () => {
    const harness = createHarness();

    const result = await harness.service.correct(
      admin,
      punchId,
      {
        correctedOccurredAt: correctedOccurredAt.toISOString(),
        expectedCurrentOccurredAt: originalOccurredAt.toISOString(),
        expectedSequence: 0,
        reason: 'Saída corrigida conforme conferência',
      },
      idempotencyKey,
      context,
    );

    expect(result.replayed).toBe(false);
    expect(result.body.punch).toMatchObject({
      occurredAt: originalOccurredAt.toISOString(),
      effectiveOccurredAt: correctedOccurredAt.toISOString(),
      adjustmentSequence: 1,
    });
    expect(harness.transaction.timeAdjustment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        timePunchId: punchId,
        sequence: 1,
        previousOccurredAt: originalOccurredAt,
        correctedOccurredAt,
        adminId: admin.id,
      }),
    });
    expect(harness.summariesShape.resolveDaily).toHaveBeenCalledWith(
      expect.objectContaining({ employeeId, businessDate: '2026-08-14' }),
    );
    expect(harness.auditShape.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'TIME_PUNCH_CORRECTED',
        beforeState: expect.objectContaining({ sequence: 0 }),
        afterState: expect.objectContaining({ sequence: 1 }),
      }),
      harness.transaction,
    );
    expect(harness.idempotencyShape.complete).toHaveBeenCalledOnce();
  });

  it('rejects a stale expected correction without appending history', async () => {
    const harness = createHarness({
      currentAdjustments: [
        { sequence: 1, correctedOccurredAt: new Date('2026-08-14T19:00:00.000Z') },
      ],
    });

    await expect(
      harness.service.correct(
        admin,
        punchId,
        {
          correctedOccurredAt: correctedOccurredAt.toISOString(),
          expectedCurrentOccurredAt: originalOccurredAt.toISOString(),
          expectedSequence: 0,
          reason: 'Tentativa com versão antiga',
        },
        idempotencyKey,
        context,
      ),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: 'STALE_ADJUSTMENT_VERSION' },
    });
    expect(harness.transaction.timeAdjustment.create).not.toHaveBeenCalled();
  });

  it('rejects a correction that crosses the next effective punch', async () => {
    const nextId = '31cd5334-c448-4c68-8947-bd1f43359ef8';
    const harness = createHarness({
      dayPunches: [
        effectivePunch(punchId, originalOccurredAt, TimePunchKind.CLOCK_OUT),
        effectivePunch(nextId, new Date('2026-08-14T19:00:00.000Z'), TimePunchKind.CLOCK_IN),
      ],
    });

    await expect(
      harness.service.correct(
        admin,
        punchId,
        {
          correctedOccurredAt: correctedOccurredAt.toISOString(),
          expectedCurrentOccurredAt: originalOccurredAt.toISOString(),
          expectedSequence: 0,
          reason: 'Horário inválido',
        },
        idempotencyKey,
        context,
      ),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: 'PUNCH_CHRONOLOGY_CONFLICT' },
    });
    expect(harness.transaction.timeAdjustment.create).not.toHaveBeenCalled();
  });

  it('rejects a correction to a future server instant', async () => {
    const harness = createHarness({
      clockValues: [new Date('2026-08-14T19:59:00.000Z'), new Date('2026-08-14T20:00:00.000Z')],
    });

    await expect(
      harness.service.correct(
        admin,
        punchId,
        {
          correctedOccurredAt: '2026-08-14T20:30:00.000Z',
          expectedCurrentOccurredAt: originalOccurredAt.toISOString(),
          expectedSequence: 0,
          reason: 'Horário futuro',
        },
        idempotencyKey,
        context,
      ),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: 'FUTURE_TIME_ADJUSTMENT' },
    });
    expect(harness.locksShape.lockEmployeeStream).toHaveBeenCalledOnce();
    expect(harness.transaction.timeAdjustment.create).not.toHaveBeenCalled();
  });
});
