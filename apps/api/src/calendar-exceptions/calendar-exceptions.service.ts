import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { AuthenticatedUser, ClientContext } from '../auth/auth.types.js';
import { AuditService, type SafeAuditObject } from '../audit/audit.service.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  AuditAction,
  AuditTargetType,
  CalendarExceptionOperation,
  type Prisma,
} from '../generated/prisma/client.js';
import {
  businessDateToDatabaseDate,
  databaseDateToBusinessDate,
} from '../schedules/business-date.js';
import { assertBusinessDate } from '../schedules/schedule.validation.js';
import type {
  ListCalendarExceptionsQueryDto,
  UpsertCalendarExceptionDto,
} from './calendar-exception.dto.js';
import { normalizeAndValidateCalendarException } from './calendar-exception.validation.js';
import {
  calendarExceptionRevisionSelect,
  exceptionExpectedMinutes,
  toCalendarExceptionDetailView,
  toCalendarExceptionView,
  type CalendarExceptionDetailViewDto,
  type CalendarExceptionListViewDto,
  type CalendarExceptionRevisionRecord,
} from './calendar-exception.view.js';

const exceptionListSelect = {
  id: true,
  businessDate: true,
  createdAt: true,
  revisions: {
    select: calendarExceptionRevisionSelect,
    orderBy: { sequence: 'desc' },
    take: 1,
  },
  _count: { select: { revisions: true } },
} satisfies Prisma.CalendarExceptionSelect;

const exceptionDetailSelect = {
  ...exceptionListSelect,
  revisions: {
    select: calendarExceptionRevisionSelect,
    orderBy: { sequence: 'desc' },
  },
} satisfies Prisma.CalendarExceptionSelect;

function resourceNotFound(): NotFoundException {
  return new NotFoundException({
    code: 'RESOURCE_NOT_FOUND',
    message: 'Exceção de calendário não encontrada.',
  });
}

function revisionAuditState(
  businessDate: string,
  revision: CalendarExceptionRevisionRecord,
): SafeAuditObject {
  return {
    businessDate,
    sequence: revision.sequence,
    operation: revision.operation,
    kind: revision.kind,
    name: revision.name,
    openingMinute: revision.openingMinute,
    closingMinute: revision.closingMinute,
    lunchEnabled: revision.lunchEnabled,
    lunchStartMinute: revision.lunchStartMinute,
    lunchEndMinute: revision.lunchEndMinute,
    expectedMinutes: exceptionExpectedMinutes(revision),
  };
}

@Injectable()
export class CalendarExceptionsService {
  public constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  public async upsert(
    actor: AuthenticatedUser,
    input: UpsertCalendarExceptionDto,
    context: ClientContext,
  ): Promise<CalendarExceptionDetailViewDto> {
    assertBusinessDate(input.businessDate);
    const normalized = normalizeAndValidateCalendarException(input);
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('ph-ponto:calendar-exception-stream'))::text AS acquired`;
      const existing = await transaction.calendarException.findUnique({
        where: { businessDate: businessDateToDatabaseDate(normalized.businessDate) },
        select: { id: true },
      });
      const beforeRevision =
        existing === null
          ? null
          : await transaction.calendarExceptionRevision.findFirst({
              where: { calendarExceptionId: existing.id },
              orderBy: { sequence: 'desc' },
              select: calendarExceptionRevisionSelect,
            });
      const sequence = (beforeRevision?.sequence ?? 0) + 1;
      const exception =
        existing === null
          ? await transaction.calendarException.create({
              data: {
                businessDate: businessDateToDatabaseDate(normalized.businessDate),
                revisions: {
                  create: {
                    sequence,
                    operation: CalendarExceptionOperation.UPSERT,
                    kind: normalized.kind,
                    name: normalized.name,
                    openingMinute: normalized.openingMinute,
                    closingMinute: normalized.closingMinute,
                    lunchEnabled: normalized.lunchEnabled,
                    lunchStartMinute: normalized.lunchStartMinute,
                    lunchEndMinute: normalized.lunchEndMinute,
                    createdById: actor.id,
                  },
                },
              },
              select: exceptionDetailSelect,
            })
          : await this.appendUpsertRevision(
              transaction,
              existing.id,
              sequence,
              actor.id,
              normalized,
            );
      const latestRevision = exception.revisions[0];
      if (latestRevision === undefined) {
        throw new RangeError('Calendar exception has no revision');
      }

      await this.audit.record(
        {
          actorId: actor.id,
          action:
            existing === null
              ? AuditAction.CALENDAR_EXCEPTION_CREATED
              : AuditAction.CALENDAR_EXCEPTION_UPDATED,
          targetType: AuditTargetType.CALENDAR_EXCEPTION,
          targetId: exception.id,
          ...context,
          ...(beforeRevision === null
            ? {}
            : { beforeState: revisionAuditState(normalized.businessDate, beforeRevision) }),
          afterState: revisionAuditState(normalized.businessDate, latestRevision),
        },
        transaction,
      );
      return toCalendarExceptionDetailView(exception);
    });
  }

  public async retract(
    actor: AuthenticatedUser,
    exceptionId: string,
    context: ClientContext,
  ): Promise<CalendarExceptionDetailViewDto> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('ph-ponto:calendar-exception-stream'))::text AS acquired`;
      const exceptionIdentity = await transaction.calendarException.findUnique({
        where: { id: exceptionId },
        select: { id: true, businessDate: true },
      });
      if (exceptionIdentity === null) {
        throw resourceNotFound();
      }

