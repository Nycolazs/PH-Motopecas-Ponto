import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { AdjustmentRequestStatus } from '../generated/prisma/client.js';
import { BUSINESS_DATE_PATTERN } from '../schedules/business-date.js';

const EXPLICIT_OFFSET_PATTERN = /(?:Z|[+-]\d{2}:\d{2})$/;

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateAdjustmentRequestDto {
  @ApiProperty({ format: 'uuid', description: 'ID do ponto a ser corrigido' })
  @IsUUID()
  public timePunchId!: string;

  @ApiProperty({
    format: 'date-time',
    example: '2026-08-16T08:00:00-03:00',
    description: 'Novo horário pretendido com fuso horário explícito',
  })
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(EXPLICIT_OFFSET_PATTERN, {
    message:
      'O horário informado deve incluir indicador explícito de fuso horário (ex.: -03:00 ou Z).',
  })
  public requestedOccurredAt!: string;

  @ApiProperty({
    minLength: 1,
    maxLength: 500,
    example: 'Esqueci de registrar na entrada após o almoço.',
    description: 'Justificativa do funcionário para a solicitação de ajuste',
  })
  @Transform(trimString)
  @IsString()
  @MinLength(1, { message: 'Informe a justificativa do ajuste.' })
  @MaxLength(500, { message: 'A justificativa não pode ultrapassar 500 caracteres.' })
  public reason!: string;
}

export class ReviewAdjustmentRequestDto {
  @ApiPropertyOptional({
    maxLength: 500,
    example: 'Aprovado conforme verificado nas câmeras de acesso.',
    description: 'Comentário ou parecer do administrador',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(500, { message: 'O parecer não pode ultrapassar 500 caracteres.' })
  public adminComment?: string;
}

export class ListAdjustmentRequestsQueryDto {
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

  @ApiPropertyOptional({ enum: AdjustmentRequestStatus })
  @IsOptional()
  @IsEnum(AdjustmentRequestStatus)
  public status?: AdjustmentRequestStatus;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filtrar por funcionário' })
  @IsOptional()
  @IsUUID()
  public employeeId?: string;

  @ApiPropertyOptional({ example: '2026-08-01', pattern: '^\\d{4}-\\d{2}-\\d{2}$' })
  @IsOptional()
  @IsString()
  @Matches(BUSINESS_DATE_PATTERN)
  @IsISO8601({ strict: true })
  public from?: string;

  @ApiPropertyOptional({ example: '2026-08-31', pattern: '^\\d{4}-\\d{2}-\\d{2}$' })
  @IsOptional()
  @IsString()
  @Matches(BUSINESS_DATE_PATTERN)
  @IsISO8601({ strict: true })
  public to?: string;
}
