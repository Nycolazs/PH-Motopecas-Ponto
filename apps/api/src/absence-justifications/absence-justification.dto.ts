import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { AbsenceJustificationKind } from '../generated/prisma/client.js';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateAbsenceJustificationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('all', { message: 'Informe um colaborador válido.' })
  public employeeId!: string;

  @ApiProperty({
    enum: AbsenceJustificationKind,
    description: 'ALLOWANCE = abono (um dia); MEDICAL_CERTIFICATE = atestado médico',
  })
  @IsEnum(AbsenceJustificationKind, { message: 'Escolha abono ou atestado.' })
  public kind!: AbsenceJustificationKind;

  @ApiProperty({ example: '2026-10-28', description: 'Primeiro dia (AAAA-MM-DD)' })
  @Matches(DATE_REGEX, { message: 'A data inicial deve estar no formato AAAA-MM-DD.' })
  public startDate!: string;

  @ApiProperty({ example: '2026-10-29', description: 'Último dia; no abono é igual ao primeiro' })
  @Matches(DATE_REGEX, { message: 'A data final deve estar no formato AAAA-MM-DD.' })
  public endDate!: string;

  @ApiProperty({ minLength: 3, maxLength: 500, example: 'Consulta médica com atestado.' })
  @Transform(trim)
  @IsString({ message: 'Informe o motivo.' })
  @MinLength(3, { message: 'Descreva o motivo com pelo menos 3 caracteres.' })
  @MaxLength(500, { message: 'O motivo deve ter no máximo 500 caracteres.' })
  public reason!: string;
}

export class RevokeAbsenceJustificationDto {
  @ApiProperty({ minLength: 3, maxLength: 500 })
  @Transform(trim)
  @IsString({ message: 'Informe o motivo do cancelamento.' })
  @MinLength(3, { message: 'Descreva o motivo do cancelamento com pelo menos 3 caracteres.' })
  @MaxLength(500, { message: 'O motivo deve ter no máximo 500 caracteres.' })
  public reason!: string;
}

export class ListAbsenceJustificationsQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all', { message: 'Colaborador inválido.' })
  public employeeId?: string;

  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @Matches(DATE_REGEX, { message: 'Data inicial inválida.' })
  public from?: string;

  @ApiPropertyOptional({ example: '2026-10-31' })
  @IsOptional()
  @Matches(DATE_REGEX, { message: 'Data final inválida.' })
  public to?: string;
}
