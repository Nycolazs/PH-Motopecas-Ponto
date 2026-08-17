import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { businessDateFromInstant } from '@ph-ponto/shared';

import type { AuthenticatedUser, ClientContext } from '../auth/auth.types.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { AuditAction, AuditTargetType } from '../generated/prisma/client.js';
import { businessDateToDatabaseDate } from './business-date.js';
import { calculateExpectedMinutes } from './business-hours.js';
import { SCHEDULE_CLOCK, type ScheduleClock } from './schedule-clock.js';
import type { CreateBusinessScheduleDto, ListBusinessSchedulesQueryDto } from './schedule.dto.js';
import { assertBusinessDate, assertValidScheduleDays } from './schedule.validation.js';
import {
  scheduleSelect,
  toBusinessScheduleView,
  type BusinessScheduleListViewDto,
  type BusinessScheduleViewDto,
} from './schedule.view.js';

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

@Injectable()
export class SchedulesService {
  public constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(SCHEDULE_CLOCK) private readonly clock: ScheduleClock,
  ) {}

  public async create(
    actor: AuthenticatedUser,
    input: CreateBusinessScheduleDto,
    context: ClientContext,
  ): Promise<BusinessScheduleViewDto> {
    assertBusinessDate(input.effectiveDate);
    if (input.effectiveDate < businessDateFromInstant(this.clock())) {
      throw new ConflictException({
        code: 'SCHEDULE_EFFECTIVE_DATE_IN_PAST',
        message: 'A vigência do novo horário não pode estar no passado.',
      });
    }

    const days = input.days.map((day) => ({
      weekday: day.weekday,
      isOpen: day.isOpen,
      openingMinute: day.openingMinute ?? null,
      closingMinute: day.closingMinute ?? null,
      lunchEnabled: day.lunchEnabled,
      lunchStartMinute: day.lunchStartMinute ?? null,
      lunchEndMinute: day.lunchEndMinute ?? null,
    }));
    assertValidScheduleDays(days);

    try {
      const schedule = await this.prisma.$transaction(async (transaction) => {
        await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('ph-ponto:schedule-stream'))::text AS acquired`;
        const latest = await transaction.businessScheduleVersion.findFirst({
          select: { effectiveDate: true },
          orderBy: { effectiveDate: 'desc' },
        });
        if (
          latest !== null &&
          latest.effectiveDate >= businessDateToDatabaseDate(input.effectiveDate)
        ) {
          throw new ConflictException({
            code: 'SCHEDULE_EFFECTIVE_DATE_NOT_AFTER_LATEST',
            message: 'A nova vigência deve ser posterior à versão mais recente do horário.',
          });
        }

        const normalizedNote =
          typeof input.note === 'string' && input.note.trim().length > 0 ? input.note.trim() : null;
        const created = await transaction.businessScheduleVersion.create({
          data: {
            effectiveDate: businessDateToDatabaseDate(input.effectiveDate),
            note: normalizedNote,
            createdById: actor.id,
            days: { create: days },
          },
          select: scheduleSelect,
        });
        const weeklyExpectedMinutes = created.days.reduce(
          (total, day) => total + calculateExpectedMinutes(day),
          0,
        );
        await this.audit.record(
          {
            actorId: actor.id,
            action: AuditAction.SCHEDULE_CREATED,
            targetType: AuditTargetType.SCHEDULE,
            targetId: created.id,
            ...context,
            afterState: {
              effectiveDate: input.effectiveDate,
              note: created.note,
              weeklyExpectedMinutes,
            },
          },
          transaction,
        );
        return created;
      });
      return toBusinessScheduleView(schedule);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException({
          code: 'SCHEDULE_DATE_ALREADY_EXISTS',
          message: 'Já existe um horário com esta data de vigência.',
        });
      }

      throw error;
    }
  }

  public async list(query: ListBusinessSchedulesQueryDto): Promise<BusinessScheduleListViewDto> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.businessScheduleVersion.findMany({
        select: scheduleSelect,
        orderBy: [{ effectiveDate: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.businessScheduleVersion.count(),
    ]);

    return {
      items: items.map(toBusinessScheduleView),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  public async get(scheduleId: string): Promise<BusinessScheduleViewDto> {
    const schedule = await this.prisma.businessScheduleVersion.findUnique({
      where: { id: scheduleId },
      select: scheduleSelect,
    });
    if (schedule === null) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Horário de trabalho não encontrado.',
      });
    }

    return toBusinessScheduleView(schedule);
  }
}
