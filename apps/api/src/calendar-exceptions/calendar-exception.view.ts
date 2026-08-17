import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  CalendarExceptionKind,
  CalendarExceptionOperation,
  type Prisma,
} from '../generated/prisma/client.js';
import { databaseDateToBusinessDate } from '../schedules/business-date.js';
import { calculateExpectedMinutes } from '../schedules/business-hours.js';

export const calendarExceptionRevisionSelect = {
  id: true,
  sequence: true,
  operation: true,
  kind: true,
  name: true,
  openingMinute: true,
  closingMinute: true,
  lunchEnabled: true,
  lunchStartMinute: true,
  lunchEndMinute: true,
  createdAt: true,
  createdBy: { select: { id: true, name: true, login: true } },
} satisfies Prisma.CalendarExceptionRevisionSelect;

export type CalendarExceptionRevisionRecord = Prisma.CalendarExceptionRevisionGetPayload<{
  select: typeof calendarExceptionRevisionSelect;
}>;

export class CalendarExceptionAuthorViewDto {
  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiProperty()
  public name!: string;

  @ApiProperty()
  public login!: string;
}

export class CalendarExceptionRevisionViewDto {
  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiProperty({ minimum: 1 })
  public sequence!: number;

  @ApiProperty({ enum: CalendarExceptionOperation })
  public operation!: CalendarExceptionOperation;

  @ApiPropertyOptional({ enum: CalendarExceptionKind, nullable: true })
  public kind!: CalendarExceptionKind | null;

  @ApiPropertyOptional({ nullable: true })
  public name!: string | null;

  @ApiPropertyOptional({ nullable: true })
  public openingMinute!: number | null;

  @ApiPropertyOptional({ nullable: true })
  public closingMinute!: number | null;

  @ApiProperty()
  public lunchEnabled!: boolean;

  @ApiPropertyOptional({ nullable: true })
  public lunchStartMinute!: number | null;

  @ApiPropertyOptional({ nullable: true })
  public lunchEndMinute!: number | null;

  @ApiPropertyOptional({ minimum: 0, nullable: true })
  public expectedMinutes!: number | null;

  @ApiProperty({ type: CalendarExceptionAuthorViewDto })
  public createdBy!: CalendarExceptionAuthorViewDto;

  @ApiProperty({ format: 'date-time' })
  public createdAt!: string;
}

export class CalendarExceptionViewDto {
  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiProperty({ example: '2026-09-07' })
  public businessDate!: string;

  @ApiProperty()
  public isActive!: boolean;

  @ApiProperty({ type: CalendarExceptionRevisionViewDto })
  public latestRevision!: CalendarExceptionRevisionViewDto;

  @ApiProperty({ minimum: 1 })
  public revisionCount!: number;

  @ApiProperty({ format: 'date-time' })
  public createdAt!: string;
}

export class CalendarExceptionDetailViewDto extends CalendarExceptionViewDto {
  @ApiProperty({ type: [CalendarExceptionRevisionViewDto] })
  public revisions!: CalendarExceptionRevisionViewDto[];
}

export class CalendarExceptionPaginationDto {
  @ApiProperty()
  public page!: number;

  @ApiProperty()
  public limit!: number;

  @ApiProperty()
  public total!: number;

  @ApiProperty()
  public totalPages!: number;
}

export class CalendarExceptionListViewDto {
  @ApiProperty({ type: [CalendarExceptionViewDto] })
  public items!: CalendarExceptionViewDto[];

  @ApiProperty({ type: CalendarExceptionPaginationDto })
  public pagination!: CalendarExceptionPaginationDto;
}

export class ResolvedCalendarExceptionViewDto {
  @ApiProperty({ format: 'uuid' })
  public calendarExceptionId!: string;

  @ApiProperty({ example: '2026-09-07' })
  public businessDate!: string;

  @ApiProperty({ format: 'uuid' })
  public revisionId!: string;

  @ApiProperty({ minimum: 1 })
  public sequence!: number;

  @ApiProperty({ enum: CalendarExceptionKind })
  public kind!: CalendarExceptionKind;

  @ApiProperty()
  public name!: string;

  @ApiPropertyOptional({ nullable: true })
  public openingMinute!: number | null;

  @ApiPropertyOptional({ nullable: true })
  public closingMinute!: number | null;

  @ApiProperty()
  public lunchEnabled!: boolean;

  @ApiPropertyOptional({ nullable: true })
  public lunchStartMinute!: number | null;

  @ApiPropertyOptional({ nullable: true })
  public lunchEndMinute!: number | null;

  @ApiProperty({ minimum: 0 })
  public expectedMinutes!: number;
}

export function exceptionExpectedMinutes(
  revision: Pick<
    CalendarExceptionRevisionRecord,
    | 'operation'
    | 'kind'
    | 'openingMinute'
    | 'closingMinute'
    | 'lunchEnabled'
    | 'lunchStartMinute'
    | 'lunchEndMinute'
  >,
): number | null {
  if (revision.operation === CalendarExceptionOperation.RETRACT) {
    return null;
  }

  if (
    revision.kind === CalendarExceptionKind.HOLIDAY ||
    revision.kind === CalendarExceptionKind.CLOSED
  ) {
    return 0;
  }

  return calculateExpectedMinutes({ ...revision, isOpen: true });
}

export function toCalendarExceptionRevisionView(
  revision: CalendarExceptionRevisionRecord,
): CalendarExceptionRevisionViewDto {
  return {
    ...revision,
    expectedMinutes: exceptionExpectedMinutes(revision),
    createdAt: revision.createdAt.toISOString(),
  };
}

interface CalendarExceptionRecord {
  id: string;
  businessDate: Date;
  createdAt: Date;
  revisions: CalendarExceptionRevisionRecord[];
  _count: { revisions: number };
}

export function toCalendarExceptionView(record: CalendarExceptionRecord): CalendarExceptionViewDto {
  const latest = record.revisions[0];
  if (latest === undefined) {
    throw new RangeError('Calendar exception has no revision');
  }

  return {
    id: record.id,
    businessDate: databaseDateToBusinessDate(record.businessDate),
    isActive: latest.operation === CalendarExceptionOperation.UPSERT,
    latestRevision: toCalendarExceptionRevisionView(latest),
    revisionCount: record._count.revisions,
    createdAt: record.createdAt.toISOString(),
  };
}

export function toCalendarExceptionDetailView(
  record: CalendarExceptionRecord,
): CalendarExceptionDetailViewDto {
  return {
    ...toCalendarExceptionView(record),
    revisions: record.revisions.map(toCalendarExceptionRevisionView),
  };
}
