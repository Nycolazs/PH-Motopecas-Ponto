import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { AuditAction, AuditOutcome, AuditTargetType } from '../generated/prisma/client.js';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class ListAuditLogsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  public page = 1;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  public limit = 50;

  @ApiPropertyOptional({ enum: AuditAction })
  @IsOptional()
  @IsEnum(AuditAction)
  public action?: AuditAction;

  @ApiPropertyOptional({ enum: AuditOutcome })
  @IsOptional()
  @IsEnum(AuditOutcome)
  public outcome?: AuditOutcome;

  @ApiPropertyOptional({ enum: AuditTargetType })
  @IsOptional()
  @IsEnum(AuditTargetType)
  public targetType?: AuditTargetType;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  public actorId?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(120)
  public targetId?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601({ strict: true })
  public from?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601({ strict: true })
  public to?: string;
}

export class AuditActorViewDto {
  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiProperty()
  public name!: string;

  @ApiProperty()
  public login!: string;
}

export class AuditLogViewDto {
  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiProperty({ enum: AuditAction })
  public action!: AuditAction;

  @ApiProperty({ enum: AuditOutcome })
  public outcome!: AuditOutcome;

  @ApiProperty({ enum: AuditTargetType })
  public targetType!: AuditTargetType;

  @ApiProperty({ nullable: true })
  public targetId!: string | null;

  @ApiProperty({ type: AuditActorViewDto, nullable: true })
  public actor!: AuditActorViewDto | null;

  @ApiProperty({ maxLength: 64, nullable: true })
  public requestId!: string | null;

  @ApiProperty({ type: Object, nullable: true })
  public beforeState!: unknown;

  @ApiProperty({ type: Object, nullable: true })
  public afterState!: unknown;

  @ApiProperty({ type: Object, nullable: true })
  public metadata!: unknown;

  @ApiProperty({ format: 'date-time' })
  public createdAt!: string;
}

export class AuditLogPaginationDto {
  @ApiProperty()
  public page!: number;

  @ApiProperty()
  public limit!: number;

  @ApiProperty()
  public total!: number;

  @ApiProperty()
  public totalPages!: number;
}

export class AuditLogListViewDto {
  @ApiProperty({ type: [AuditLogViewDto] })
  public items!: AuditLogViewDto[];

  @ApiProperty({ type: AuditLogPaginationDto })
  public pagination!: AuditLogPaginationDto;
}
