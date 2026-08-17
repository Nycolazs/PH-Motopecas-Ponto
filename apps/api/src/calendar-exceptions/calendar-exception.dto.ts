import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { CalendarExceptionKind } from '../generated/prisma/client.js';
import { BUSINESS_DATE_PATTERN } from '../schedules/business-date.js';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class UpsertCalendarExceptionDto {
  @ApiProperty({ example: '2026-09-07', pattern: '^\\d{4}-\\d{2}-\\d{2}$' })
  @IsString()
  @Matches(BUSINESS_DATE_PATTERN)
  @IsISO8601({ strict: true })
  public businessDate!: string;

  @ApiProperty({ enum: CalendarExceptionKind })
  @IsEnum(CalendarExceptionKind)
  public kind!: CalendarExceptionKind;

  @ApiProperty({ example: 'Independência do Brasil', minLength: 1, maxLength: 120 })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  public name!: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 1439, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_439)
  public openingMinute?: number | null;

  @ApiPropertyOptional({ minimum: 1, maximum: 1440, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_440)
  public closingMinute?: number | null;

  @ApiProperty()
  @IsBoolean()
  public lunchEnabled!: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 1439, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_439)
  public lunchStartMinute?: number | null;

  @ApiPropertyOptional({ minimum: 1, maximum: 1440, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_440)
  public lunchEndMinute?: number | null;
}

export class ListCalendarExceptionsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  public page = 1;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  public limit = 25;

  @ApiPropertyOptional({ example: '2026-01-01', pattern: '^\\d{4}-\\d{2}-\\d{2}$' })
  @IsOptional()
  @IsString()
  @Matches(BUSINESS_DATE_PATTERN)
  @IsISO8601({ strict: true })
  public from?: string;

  @ApiPropertyOptional({ example: '2026-12-31', pattern: '^\\d{4}-\\d{2}-\\d{2}$' })
  @IsOptional()
  @IsString()
  @Matches(BUSINESS_DATE_PATTERN)
  @IsISO8601({ strict: true })
  public to?: string;
}

export class ResolveCalendarExceptionQueryDto {
  @ApiProperty({ example: '2026-09-07', pattern: '^\\d{4}-\\d{2}-\\d{2}$' })
  @IsString()
  @Matches(BUSINESS_DATE_PATTERN)
  @IsISO8601({ strict: true })
  public businessDate!: string;
}
