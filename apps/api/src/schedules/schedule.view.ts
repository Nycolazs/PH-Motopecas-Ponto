import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Weekday, type Prisma } from '../generated/prisma/client.js';
import { databaseDateToBusinessDate } from './business-date.js';
import { calculateExpectedMinutes } from './business-hours.js';

export const scheduleSelect = {
  id: true,
  effectiveDate: true,
  note: true,
  createdAt: true,
  createdBy: { select: { id: true, name: true, login: true } },
  days: {
    select: {
      weekday: true,
      isOpen: true,
      openingMinute: true,
      closingMinute: true,
      lunchEnabled: true,
      lunchStartMinute: true,
      lunchEndMinute: true,
    },
    orderBy: { weekday: 'asc' },
  },
} satisfies Prisma.BusinessScheduleVersionSelect;

export type ScheduleRecord = Prisma.BusinessScheduleVersionGetPayload<{
  select: typeof scheduleSelect;
}>;

export class ScheduleCreatorViewDto {
  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiProperty()
  public name!: string;

  @ApiProperty()
  public login!: string;
}

export class BusinessScheduleDayViewDto {
  @ApiProperty({ enum: Weekday })
  public weekday!: Weekday;

  @ApiProperty()
  public isOpen!: boolean;

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

export class BusinessScheduleViewDto {
  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiProperty({ example: '2026-09-01' })
  public effectiveDate!: string;

  @ApiPropertyOptional({ nullable: true })
  public note!: string | null;

  @ApiProperty({ type: ScheduleCreatorViewDto })
  public createdBy!: ScheduleCreatorViewDto;

  @ApiProperty({ type: [BusinessScheduleDayViewDto] })
  public days!: BusinessScheduleDayViewDto[];

  @ApiProperty({ format: 'date-time' })
  public createdAt!: string;
}

export class BusinessSchedulePaginationDto {
  @ApiProperty()
  public page!: number;

  @ApiProperty()
  public limit!: number;

  @ApiProperty()
  public total!: number;

  @ApiProperty()
  public totalPages!: number;
}

export class BusinessScheduleListViewDto {
  @ApiProperty({ type: [BusinessScheduleViewDto] })
  public items!: BusinessScheduleViewDto[];

  @ApiProperty({ type: BusinessSchedulePaginationDto })
  public pagination!: BusinessSchedulePaginationDto;
}

export class ResolvedBusinessScheduleViewDto {
  @ApiProperty({ example: '2026-09-01' })
  public businessDate!: string;

  @ApiProperty({ format: 'uuid' })
  public scheduleVersionId!: string;

  @ApiProperty({ example: '2026-09-01' })
  public effectiveDate!: string;

  @ApiProperty({ type: BusinessScheduleDayViewDto })
  public day!: BusinessScheduleDayViewDto;
}

export function toScheduleDayView(
  day: Omit<BusinessScheduleDayViewDto, 'expectedMinutes'>,
): BusinessScheduleDayViewDto {
  return { ...day, expectedMinutes: calculateExpectedMinutes(day) };
}

export function toBusinessScheduleView(schedule: ScheduleRecord): BusinessScheduleViewDto {
  return {
    id: schedule.id,
    effectiveDate: databaseDateToBusinessDate(schedule.effectiveDate),
    note: schedule.note,
    createdBy: schedule.createdBy,
    days: schedule.days.map(toScheduleDayView),
    createdAt: schedule.createdAt.toISOString(),
  };
}
