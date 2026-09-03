import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { instantRangeForBusinessDate } from '@ph-ponto/shared';

import { AuditService } from '../audit/audit.service.js';
import { toDailyAttendanceView } from '../attendance/attendance.view.js';
import type { AuthenticatedUser, ClientContext } from '../auth/auth.types.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  AuditAction,
  AuditTargetType,
  IdempotencyOperation,
  TimePunchKind,
  TimePunchOrigin,
  type Prisma,
} from '../generated/prisma/client.js';
import { IdempotencyService } from '../idempotency/idempotency.service.js';
import { MutationLockService } from '../idempotency/mutation-lock.service.js';
import {
  ATTENDANCE_SUMMARY_RESOLVER,
  type AttendanceSummaryResolver,
} from './attendance-summary.port.js';
import { businessDateFromInstant } from './business-date.js';
import { TIME_PUNCH_CLOCK, type TimePunchClock } from './clock.js';
import type {
  AdminTimePunchMutationResponseDto,
  ManualTimePunchDto,
  TimePunchMutationResponseDto,
  TimePunchViewDto,
} from './time-punch.dto.js';
import {
  EffectiveTimePunchService,
  type EffectiveTimePunch,
} from './effective-time-punch.service.js';
import { toIdempotencyJson, type MutationHttpResult } from './time-punch.types.js';

const DUPLICATE_WINDOW_MILLISECONDS = 30_000;
const CREATED_STATUS = 201;

function normalizeReason(reason: string): string {
  const normalized = reason.trim();
  if (normalized.length === 0) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Informe o motivo da inclusão manual.',
    });
  }

  return normalized;
}

function chronologyConflict(): ConflictException {
  return new ConflictException({
    code: 'PUNCH_CHRONOLOGY_CONFLICT',
    message: 'O horário informado entra em conflito com a sequência de pontos.',
  });
}

function databaseCode(error: unknown, depth = 0): string | undefined {
  if (depth > 5 || typeof error !== 'object' || error === null) {
    return undefined;
  }

  for (const property of ['code', 'originalCode', 'sqlState'] as const) {
    const value = (error as Record<string, unknown>)[property];
    if (typeof value === 'string') {
      if (value === '23514' || value === '23505') {
        return value;
      }
    }
  }

  for (const property of ['cause', 'meta', 'driverAdapterError'] as const) {
    const nested = databaseCode((error as Record<string, unknown>)[property], depth + 1);
    if (nested !== undefined) {
      return nested;
    }
  }

  return undefined;
}

