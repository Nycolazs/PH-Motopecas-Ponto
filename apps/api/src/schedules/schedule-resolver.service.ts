import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  businessDateToDatabaseDate,
  databaseDateToBusinessDate,
  weekdayForBusinessDate,
} from './business-date.js';
import { assertBusinessDate } from './schedule.validation.js';
import { toScheduleDayView, type ResolvedBusinessScheduleViewDto } from './schedule.view.js';

@Injectable()
export class ScheduleResolverService {
  public constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  public async resolveForDate(
    businessDate: string,
    transactionClient?: Prisma.TransactionClient,
  ): Promise<ResolvedBusinessScheduleViewDto> {
    assertBusinessDate(businessDate);
    const weekday = weekdayForBusinessDate(businessDate);
    const client = transactionClient ?? this.prisma;
    const schedule = await client.businessScheduleVersion.findFirst({
      where: { effectiveDate: { lte: businessDateToDatabaseDate(businessDate) } },
      orderBy: { effectiveDate: 'desc' },
      select: {
        id: true,
        effectiveDate: true,
        days: {
          where: { weekday },
          select: {
            weekday: true,
            isOpen: true,
            openingMinute: true,
            closingMinute: true,
            lunchEnabled: true,
            lunchStartMinute: true,
            lunchEndMinute: true,
          },
          take: 1,
        },
      },
    });

    const day = schedule?.days[0];
    if (schedule === null || day === undefined) {
      throw new ServiceUnavailableException({
        code: 'SCHEDULE_NOT_CONFIGURED',
        message: 'Não há horário de trabalho configurado para esta data.',
      });
    }

    return {
      businessDate,
      scheduleVersionId: schedule.id,
      effectiveDate: databaseDateToBusinessDate(schedule.effectiveDate),
      day: toScheduleDayView(day),
    };
  }
}
