import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
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
  ValidateNested,
} from 'class-validator';

import { Weekday } from '../generated/prisma/client.js';
import { BUSINESS_DATE_PATTERN } from '../schedules/business-date.js';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

const DATE_MESSAGE = 'Informe a data no formato AAAA-MM-DD.';

export class ShiftInputDto {
  @ApiProperty({ description: 'Trabalha neste dia? false = folga' })
  @IsBoolean({ message: 'Informe se o dia é de trabalho ou de folga.' })
  public isWorkday!: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 1439, nullable: true, example: 480 })
  @IsOptional()
  @IsInt({ message: 'Horário de entrada inválido.' })
  @Min(0)
  @Max(1_439)
  public startMinute?: number | null;

  @ApiPropertyOptional({ minimum: 1, maximum: 1440, nullable: true, example: 1020 })
  @IsOptional()
  @IsInt({ message: 'Horário de saída inválido.' })
  @Min(1)
  @Max(1_440)
  public endMinute?: number | null;

  @ApiPropertyOptional({ minimum: 0, maximum: 1439, nullable: true, example: 720 })
  @IsOptional()
  @IsInt({ message: 'Início do intervalo inválido.' })
  @Min(0)
  @Max(1_439)
  public breakStartMinute?: number | null;

  @ApiPropertyOptional({ minimum: 1, maximum: 1440, nullable: true, example: 780 })
  @IsOptional()
  @IsInt({ message: 'Fim do intervalo inválido.' })
  @Min(1)
  @Max(1_440)
  public breakEndMinute?: number | null;
}

export class ScheduleDayInputDto extends ShiftInputDto {
  @ApiProperty({ enum: Weekday })
  @IsEnum(Weekday, { message: 'Dia da semana inválido.' })
  public weekday!: Weekday;
}

export class ScheduleWeekInputDto {
  @ApiProperty({ type: [ScheduleDayInputDto], description: 'Os sete dias da semana' })
  @IsArray()
  @ArrayMinSize(7, { message: 'Informe os sete dias da semana.' })
  @ArrayMaxSize(7, { message: 'Informe os sete dias da semana.' })
  @ValidateNested({ each: true })
  @Type(() => ScheduleDayInputDto)
  public days!: ScheduleDayInputDto[];
}

export class EmployeeScheduleDraftDto {
  @ApiProperty({ example: '2026-12-15', description: 'Primeiro dia em que a escala vale' })
  @IsString({ message: DATE_MESSAGE })
  @Matches(BUSINESS_DATE_PATTERN, { message: DATE_MESSAGE })
  @IsISO8601({ strict: true }, { message: DATE_MESSAGE })
  public effectiveDate!: string;

  @ApiPropertyOptional({
    description: 'true = volta a seguir o horário da empresa a partir da data',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  public usesCompanySchedule?: boolean;

  @ApiPropertyOptional({
    type: [ScheduleWeekInputDto],
    description: '1 semana = folga fixa; 2 a 4 semanas = rodízio (a semana 1 começa na data)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'Informe ao menos uma semana.' })
  @ArrayMaxSize(4, { message: 'O rodízio pode ter no máximo 4 semanas.' })
  @ValidateNested({ each: true })
  @Type(() => ScheduleWeekInputDto)
  public weeks?: ScheduleWeekInputDto[];
}

export class PublishEmployeeScheduleDto extends EmployeeScheduleDraftDto {
  @ApiPropertyOptional({ maxLength: 240, nullable: true })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(240, { message: 'A observação deve ter no máximo 240 caracteres.' })
  public note?: string | null;

  @ApiPropertyOptional({
    description: 'Confirma a publicação mesmo com alertas de jornada (o administrador assume).',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  public confirmIssues?: boolean;
}

export class ScheduleRangeQueryDto {
  @ApiProperty({ example: '2026-12-14' })
  @Matches(BUSINESS_DATE_PATTERN, { message: DATE_MESSAGE })
  @IsISO8601({ strict: true }, { message: DATE_MESSAGE })
  public from!: string;

  @ApiProperty({ example: '2027-01-10' })
  @Matches(BUSINESS_DATE_PATTERN, { message: DATE_MESSAGE })
  @IsISO8601({ strict: true }, { message: DATE_MESSAGE })
  public to!: string;
}

export class CreateScheduleAdjustmentDto extends ShiftInputDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('all', { message: 'Colaborador inválido.' })
  public employeeId!: string;

  @ApiProperty({ example: '2026-12-24' })
  @Matches(BUSINESS_DATE_PATTERN, { message: DATE_MESSAGE })
  @IsISO8601({ strict: true }, { message: DATE_MESSAGE })
  public businessDate!: string;

  @ApiProperty({ minLength: 3, maxLength: 240, example: 'Cobrir inventário' })
  @Transform(trimString)
  @IsString({ message: 'Informe o motivo.' })
  @MinLength(3, { message: 'Descreva o motivo com pelo menos 3 caracteres.' })
  @MaxLength(240, { message: 'O motivo deve ter no máximo 240 caracteres.' })
  public note!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  public confirmIssues?: boolean;
}

export class MoveRestDayDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('all', { message: 'Colaborador inválido.' })
  public employeeId!: string;

  @ApiProperty({ description: 'Folga atual que vira dia de trabalho', example: '2026-12-16' })
  @Matches(BUSINESS_DATE_PATTERN, { message: DATE_MESSAGE })
  @IsISO8601({ strict: true }, { message: DATE_MESSAGE })
  public restDate!: string;

  @ApiProperty({ description: 'Dia de trabalho que vira a nova folga', example: '2026-12-18' })
  @Matches(BUSINESS_DATE_PATTERN, { message: DATE_MESSAGE })
  @IsISO8601({ strict: true }, { message: DATE_MESSAGE })
  public newRestDate!: string;

  @ApiProperty({ minLength: 3, maxLength: 240, example: 'Pedido do colaborador' })
  @Transform(trimString)
  @IsString({ message: 'Informe o motivo.' })
  @MinLength(3, { message: 'Descreva o motivo com pelo menos 3 caracteres.' })
  @MaxLength(240, { message: 'O motivo deve ter no máximo 240 caracteres.' })
  public note!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  public confirmIssues?: boolean;
}

export class RevokeScheduleOverrideDto {
  @ApiProperty({ minLength: 3, maxLength: 240 })
  @Transform(trimString)
  @IsString({ message: 'Informe o motivo do cancelamento.' })
  @MinLength(3, { message: 'Descreva o motivo com pelo menos 3 caracteres.' })
  @MaxLength(240, { message: 'O motivo deve ter no máximo 240 caracteres.' })
  public reason!: string;
}

export class UpdateWorkRegimeDto {
  @ApiProperty({
    nullable: true,
    description: 'Há acordo coletivo que permite 8h24 por dia? null = não sei (assume 40h)',
  })
  @IsOptional()
  @IsBoolean()
  public hasCollectiveAgreement!: boolean | null;

  @ApiProperty({ enum: [2, 3], description: 'Folga em domingo ao menos a cada N semanas' })
  @Type(() => Number)
  @IsIn([2, 3], { message: 'Escolha 2 ou 3 semanas.' })
  public sundayRestEveryWeeks!: number;

  @ApiProperty({ minimum: 0, maximum: 50, description: 'Mínimo de pessoas trabalhando por dia' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  public minimumStaff!: number;
}
