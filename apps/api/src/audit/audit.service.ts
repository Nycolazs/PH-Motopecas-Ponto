import { BadRequestException, Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import {
  AuditOutcome,
  type AuditAction,
  type AuditTargetType,
  type Prisma,
} from '../generated/prisma/client.js';
import type { AuditLogListViewDto, AuditLogViewDto, ListAuditLogsQueryDto } from './audit.dto.js';

type SafeAuditValue = string | number | boolean | null;
export type SafeAuditObject = Record<string, SafeAuditValue>;

export interface AuditEvent {
  actorId: string | null;
  action: AuditAction;
  outcome?: AuditOutcome;
  targetType: AuditTargetType;
  targetId?: string;
  requestId?: string;
  ipHash?: string;
  userAgent?: string;
  beforeState?: SafeAuditObject;
  afterState?: SafeAuditObject;
  metadata?: SafeAuditObject;
}

const auditLogSelect = {
  id: true,
  action: true,
  outcome: true,
  targetType: true,
  targetId: true,
  requestId: true,
  beforeState: true,
  afterState: true,
  metadata: true,
  createdAt: true,
  actor: { select: { id: true, name: true, login: true } },
} satisfies Prisma.AuditLogSelect;

@Injectable()
export class AuditService {
  public constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  public async record(
    event: AuditEvent,
    transactionClient?: Prisma.TransactionClient,
  ): Promise<string> {
    const client = transactionClient ?? this.prisma;
    const data: Prisma.AuditLogUncheckedCreateInput = {
      actorId: event.actorId,
      action: event.action,
      outcome: event.outcome ?? AuditOutcome.SUCCESS,
      targetType: event.targetType,
      ...(event.targetId === undefined ? {} : { targetId: event.targetId.slice(0, 120) }),
      ...(event.requestId === undefined ? {} : { requestId: event.requestId.slice(0, 64) }),
      ...(event.ipHash === undefined ? {} : { ipHash: event.ipHash.slice(0, 64) }),
      ...(event.userAgent === undefined ? {} : { userAgent: event.userAgent.slice(0, 512) }),
      ...(event.beforeState === undefined
        ? {}
        : { beforeState: event.beforeState as Prisma.InputJsonObject }),
      ...(event.afterState === undefined
        ? {}
        : { afterState: event.afterState as Prisma.InputJsonObject }),
      ...(event.metadata === undefined
        ? {}
        : { metadata: event.metadata as Prisma.InputJsonObject }),
    };
    const auditLog = await client.auditLog.create({ data, select: { id: true } });
    return auditLog.id;
  }

  public async list(query: ListAuditLogsQueryDto): Promise<AuditLogListViewDto> {
    const from = query.from === undefined ? undefined : new Date(query.from);
    const to = query.to === undefined ? undefined : new Date(query.to);

    if (from !== undefined && to !== undefined && from > to) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: 'A data inicial deve ser anterior à data final.',
      });
    }

    const where: Prisma.AuditLogWhereInput = {
      ...(query.action === undefined ? {} : { action: query.action }),
      ...(query.outcome === undefined ? {} : { outcome: query.outcome }),
      ...(query.targetType === undefined ? {} : { targetType: query.targetType }),
      ...(query.actorId === undefined ? {} : { actorId: query.actorId }),
      ...(query.targetId === undefined ? {} : { targetId: query.targetId }),
      ...(from === undefined && to === undefined
        ? {}
        : {
            createdAt: {
              ...(from === undefined ? {} : { gte: from }),
              ...(to === undefined ? {} : { lte: to }),
            },
          }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        select: auditLogSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: items.map((item): AuditLogViewDto => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
      })),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }
}
