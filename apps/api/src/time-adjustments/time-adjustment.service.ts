import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuditService } from '../audit/audit.service.js';
import { toDailyAttendanceView } from '../attendance/attendance.view.js';
import type { AuthenticatedUser, ClientContext } from '../auth/auth.types.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  AuditAction,
  AuditTargetType,
  IdempotencyOperation,
  type Prisma,
  type TimePunchKind,
  type TimePunchOrigin,
} from '../generated/prisma/client.js';
import { IdempotencyService } from '../idempotency/idempotency.service.js';
import { MutationLockService } from '../idempotency/mutation-lock.service.js';
import {
  ATTENDANCE_SUMMARY_RESOLVER,
  type AttendanceSummaryResolver,
} from '../time-punches/attendance-summary.port.js';
import { businessDateFromInstant } from '../time-punches/business-date.js';
import { TIME_PUNCH_CLOCK, type TimePunchClock } from '../time-punches/clock.js';
import {
  EffectiveTimePunchService,
  type EffectiveTimePunch,
} from '../time-punches/effective-time-punch.service.js';
import type { AdminTimePunchMutationResponseDto } from '../time-punches/time-punch.dto.js';
import { toIdempotencyJson, type MutationHttpResult } from '../time-punches/time-punch.types.js';
import type { CorrectTimePunchDto } from './time-adjustment.dto.js';

const CREATED_STATUS = 201;

interface LockedPunchRow {
  id: string;
  employeeId: string;
  occurredAt: Date;
  kind: TimePunchKind;
  origin: TimePunchOrigin;
  createdByAdminId: string | null;
  insertionReason: string | null;
  createdAt: Date;
}

interface LockedAdjustmentRow {
  sequence: number;
  correctedOccurredAt: Date;
}

function normalizeReason(reason: string): string {
  const normalized = reason.trim();
  if (normalized.length === 0) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Informe o motivo da correção.',
    });
  }

  return normalized;
}

function resourceNotFound(): NotFoundException {
  return new NotFoundException({
    code: 'RESOURCE_NOT_FOUND',
    message: 'Ponto não encontrado.',
  });
}

function staleAdjustment(): ConflictException {
  return new ConflictException({
    code: 'STALE_ADJUSTMENT_VERSION',
    message: 'Este ponto foi alterado. Atualize os dados antes de corrigir novamente.',
  });
}

function chronologyConflict(): ConflictException {
  return new ConflictException({
    code: 'PUNCH_CHRONOLOGY_CONFLICT',
    message: 'O novo horário entra em conflito com a sequência de pontos.',
  });
}

function databaseConstraintCode(error: unknown, depth = 0): string | undefined {
  if (depth > 5 || typeof error !== 'object' || error === null) {
    return undefined;
  }

  for (const property of ['code', 'originalCode', 'sqlState'] as const) {
    const value = (error as Record<string, unknown>)[property];
    if (value === '23514' || value === '23505') {
      return value;
    }
  }

  for (const property of ['cause', 'meta', 'driverAdapterError'] as const) {
    const nested = databaseConstraintCode((error as Record<string, unknown>)[property], depth + 1);
    if (nested !== undefined) {
      return nested;
    }
  }

  return undefined;
}

function toView(punch: EffectiveTimePunch) {
  return {
    id: punch.id,
    employeeId: punch.employeeId,
    occurredAt: punch.originalOccurredAt.toISOString(),
    effectiveOccurredAt: punch.effectiveOccurredAt.toISOString(),
    kind: punch.kind,
    origin: punch.origin,
    createdByAdminId: punch.createdByAdminId,
    insertionReason: punch.insertionReason,
    adjustmentSequence: punch.adjustmentSequence,
    createdAt: punch.createdAt.toISOString(),
  };
}

