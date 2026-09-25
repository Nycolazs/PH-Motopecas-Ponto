import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  type CreateEmploymentEventDto,
  type EmploymentEventDto,
  type EmploymentEventTypeDto,
  type PaginatedEmploymentEventsDto,
  type ReactivateEmployeeDto,
  type TerminateEmployeeDto,
  type TerminationReasonDto,
} from '@ph-ponto/shared';

const EVENT_TYPES: EmploymentEventTypeDto[] = [
  'ADMISSION',
  'ROLE_CHANGE',
  'SUSPENSION',
  'TERMINATION',
  'REACTIVATION',
  'NOTE',
];

const TERMINATION_REASONS: TerminationReasonDto[] = [
  'WITHOUT_CAUSE',
  'WITH_CAUSE',
  'EMPLOYEE_RESIGNATION',
  'MUTUAL_AGREEMENT',
  'CONTRACT_EXPIRATION',
  'OTHER',
];

export class CreateEmploymentEventRequestDto implements CreateEmploymentEventDto {
  @ApiProperty({ enum: EVENT_TYPES, example: 'NOTE' })
  @IsIn(EVENT_TYPES, { message: 'Tipo de evento inválido.' })
  public eventType!: EmploymentEventTypeDto;

  @ApiProperty({ example: '2026-09-25', description: 'Data de vigência (AAAA-MM-DD)' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data de vigência inválida (AAAA-MM-DD).' })
  public effectiveDate!: string;

  @ApiProperty({ example: 'Elogio de atendimento ao cliente' })
  @IsString({ message: 'Título deve ser uma string.' })
  @MinLength(2, { message: 'Título deve ter pelo menos 2 caracteres.' })
  @MaxLength(150, { message: 'Título deve ter no máximo 150 caracteres.' })
  public title!: string;

  @ApiPropertyOptional({ example: 'Cliente destacou a rapidez e cortesia do colaborador.' })
  @IsOptional()
  @IsString({ message: 'Descrição deve ser uma string.' })
  public description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  public metadata?: Record<string, unknown>;
}

export class TerminateEmployeeRequestDto implements TerminateEmployeeDto {
  @ApiProperty({ example: '2026-09-25', description: 'Data de desligamento (AAAA-MM-DD)' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data de desligamento inválida (AAAA-MM-DD).' })
  public effectiveDate!: string;

  @ApiProperty({ enum: TERMINATION_REASONS, example: 'WITHOUT_CAUSE' })
  @IsIn(TERMINATION_REASONS, { message: 'Motivo de rescisão inválido.' })
  public reason!: TerminationReasonDto;

  @ApiPropertyOptional({ example: 'Cumprimento de aviso prévio indenizado.' })
  @IsOptional()
  @IsString({ message: 'Observações devem ser uma string.' })
  public notes?: string;
}

export class ReactivateEmployeeRequestDto implements ReactivateEmployeeDto {
  @ApiProperty({ example: '2026-09-25', description: 'Data de reativação (AAAA-MM-DD)' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data de reativação inválida (AAAA-MM-DD).' })
  public effectiveDate!: string;

  @ApiPropertyOptional({ example: 'Retorno às atividades após período de afastamento.' })
  @IsOptional()
  @IsString({ message: 'Observações devem ser uma string.' })
  public notes?: string;
}

export class ListEmploymentEventsQueryDto {
  @ApiPropertyOptional({ enum: EVENT_TYPES })
  @IsOptional()
  @IsIn(EVENT_TYPES)
  public eventType?: EmploymentEventTypeDto;

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  public limit: number = 100;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  public offset: number = 0;
}

export class EmploymentEventResponseDto implements EmploymentEventDto {
  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiProperty({ format: 'uuid' })
  public employeeId!: string;

  @ApiProperty({ enum: EVENT_TYPES })
  public eventType!: EmploymentEventTypeDto;

  @ApiProperty({ example: '2026-09-25' })
  public effectiveDate!: string;

  @ApiProperty()
  public title!: string;

  @ApiPropertyOptional({ nullable: true })
  public description?: string | null;

  @ApiPropertyOptional({ nullable: true })
  public metadata?: Record<string, unknown> | null;

  @ApiProperty({ format: 'uuid' })
  public createdById!: string;

  @ApiPropertyOptional()
  public createdByName?: string;

  @ApiProperty({ format: 'date-time' })
  public createdAt!: string;
}

export class PaginatedEmploymentEventsResponseDto implements PaginatedEmploymentEventsDto {
  @ApiProperty({ type: [EmploymentEventResponseDto] })
  public items!: EmploymentEventResponseDto[];

  @ApiProperty({ example: 10 })
  public total!: number;

  @ApiProperty({ example: 50 })
  public limit!: number;

  @ApiProperty({ example: 0 })
  public offset!: number;
}
