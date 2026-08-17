import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
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
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Weekday } from '../generated/prisma/client.js';
import { BUSINESS_DATE_PATTERN } from './business-date.js';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class BusinessScheduleDayInputDto {
  @ApiProperty({ enum: Weekday })
  @IsEnum(Weekday)
  public weekday!: Weekday;

  @ApiProperty()
  @IsBoolean()
  public isOpen!: boolean;

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

export class CreateBusinessScheduleDto {
  @ApiProperty({ example: '2026-09-01', pattern: '^\\d{4}-\\d{2}-\\d{2}$' })
  @IsString()
  @Matches(BUSINESS_DATE_PATTERN)
  @IsISO8601({ strict: true })
  public effectiveDate!: string;

  @ApiPropertyOptional({ maxLength: 240, nullable: true })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(240)
  public note?: string;

  @ApiProperty({ type: [BusinessScheduleDayInputDto], minItems: 7, maxItems: 7 })
  @IsArray()
  @ArrayMinSize(7)
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => BusinessScheduleDayInputDto)
  public days!: BusinessScheduleDayInputDto[];
}

export class ListBusinessSchedulesQueryDto {
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
}

export class ResolveBusinessScheduleQueryDto {
  @ApiProperty({ example: '2026-09-01', pattern: '^\\d{4}-\\d{2}-\\d{2}$' })
  @IsString()
  @Matches(BUSINESS_DATE_PATTERN)
  @IsISO8601({ strict: true })
  public businessDate!: string;
}
