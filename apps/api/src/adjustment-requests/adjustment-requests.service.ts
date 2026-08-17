import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser, ClientContext } from '../auth/auth.types.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  AdjustmentRequestStatus,
  AuditAction,
  AuditTargetType,
  type Prisma,
} from '../generated/prisma/client.js';
import { businessDateFromInstant } from '../time-punches/business-date.js';
import { TIME_PUNCH_CLOCK, type TimePunchClock } from '../time-punches/clock.js';
import { TimeAdjustmentService } from '../time-adjustments/time-adjustment.service.js';
import type {
  CreateAdjustmentRequestDto,
  ListAdjustmentRequestsQueryDto,
  ReviewAdjustmentRequestDto,
} from './adjustment-request.dto.js';
import {
  adjustmentRequestSelect,
  toAdjustmentRequestView,
  type AdjustmentRequestListViewDto,
  type AdjustmentRequestViewDto,
  type PendingCountViewDto,
  type ReviewAdjustmentResponseDto,
} from './adjustment-request.view.js';

@Injectable()
export class AdjustmentRequestsService {
  public constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TimeAdjustmentService)
    private readonly timeAdjustments: TimeAdjustmentService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(TIME_PUNCH_CLOCK) private readonly clock: TimePunchClock,
  ) {}

  public async create(
    actor: AuthenticatedUser,
    input: CreateAdjustmentRequestDto,
    context: ClientContext,
  ): Promise<AdjustmentRequestViewDto> {
    const requestedOccurredAt = new Date(input.requestedOccurredAt);
    const reason = input.reason.trim();
    if (!reason) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Informe a justificativa para a solicitação de ajuste.',
      });
    }

    const now = this.clock();
    if (requestedOccurredAt.getTime() > now.getTime()) {
      throw new BadRequestException({
        code: 'FUTURE_TIME_ADJUSTMENT',
        message: 'Não é possível solicitar ajuste para um horário futuro.',
      });
    }

    // Verify punch exists and belongs to the authenticated employee
    const targetPunch = await this.prisma.timePunch.findFirst({
      where: {
        id: input.timePunchId,
        employeeId: actor.id,
      },
      include: {
        adjustments: {
          orderBy: { sequence: 'asc' },
        },
      },
    });

    if (!targetPunch) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Ponto não encontrado ou não pertence ao usuário.',
      });
    }

    // Check if there is already a PENDING request for this timePunch
    const existingPending = await this.prisma.timePunchAdjustmentRequest.findFirst({
      where: {
        timePunchId: input.timePunchId,
        status: AdjustmentRequestStatus.PENDING,
      },
    });

    if (existingPending) {
      throw new ConflictException({
        code: 'PENDING_REQUEST_EXISTS',
        message: 'Já existe uma solicitação de ajuste pendente de aprovação para este ponto.',
      });
    }

    const latestAdjustment = targetPunch.adjustments.at(-1);
    const currentOccurredAt = latestAdjustment?.correctedOccurredAt ?? targetPunch.occurredAt;
    const currentSequence = latestAdjustment?.sequence ?? 0;

    const punchBusinessDate = businessDateFromInstant(targetPunch.occurredAt);
    const requestedBusinessDate = businessDateFromInstant(requestedOccurredAt);

    if (punchBusinessDate !== requestedBusinessDate) {
      throw new BadRequestException({
        code: 'DATE_MISMATCH',
        message: 'O horário do ajuste deve pertencer ao mesmo dia de trabalho do ponto original.',
      });
    }

    if (currentOccurredAt.getTime() === requestedOccurredAt.getTime()) {
      throw new BadRequestException({
        code: 'NO_TIME_CHANGE',
        message: 'O horário solicitado é idêntico ao horário atual do ponto.',
      });
    }

    const created = await this.prisma.$transaction(async (transaction) => {
      const record = await transaction.timePunchAdjustmentRequest.create({
        data: {
          timePunchId: input.timePunchId,
          employeeId: actor.id,
          status: AdjustmentRequestStatus.PENDING,
          requestedOccurredAt,
          currentOccurredAt,
          currentSequence,
          reason,
          createdAt: now,
        },
        select: adjustmentRequestSelect,
      });

      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.ADJUSTMENT_REQUEST_CREATED,
          targetType: AuditTargetType.ADJUSTMENT_REQUEST,
          targetId: record.id,
          ...context,
          afterState: {
            timePunchId: record.timePunchId,
            requestedOccurredAt: record.requestedOccurredAt.toISOString(),
            reason,
          },
        },
        transaction,
      );

      return record;
    });

    return toAdjustmentRequestView(created);
  }

  public async listMine(
    actor: AuthenticatedUser,
    query: ListAdjustmentRequestsQueryDto,
  ): Promise<AdjustmentRequestListViewDto> {
    const where: Prisma.TimePunchAdjustmentRequestWhereInput = {
      employeeId: actor.id,
      ...(query.status ? { status: query.status } : {}),
    };

    const skip = (query.page - 1) * query.limit;
    const [total, items] = await Promise.all([
      this.prisma.timePunchAdjustmentRequest.count({ where }),
      this.prisma.timePunchAdjustmentRequest.findMany({
        where,
        select: adjustmentRequestSelect,
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
      }),
    ]);

    return {
      items: items.map(toAdjustmentRequestView),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  public async listAll(
    query: ListAdjustmentRequestsQueryDto,
  ): Promise<AdjustmentRequestListViewDto> {
    const where: Prisma.TimePunchAdjustmentRequestWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
    };

    const skip = (query.page - 1) * query.limit;
    const [total, items] = await Promise.all([
      this.prisma.timePunchAdjustmentRequest.count({ where }),
      this.prisma.timePunchAdjustmentRequest.findMany({
        where,
        select: adjustmentRequestSelect,
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
      }),
    ]);

    return {
      items: items.map(toAdjustmentRequestView),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  public async getPendingCount(): Promise<PendingCountViewDto> {
    const pendingCount = await this.prisma.timePunchAdjustmentRequest.count({
      where: { status: AdjustmentRequestStatus.PENDING },
    });
    return { pendingCount };
  }

  public async approve(
    actor: AuthenticatedUser,
    requestId: string,
    input: ReviewAdjustmentRequestDto,
    idempotencyKey: string,
    context: ClientContext,
  ): Promise<ReviewAdjustmentResponseDto> {
    const request = await this.prisma.timePunchAdjustmentRequest.findUnique({
      where: { id: requestId },
      select: adjustmentRequestSelect,
    });

    if (!request) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Solicitação de ajuste não encontrada.',
      });
    }

    if (request.status !== AdjustmentRequestStatus.PENDING) {
      throw new ConflictException({
        code: 'REQUEST_ALREADY_REVIEWED',
        message: `Esta solicitação já foi ${request.status === AdjustmentRequestStatus.APPROVED ? 'aprovada' : 'rejeitada'}.`,
      });
    }

    const now = this.clock();
    const comment = input.adminComment?.trim() || null;
    const adjustmentReason = `Ajuste solicitado pelo funcionário: "${request.reason}"${comment ? ` | Parecer do admin: "${comment}"` : ''}`;

    // Execute the immutable time adjustment
    const mutationResult = await this.timeAdjustments.correct(
      actor,
      request.timePunchId,
      {
        correctedOccurredAt: request.requestedOccurredAt.toISOString(),
        expectedCurrentOccurredAt: request.currentOccurredAt.toISOString(),
        expectedSequence: request.currentSequence,
        reason: adjustmentReason,
      },
      idempotencyKey,
      context,
    );

    // Find the newly created adjustment record
    const latestAdjustment = await this.prisma.timeAdjustment.findFirst({
      where: { timePunchId: request.timePunchId },
      orderBy: { sequence: 'desc' },
    });

    const updated = await this.prisma.$transaction(async (transaction) => {
      const record = await transaction.timePunchAdjustmentRequest.update({
        where: { id: requestId },
        data: {
          status: AdjustmentRequestStatus.APPROVED,
          reviewedById: actor.id,
          reviewedAt: now,
          reviewComment: comment,
          timeAdjustmentId: latestAdjustment?.id ?? null,
        },
        select: adjustmentRequestSelect,
      });

      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.ADJUSTMENT_REQUEST_APPROVED,
          targetType: AuditTargetType.ADJUSTMENT_REQUEST,
          targetId: requestId,
          ...context,
          beforeState: { status: AdjustmentRequestStatus.PENDING },
          afterState: {
            status: AdjustmentRequestStatus.APPROVED,
            reviewedById: actor.id,
            reviewComment: comment,
          },
        },
        transaction,
      );

      return record;
    });

    return {
      request: toAdjustmentRequestView(updated),
      punchMutation: mutationResult.body,
    };
  }

  public async reject(
    actor: AuthenticatedUser,
    requestId: string,
    input: ReviewAdjustmentRequestDto,
    context: ClientContext,
  ): Promise<ReviewAdjustmentResponseDto> {
    const request = await this.prisma.timePunchAdjustmentRequest.findUnique({
      where: { id: requestId },
      select: adjustmentRequestSelect,
    });

    if (!request) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Solicitação de ajuste não encontrada.',
      });
    }

    if (request.status !== AdjustmentRequestStatus.PENDING) {
      throw new ConflictException({
        code: 'REQUEST_ALREADY_REVIEWED',
        message: `Esta solicitação já foi ${request.status === AdjustmentRequestStatus.APPROVED ? 'aprovada' : 'rejeitada'}.`,
      });
    }

    const now = this.clock();
    const comment = input.adminComment?.trim() || null;

    const updated = await this.prisma.$transaction(async (transaction) => {
      const record = await transaction.timePunchAdjustmentRequest.update({
        where: { id: requestId },
        data: {
          status: AdjustmentRequestStatus.REJECTED,
          reviewedById: actor.id,
          reviewedAt: now,
          reviewComment: comment,
        },
        select: adjustmentRequestSelect,
      });

      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.ADJUSTMENT_REQUEST_REJECTED,
          targetType: AuditTargetType.ADJUSTMENT_REQUEST,
          targetId: requestId,
          ...context,
          beforeState: { status: AdjustmentRequestStatus.PENDING },
          afterState: {
            status: AdjustmentRequestStatus.REJECTED,
            reviewedById: actor.id,
            reviewComment: comment,
          },
        },
        transaction,
      );

      return record;
    });

    return {
      request: toAdjustmentRequestView(updated),
    };
  }
}
