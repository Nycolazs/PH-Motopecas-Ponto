import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import { CalendarExceptionOperation, type Prisma } from '../generated/prisma/client.js';
import { businessDateToDatabaseDate } from '../schedules/business-date.js';
import { assertBusinessDate } from '../schedules/schedule.validation.js';
import {
  calendarExceptionRevisionSelect,
  exceptionExpectedMinutes,
  type ResolvedCalendarExceptionViewDto,
} from './calendar-exception.view.js';

@Injectable()
export class CalendarExceptionResolverService {
  public constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  public async resolveForDate(
    businessDate: string,
    transactionClient?: Prisma.TransactionClient,
  ): Promise<ResolvedCalendarExceptionViewDto | null> {
    assertBusinessDate(businessDate);
    const client = transactionClient ?? this.prisma;
    const exception = await client.calendarException.findUnique({
      where: { businessDate: businessDateToDatabaseDate(businessDate) },
      select: {
        id: true,
        revisions: {
          select: calendarExceptionRevisionSelect,
          orderBy: { sequence: 'desc' },
          take: 1,
        },
      },
    });
    const revision = exception?.revisions[0];
    if (
      exception === null ||
      revision === undefined ||
      revision.operation === CalendarExceptionOperation.RETRACT
    ) {
      return null;
    }

    const expectedMinutes = exceptionExpectedMinutes(revision);
    if (revision.kind === null || revision.name === null || expectedMinutes === null) {
      throw new RangeError('Active calendar exception has an invalid revision');
    }

    return {
      calendarExceptionId: exception.id,
      businessDate,
      revisionId: revision.id,
      sequence: revision.sequence,
      kind: revision.kind,
      name: revision.name,
      openingMinute: revision.openingMinute,
      closingMinute: revision.closingMinute,
      lunchEnabled: revision.lunchEnabled,
      lunchStartMinute: revision.lunchStartMinute,
      lunchEndMinute: revision.lunchEndMinute,
      expectedMinutes,
    };
  }
}