@Injectable()
export class TimeAdjustmentService {
  public constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
    @Inject(MutationLockService) private readonly locks: MutationLockService,
    @Inject(EffectiveTimePunchService)
    private readonly effectivePunches: EffectiveTimePunchService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(ATTENDANCE_SUMMARY_RESOLVER)
    private readonly summaries: AttendanceSummaryResolver,
    @Inject(TIME_PUNCH_CLOCK) private readonly clock: TimePunchClock,
  ) {}

  public async correct(
    actor: AuthenticatedUser,
    punchId: string,
    input: CorrectTimePunchDto,
    idempotencyKey: string,
    context: ClientContext,
  ): Promise<MutationHttpResult<AdminTimePunchMutationResponseDto>> {
    const correctedOccurredAt = new Date(input.correctedOccurredAt);
    const expectedCurrentOccurredAt = new Date(input.expectedCurrentOccurredAt);
    const reason = normalizeReason(input.reason);
    const employeeId = await this.effectivePunches.findEmployeeIdForPunch(punchId);
    if (employeeId === undefined) {
      throw resourceNotFound();
    }

    const claimInstant = this.clock();
    const fingerprintPayload = {
      punchId,
      correctedOccurredAt: correctedOccurredAt.toISOString(),
      expectedCurrentOccurredAt: expectedCurrentOccurredAt.toISOString(),
      expectedSequence: input.expectedSequence,
      reason,
    };

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const start = await this.idempotency.begin<AdminTimePunchMutationResponseDto>(transaction, {
          actorId: actor.id,
          requiredRole: 'ADMIN',
          operation: IdempotencyOperation.ADJUST_TIME_PUNCH,
          key: idempotencyKey,
          fingerprintPayload,
          now: claimInstant,
        });
        if (start.kind === 'REPLAY') {
          return { body: start.response, replayed: true };
        }

        await this.locks.lockEmployee(transaction, employeeId, false);
        await this.locks.lockEmployeeStream(transaction, employeeId);
        const target = await this.lockTarget(transaction, punchId, employeeId);
        const adjustments = await this.lockAdjustments(transaction, punchId);
        const latest = adjustments.at(-1);
        const currentOccurredAt = latest?.correctedOccurredAt ?? target.occurredAt;
        const currentSequence = latest?.sequence ?? 0;
        if (
          currentSequence !== input.expectedSequence ||
          currentOccurredAt.getTime() !== expectedCurrentOccurredAt.getTime()
        ) {
          throw staleAdjustment();
        }

        const businessDate = businessDateFromInstant(target.occurredAt);
        if (
          correctedOccurredAt.getTime() === currentOccurredAt.getTime() ||
          businessDateFromInstant(correctedOccurredAt) !== businessDate
        ) {
          throw chronologyConflict();
        }

        const dayPunches = await this.effectivePunches.listForBusinessDate(
          employeeId,
          businessDate,
          transaction,
        );
        const targetIndex = dayPunches.findIndex((punch) => punch.id === punchId);
        if (targetIndex < 0) {
          throw resourceNotFound();
        }

        const previous = dayPunches[targetIndex - 1];
        const next = dayPunches[targetIndex + 1];
        if (
          (previous !== undefined &&
            correctedOccurredAt.getTime() <= previous.effectiveOccurredAt.getTime()) ||
          (next !== undefined &&
            correctedOccurredAt.getTime() >= next.effectiveOccurredAt.getTime())
        ) {
          throw chronologyConflict();
        }

        const evaluationInstant = this.clock();
        if (correctedOccurredAt.getTime() > evaluationInstant.getTime()) {
          throw new BadRequestException({
            code: 'FUTURE_TIME_ADJUSTMENT',
            message: 'Não é possível corrigir um ponto para um horário futuro.',
          });
        }

        const sequence = currentSequence + 1;
        await transaction.timeAdjustment.create({
          data: {
            timePunchId: punchId,
            sequence,
            previousOccurredAt: currentOccurredAt,
            correctedOccurredAt,
            reason,
            adminId: actor.id,
            idempotencyRecordId: start.recordId,
            createdAt: evaluationInstant,
          },
        });
        const effectivePunch: EffectiveTimePunch = {
          id: target.id,
          employeeId: target.employeeId,
          originalOccurredAt: target.occurredAt,
          effectiveOccurredAt: correctedOccurredAt,
          kind: target.kind,
          origin: target.origin,
          createdByAdminId: target.createdByAdminId,
          insertionReason: target.insertionReason,
          adjustmentSequence: sequence,
          createdAt: target.createdAt,
        };
        const dailySummary = await this.summaries.resolveDaily({
          employeeId,
          businessDate,
          evaluationInstant,
          transaction,
        });
        const auditEventId = await this.audit.record(
          {
            actorId: actor.id,
            action: AuditAction.TIME_PUNCH_CORRECTED,
            targetType: AuditTargetType.TIME_PUNCH,
            targetId: punchId,
            ...context,
            beforeState: {
              occurredAt: currentOccurredAt.toISOString(),
              sequence: currentSequence,
            },
            afterState: {
              occurredAt: correctedOccurredAt.toISOString(),
              sequence,
            },
            metadata: { reason },
          },
          transaction,
        );
        const response: AdminTimePunchMutationResponseDto = {
          punch: toView(effectivePunch),
          dailySummary: toDailyAttendanceView(dailySummary),
          auditEventId,
          idempotencyKey,
        };
        await this.idempotency.complete(
          transaction,
          start.recordId,
          CREATED_STATUS,
          toIdempotencyJson(response),
        );
        return { body: response, replayed: false };
      });
    } catch (error) {
      if (databaseConstraintCode(error) !== undefined) {
        throw chronologyConflict();
      }

      throw error;
    }
  }

  private async lockTarget(
    transaction: Prisma.TransactionClient,
    punchId: string,
    employeeId: string,
  ): Promise<LockedPunchRow> {
    const rows = await transaction.$queryRaw<LockedPunchRow[]>`
      SELECT
        "id",
        "employee_id" AS "employeeId",
        "occurred_at" AS "occurredAt",
        "kind",
        "origin",
        "created_by_admin_id" AS "createdByAdminId",
        "insertion_reason" AS "insertionReason",
        "created_at" AS "createdAt"
      FROM "time_punches"
      WHERE "id" = ${punchId}::uuid AND "employee_id" = ${employeeId}::uuid
      FOR UPDATE
    `;
    const target = rows[0];
    if (target === undefined) {
      throw resourceNotFound();
    }

    return target;
  }

  private async lockAdjustments(
    transaction: Prisma.TransactionClient,
    punchId: string,
  ): Promise<LockedAdjustmentRow[]> {
    return transaction.$queryRaw<LockedAdjustmentRow[]>`
      SELECT "sequence", "corrected_occurred_at" AS "correctedOccurredAt"
      FROM "time_adjustments"
      WHERE "time_punch_id" = ${punchId}::uuid
      ORDER BY "sequence" ASC
      FOR UPDATE
    `;
  }
}