      await transaction.$queryRaw`SELECT id FROM calendar_exceptions WHERE id = ${exceptionId}::uuid FOR UPDATE`;
      const current = await transaction.calendarExceptionRevision.findFirst({
        where: { calendarExceptionId: exceptionId },
        orderBy: { sequence: 'desc' },
        select: calendarExceptionRevisionSelect,
      });
      if (current === null) {
        throw resourceNotFound();
      }
      if (current.operation === CalendarExceptionOperation.RETRACT) {
        throw new ConflictException({
          code: 'CALENDAR_EXCEPTION_ALREADY_RETRACTED',
          message: 'Esta exceção de calendário já está retraída.',
        });
      }

      await transaction.calendarExceptionRevision.create({
        data: {
          calendarExceptionId: exceptionId,
          sequence: current.sequence + 1,
          operation: CalendarExceptionOperation.RETRACT,
          kind: null,
          name: null,
          openingMinute: null,
          closingMinute: null,
          lunchEnabled: false,
          lunchStartMinute: null,
          lunchEndMinute: null,
          createdById: actor.id,
        },
        select: { id: true },
      });
      const exception = await transaction.calendarException.findUnique({
        where: { id: exceptionId },
        select: exceptionDetailSelect,
      });
      if (exception === null) {
        throw resourceNotFound();
      }
      const latestRevision = exception.revisions[0];
      if (latestRevision === undefined) {
        throw resourceNotFound();
      }
      const businessDate = databaseDateToBusinessDate(exceptionIdentity.businessDate);
      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.CALENDAR_EXCEPTION_RETRACTED,
          targetType: AuditTargetType.CALENDAR_EXCEPTION,
          targetId: exceptionId,
          ...context,
          beforeState: revisionAuditState(businessDate, current),
          afterState: revisionAuditState(businessDate, latestRevision),
        },
        transaction,
      );
      return toCalendarExceptionDetailView(exception);
    });
  }

  public async list(query: ListCalendarExceptionsQueryDto): Promise<CalendarExceptionListViewDto> {
    if (query.from !== undefined) {
      assertBusinessDate(query.from);
    }
    if (query.to !== undefined) {
      assertBusinessDate(query.to);
    }
    if (query.from !== undefined && query.to !== undefined && query.from > query.to) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: 'A data inicial deve ser anterior ou igual à data final.',
      });
    }

    const where: Prisma.CalendarExceptionWhereInput =
      query.from === undefined && query.to === undefined
        ? {}
        : {
            businessDate: {
              ...(query.from === undefined ? {} : { gte: businessDateToDatabaseDate(query.from) }),
              ...(query.to === undefined ? {} : { lte: businessDateToDatabaseDate(query.to) }),
            },
          };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.calendarException.findMany({
        where,
        select: exceptionListSelect,
        orderBy: [{ businessDate: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.calendarException.count({ where }),
    ]);

    return {
      items: items.map(toCalendarExceptionView),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  public async get(exceptionId: string): Promise<CalendarExceptionDetailViewDto> {
    const exception = await this.prisma.calendarException.findUnique({
      where: { id: exceptionId },
      select: exceptionDetailSelect,
    });
    if (exception === null) {
      throw resourceNotFound();
    }

    return toCalendarExceptionDetailView(exception);
  }

  private async appendUpsertRevision(
    transaction: Prisma.TransactionClient,
    exceptionId: string,
    sequence: number,
    actorId: string,
    input: ReturnType<typeof normalizeAndValidateCalendarException>,
  ) {
    await transaction.$queryRaw`SELECT id FROM calendar_exceptions WHERE id = ${exceptionId}::uuid FOR UPDATE`;
    await transaction.calendarExceptionRevision.create({
      data: {
        calendarExceptionId: exceptionId,
        sequence,
        operation: CalendarExceptionOperation.UPSERT,
        kind: input.kind,
        name: input.name,
        openingMinute: input.openingMinute,
        closingMinute: input.closingMinute,
        lunchEnabled: input.lunchEnabled,
        lunchStartMinute: input.lunchStartMinute,
        lunchEndMinute: input.lunchEndMinute,
        createdById: actorId,
      },
      select: { id: true },
    });
    const exception = await transaction.calendarException.findUnique({
      where: { id: exceptionId },
      select: exceptionDetailSelect,
    });
    if (exception === null) {
      throw resourceNotFound();
    }

    return exception;
  }
}
