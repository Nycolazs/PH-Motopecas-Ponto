import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  AdjustmentRequestStatus,
  type TimePunchKind,
  type Prisma,
} from '../generated/prisma/client.js';
import { AdminTimePunchMutationResponseDto } from '../time-punches/time-punch.dto.js';

export const adjustmentRequestSelect = {
  id: true,
  timePunchId: true,
  employeeId: true,
  status: true,
  requestedOccurredAt: true,
  currentOccurredAt: true,
  currentSequence: true,
  reason: true,
  reviewedById: true,
  reviewComment: true,
  reviewedAt: true,
  timeAdjustmentId: true,
  createdAt: true,
  updatedAt: true,
  employee: {
    select: {
      id: true,
      name: true,
      login: true,
    },
  },
  reviewedBy: {
    select: {
      id: true,
      name: true,
      login: true,
    },
  },
  timePunch: {
    select: {
      kind: true,
      occurredAt: true,
    },
  },
} satisfies Prisma.TimePunchAdjustmentRequestSelect;

export type AdjustmentRequestRecord = Prisma.TimePunchAdjustmentRequestGetPayload<{
  select: typeof adjustmentRequestSelect;
}>;

export class AdjustmentRequestAuthorDto {
  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiProperty()
  public name!: string;

  @ApiProperty()
  public login!: string;
}

export class AdjustmentRequestViewDto {
  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiProperty({ format: 'uuid' })
  public timePunchId!: string;

  @ApiProperty({ format: 'uuid' })
  public employeeId!: string;

  @ApiProperty({ type: AdjustmentRequestAuthorDto })
  public employee!: AdjustmentRequestAuthorDto;

  @ApiProperty({ enum: AdjustmentRequestStatus })
  public status!: AdjustmentRequestStatus;

  @ApiProperty({ enum: ['CLOCK_IN', 'CLOCK_OUT'] })
  public punchKind!: TimePunchKind;

  @ApiProperty({ format: 'date-time' })
  public currentOccurredAt!: string;

  @ApiProperty({ format: 'date-time' })
  public requestedOccurredAt!: string;

  @ApiProperty()
  public currentSequence!: number;

  @ApiProperty()
  public reason!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  public reviewedById!: string | null;

  @ApiPropertyOptional({ type: AdjustmentRequestAuthorDto, nullable: true })
  public reviewedBy!: AdjustmentRequestAuthorDto | null;

  @ApiPropertyOptional({ nullable: true })
  public reviewComment!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  public reviewedAt!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  public timeAdjustmentId!: string | null;

  @ApiProperty({ format: 'date-time' })
  public createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  public updatedAt!: string;
}

export class AdjustmentRequestPaginationDto {
  @ApiProperty()
  public page!: number;

  @ApiProperty()
  public limit!: number;

  @ApiProperty()
  public total!: number;

  @ApiProperty()
  public totalPages!: number;
}

export class AdjustmentRequestListViewDto {
  @ApiProperty({ type: [AdjustmentRequestViewDto] })
  public items!: AdjustmentRequestViewDto[];

  @ApiProperty({ type: AdjustmentRequestPaginationDto })
  public pagination!: AdjustmentRequestPaginationDto;
}

export class PendingCountViewDto {
  @ApiProperty({ example: 3 })
  public pendingCount!: number;
}

export class ReviewAdjustmentResponseDto {
  @ApiProperty({ type: AdjustmentRequestViewDto })
  public request!: AdjustmentRequestViewDto;

  @ApiPropertyOptional({ type: AdminTimePunchMutationResponseDto })
  public punchMutation?: AdminTimePunchMutationResponseDto;
}

export function toAdjustmentRequestView(record: AdjustmentRequestRecord): AdjustmentRequestViewDto {
  return {
    id: record.id,
    timePunchId: record.timePunchId,
    employeeId: record.employeeId,
    employee: {
      id: record.employee.id,
      name: record.employee.name,
      login: record.employee.login,
    },
    status: record.status,
    punchKind: record.timePunch.kind,
    currentOccurredAt: record.currentOccurredAt.toISOString(),
    requestedOccurredAt: record.requestedOccurredAt.toISOString(),
    currentSequence: record.currentSequence,
    reason: record.reason,
    reviewedById: record.reviewedById,
    reviewedBy: record.reviewedBy
      ? {
          id: record.reviewedBy.id,
          name: record.reviewedBy.name,
          login: record.reviewedBy.login,
        }
      : null,
    reviewComment: record.reviewComment,
    reviewedAt: record.reviewedAt ? record.reviewedAt.toISOString() : null,
    timeAdjustmentId: record.timeAdjustmentId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