function toPunchView(punch: EffectiveTimePunch): TimePunchViewDto {
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

function createdPunch(input: {
  id: string;
  employeeId: string;
  occurredAt: Date;
  kind: TimePunchKind;
  origin: TimePunchOrigin;
  createdByAdminId: string | null;
  insertionReason: string | null;
  createdAt: Date;
}): EffectiveTimePunch {
  return {
    ...input,
    originalOccurredAt: input.occurredAt,
    effectiveOccurredAt: input.occurredAt,
    adjustmentSequence: 0,
  };
}

@Injectable()
export class TimePunchService {
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

  public async createEmployeePunch(
    actor: AuthenticatedUser,
    idempotencyKey: string,
  ): Promise<MutationHttpResult<TimePunchMutationResponseDto>> {
    const claimInstant = this.clock();

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const start = await this.idempotency.begin<TimePunchMutationResponseDto>(transaction, {
          actorId: actor.id,
          requiredRole: 'EMPLOYEE',
          operation: IdempotencyOperation.CREATE_TIME_PUNCH,
          key: idempotencyKey,
          fingerprintPayload: { action: 'create-own-time-punch' },
          now: claimInstant,
        });
        if (start.kind === 'REPLAY') {
          return { body: start.response, replayed: true };
        }

        await this.locks.lockEmployee(transaction, actor.id, true);
        await this.locks.lockEmployeeStream(transaction, actor.id);

        const occurredAt = this.clock();
        const businessDate = businessDateFromInstant(occurredAt);
        await this.rejectDuplicateEmployeePunch(transaction, actor.id, occurredAt);
        const currentPunches = await this.effectivePunches.listForBusinessDate(
          actor.id,
          businessDate,
          transaction,
        );
        const latest = currentPunches.at(-1);
        if (latest !== undefined && latest.effectiveOccurredAt.getTime() >= occurredAt.getTime()) {
          throw chronologyConflict();
        }

        const kind =
          currentPunches.length % 2 === 0 ? TimePunchKind.CLOCK_IN : TimePunchKind.CLOCK_OUT;
        const persisted = await transaction.timePunch.create({
          data: {
            employeeId: actor.id,
            occurredAt,
            kind,
            origin: TimePunchOrigin.EMPLOYEE,
            idempotencyRecordId: start.recordId,
            createdAt: occurredAt,
          },
          select: { id: true },
        });
        const punch = createdPunch({
          id: persisted.id,
          employeeId: actor.id,
          occurredAt,
          kind,
          origin: TimePunchOrigin.EMPLOYEE,
          createdByAdminId: null,
          insertionReason: null,
          createdAt: occurredAt,
        });
        const dailySummary = await this.summaries.resolveDaily({
          employeeId: actor.id,
          businessDate,
          evaluationInstant: occurredAt,
          transaction,
        });
        const response: TimePunchMutationResponseDto = {
          punch: toPunchView(punch),
          dailySummary: toDailyAttendanceView(dailySummary),
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
      if (databaseCode(error) !== undefined) {
        throw chronologyConflict();
      }

      throw error;
    }
  }

  public async insertManualPunch(
    actor: AuthenticatedUser,
    input: ManualTimePunchDto,
    idempotencyKey: string,
    context: ClientContext,
  ): Promise<MutationHttpResult<AdminTimePunchMutationResponseDto>> {
    const occurredAt = new Date(input.occurredAt);
    const reason = normalizeReason(input.reason);
    const claimInstant = this.clock();
    const fingerprintPayload = {
      employeeId: input.employeeId,
      occurredAt: occurredAt.toISOString(),
      reason,
    };

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const start = await this.idempotency.begin<AdminTimePunchMutationResponseDto>(transaction, {
          actorId: actor.id,
          requiredRole: 'ADMIN',
          operation: IdempotencyOperation.INSERT_TIME_PUNCH,
          key: idempotencyKey,
          fingerprintPayload,
          now: claimInstant,
        });
        if (start.kind === 'REPLAY') {
          return { body: start.response, replayed: true };
        }

        await this.locks.lockEmployee(transaction, input.employeeId, false);
        await this.locks.lockEmployeeStream(transaction, input.employeeId);

        const evaluationInstant = this.clock();
        if (occurredAt.getTime() > evaluationInstant.getTime()) {
          throw new BadRequestException({
            code: 'FUTURE_TIME_PUNCH',
            message: 'Não é possível inserir um ponto em uma data ou horário futuro.',
          });
        }

        const businessDate = businessDateFromInstant(occurredAt);
        const currentPunches = await this.effectivePunches.listForBusinessDate(
          input.employeeId,
          businessDate,
          transaction,
        );
        const insertionIndex = currentPunches.findIndex(
          (punch) => punch.effectiveOccurredAt.getTime() >= occurredAt.getTime(),
        );
        if (
          insertionIndex >= 0 &&
          currentPunches[insertionIndex]!.effectiveOccurredAt.getTime() === occurredAt.getTime()
        ) {
          throw chronologyConflict();
        }

        const position = insertionIndex === -1 ? currentPunches.length : insertionIndex;
        const kind = position % 2 === 0 ? TimePunchKind.CLOCK_IN : TimePunchKind.CLOCK_OUT;
        const persisted = await transaction.timePunch.create({
          data: {
            employeeId: input.employeeId,
            occurredAt,
            kind,
            origin: TimePunchOrigin.ADMIN_INSERTION,
            createdByAdminId: actor.id,
            insertionReason: reason,
            idempotencyRecordId: start.recordId,
            createdAt: evaluationInstant,
          },
          select: { id: true },
        });

        const { start: dateStart, endExclusive: dateEndExclusive } =
          instantRangeForBusinessDate(businessDate);
        const allPunchesOnDate = await transaction.timePunch.findMany({
          where: {
            employeeId: input.employeeId,
            occurredAt: { gte: dateStart, lt: dateEndExclusive },
          },
          include: {
            adjustments: { orderBy: { sequence: 'desc' }, take: 1 },
          },
        });

        allPunchesOnDate.sort((a, b) => {
          const aEff = a.adjustments[0]?.correctedOccurredAt ?? a.occurredAt;
          const bEff = b.adjustments[0]?.correctedOccurredAt ?? b.occurredAt;
          const diff = aEff.getTime() - bEff.getTime();
          return diff === 0 ? a.id.localeCompare(b.id) : diff;
        });

        for (let i = 0; i < allPunchesOnDate.length; i++) {
          const expectedKind = i % 2 === 0 ? TimePunchKind.CLOCK_IN : TimePunchKind.CLOCK_OUT;
          if (allPunchesOnDate[i]!.kind !== expectedKind) {
            await transaction.timePunch.update({
              where: { id: allPunchesOnDate[i]!.id },
              data: { kind: expectedKind },
            });
          }
        }
        const punch = createdPunch({
          id: persisted.id,
          employeeId: input.employeeId,
          occurredAt,
          kind,
          origin: TimePunchOrigin.ADMIN_INSERTION,
          createdByAdminId: actor.id,
          insertionReason: reason,
          createdAt: evaluationInstant,
        });
        const dailySummary = await this.summaries.resolveDaily({
          employeeId: input.employeeId,
          businessDate,
          evaluationInstant,
          transaction,
        });
        const employeeRecord = await transaction.user.findUnique({
          where: { id: input.employeeId },
          select: { name: true, login: true },
        });

        const auditEventId = await this.audit.record(
          {
            actorId: actor.id,
            action: AuditAction.TIME_PUNCH_INSERTED,
            targetType: AuditTargetType.TIME_PUNCH,
            targetId: persisted.id,
            ...context,
            afterState: {
              employeeId: input.employeeId,
              employeeName: employeeRecord?.name ?? null,
              employeeLogin: employeeRecord?.login ?? null,
              occurredAt: occurredAt.toISOString(),
              kind,
              origin: TimePunchOrigin.ADMIN_INSERTION,
            },
            metadata: {
              reason,
              employeeName: employeeRecord?.name ?? null,
              employeeLogin: employeeRecord?.login ?? null,
            },
          },
          transaction,
        );
        const response: AdminTimePunchMutationResponseDto = {
          punch: toPunchView(punch),
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
      if (databaseCode(error) !== undefined) {
        throw chronologyConflict();
      }

      throw error;
    }
  }

  public async deletePunch(
    actor: AuthenticatedUser,
    punchId: string,
    context: ClientContext,
  ): Promise<{ success: boolean; message: string; auditEventId: string }> {
    const existing = await this.prisma.timePunch.findUnique({
      where: { id: punchId },
      include: {
        employee: { select: { id: true, name: true } },
        adjustments: { orderBy: { sequence: 'asc' } },
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Ponto não encontrado.',
      });
    }

    const employeeId = existing.employeeId;
    const businessDate = businessDateFromInstant(existing.occurredAt);
    const { start, endExclusive } = instantRangeForBusinessDate(businessDate);

    const auditEventId = await this.prisma.$transaction(async (transaction) => {
      await this.locks.lockEmployee(transaction, employeeId, false);
      await this.locks.lockEmployeeStream(transaction, employeeId);

      // Delete adjustment requests associated with this punch
      await transaction.timePunchAdjustmentRequest.deleteMany({
        where: { timePunchId: punchId },
      });

      // Delete adjustments associated with this punch
      await transaction.timeAdjustment.deleteMany({
        where: { timePunchId: punchId },
      });

      // Delete the punch itself
      await transaction.timePunch.delete({
        where: { id: punchId },
      });

      // Re-align kinds of remaining punches for this employee on that date
      const remainingPunches = await transaction.timePunch.findMany({
        where: {
          employeeId,
          occurredAt: { gte: start, lt: endExclusive },
        },
        include: {
          adjustments: { orderBy: { sequence: 'desc' }, take: 1 },
        },
      });

      remainingPunches.sort((a, b) => {
        const aEff = a.adjustments[0]?.correctedOccurredAt ?? a.occurredAt;
        const bEff = b.adjustments[0]?.correctedOccurredAt ?? b.occurredAt;
        const diff = aEff.getTime() - bEff.getTime();
        return diff === 0 ? a.id.localeCompare(b.id) : diff;
      });

      for (let i = 0; i < remainingPunches.length; i++) {
        const expectedKind = i % 2 === 0 ? TimePunchKind.CLOCK_IN : TimePunchKind.CLOCK_OUT;
        if (remainingPunches[i]!.kind !== expectedKind) {
          await transaction.timePunch.update({
            where: { id: remainingPunches[i]!.id },
            data: { kind: expectedKind },
          });
        }
      }

      const effectiveLastOccurredAt =
        existing.adjustments.at(-1)?.correctedOccurredAt ?? existing.occurredAt;

      return this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.TIME_PUNCH_DELETED,
          targetType: AuditTargetType.TIME_PUNCH,
          targetId: punchId,
          ...context,
          beforeState: {
            employeeId,
            employeeName: existing.employee.name,
            occurredAt: existing.occurredAt.toISOString(),
            effectiveOccurredAt: effectiveLastOccurredAt.toISOString(),
            kind: existing.kind,
            origin: existing.origin,
            adjustmentsCount: existing.adjustments.length,
          },
          metadata: {
            businessDate,
            employeeId,
          },
        },
        transaction,
      );
    });

    return {
      success: true,
      message: 'Batida de ponto excluída com sucesso.',
      auditEventId,
    };
  }

  private async rejectDuplicateEmployeePunch(
    transaction: Prisma.TransactionClient,
    employeeId: string,
    occurredAt: Date,
  ): Promise<void> {
    const prior = await transaction.timePunch.findFirst({
      where: {
        employeeId,
        origin: TimePunchOrigin.EMPLOYEE,
        occurredAt: {
          gte: new Date(occurredAt.getTime() - DUPLICATE_WINDOW_MILLISECONDS),
          lte: occurredAt,
        },
      },
      select: { occurredAt: true },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    });
    if (
      prior !== null &&
      occurredAt.getTime() - prior.occurredAt.getTime() < DUPLICATE_WINDOW_MILLISECONDS
    ) {
      throw new ConflictException({
        code: 'DUPLICATE_PUNCH_WINDOW',
        message: 'Aguarde alguns instantes antes de bater o ponto novamente.',
      });
    }
  }
}
