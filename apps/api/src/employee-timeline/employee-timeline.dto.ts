import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  type DocumentTypeDto,
  type EmployeeTimelineItemDto,
  type PaginatedTimelineDto,
  type TimelineCategoryDto,
} from '@ph-ponto/shared';

const TIMELINE_CATEGORIES: TimelineCategoryDto[] = [
  'ALL',
  'EMPLOYMENT',
  'ROLE',
  'DOCUMENT',
  'ACCESS',
  'VACATION',
  'DISCIPLINE',
  'EVALUATION',
];

export class ListTimelineQueryDto {
  @ApiPropertyOptional({ enum: TIMELINE_CATEGORIES, default: 'ALL' })
  @IsOptional()
  @IsIn(TIMELINE_CATEGORIES)
  public category?: TimelineCategoryDto;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  public limit: number = 50;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  public offset: number = 0;
}

export class EmployeeTimelineItemResponseDto implements EmployeeTimelineItemDto {
  @ApiProperty({ example: 'evt-11111111-1111-4111-8111-111111111111' })
  public id!: string;

  @ApiProperty({
    enum: ['EMPLOYMENT', 'ROLE', 'DOCUMENT', 'ACCESS', 'VACATION', 'DISCIPLINE', 'EVALUATION'],
  })
  public category!:
    'EMPLOYMENT' | 'ROLE' | 'DOCUMENT' | 'ACCESS' | 'VACATION' | 'DISCIPLINE' | 'EVALUATION';

  @ApiProperty({ example: 'Admissão de Colaborador' })
  public title!: string;

  @ApiPropertyOptional({ nullable: true })
  public description?: string | null;

  @ApiProperty({ format: 'date-time' })
  public occurredAt!: string;

  @ApiPropertyOptional({ example: '2026-09-25', nullable: true })
  public businessDate?: string | null;

  @ApiPropertyOptional({ nullable: true })
  public actorName?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  public documentId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  public documentType?: DocumentTypeDto | null;

  @ApiPropertyOptional({ nullable: true })
  public metadata?: Record<string, unknown> | null;
}

export class PaginatedTimelineResponseDto implements PaginatedTimelineDto {
  @ApiProperty({ type: [EmployeeTimelineItemResponseDto] })
  public items!: EmployeeTimelineItemResponseDto[];

  @ApiProperty({ example: 12 })
  public total!: number;

  @ApiProperty({ example: 50 })
  public limit!: number;

  @ApiProperty({ example: 0 })
  public offset!: number;
}
