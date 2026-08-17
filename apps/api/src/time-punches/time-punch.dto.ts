import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

import { DailyAttendanceViewDto } from '../attendance/attendance.view.js';
import type { TimePunchKind, TimePunchOrigin } from '../generated/prisma/client.js';

const EXPLICIT_OFFSET_PATTERN = /(?:Z|[+-]\d{2}:\d{2})$/;

export class EmptyTimePunchDto {}

export class ManualTimePunchDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  public employeeId!: string;

  @ApiProperty({ format: 'date-time', example: '2026-08-14T08:00:00-03:00' })
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(EXPLICIT_OFFSET_PATTERN)
  public occurredAt!: string;

  @ApiProperty({ minLength: 1, maxLength: 500 })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  public reason!: string;
}

export class TimePunchViewDto {
  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiProperty({ format: 'uuid' })
  public employeeId!: string;

  @ApiProperty({ format: 'date-time' })
  public occurredAt!: string;

  @ApiProperty({ format: 'date-time' })
  public effectiveOccurredAt!: string;

  @ApiProperty({ enum: ['CLOCK_IN', 'CLOCK_OUT'] })
  public kind!: TimePunchKind;

  @ApiProperty({ enum: ['EMPLOYEE', 'ADMIN_INSERTION'] })
  public origin!: TimePunchOrigin;

  @ApiProperty({ nullable: true, format: 'uuid' })
  public createdByAdminId!: string | null;

  @ApiProperty({ nullable: true })
  public insertionReason!: string | null;

  @ApiProperty()
  public adjustmentSequence!: number;

  @ApiProperty({ format: 'date-time' })
  public createdAt!: string;
}

export class TimePunchMutationResponseDto {
  @ApiProperty({ type: TimePunchViewDto })
  public punch!: TimePunchViewDto;

  @ApiProperty({ type: DailyAttendanceViewDto })
  public dailySummary!: DailyAttendanceViewDto;

  @ApiProperty({ format: 'uuid' })
  public idempotencyKey!: string;
}

export class AdminTimePunchMutationResponseDto extends TimePunchMutationResponseDto {
  @ApiProperty({ format: 'uuid' })
  public auditEventId!: string;
}
