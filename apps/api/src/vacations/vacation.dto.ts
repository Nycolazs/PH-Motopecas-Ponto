import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export class CreateVacationDto {
  @ApiProperty({ description: 'ID do funcionário', format: 'uuid' })
  @IsUUID('4', { message: 'Informe um identificador de funcionário válido.' })
  public employeeId!: string;

  @ApiProperty({ description: 'Data de início das férias (AAAA-MM-DD)', example: '2026-09-01' })
  @IsString({ message: 'Informe a data inicial no formato AAAA-MM-DD.' })
  @Matches(DATE_REGEX, { message: 'A data inicial deve estar no formato AAAA-MM-DD.' })
  public startDate!: string;

  @ApiProperty({ description: 'Data de término das férias (AAAA-MM-DD)', example: '2026-09-30' })
  @IsString({ message: 'Informe a data final no formato AAAA-MM-DD.' })
  @Matches(DATE_REGEX, { message: 'A data final deve estar no formato AAAA-MM-DD.' })
  public endDate!: string;

  @ApiPropertyOptional({ description: 'Observação ou motivo das férias', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'A observação deve ter no máximo 255 caracteres.' })
  public note?: string;
}

export class ListVacationsQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por funcionário', format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'ID do funcionário inválido.' })
  public employeeId?: string;

  @ApiPropertyOptional({ description: 'Data de corte inicial (AAAA-MM-DD)' })
  @IsOptional()
  @Matches(DATE_REGEX, { message: 'Data inicial inválida.' })
  public from?: string;

  @ApiPropertyOptional({ description: 'Data de corte final (AAAA-MM-DD)' })
  @IsOptional()
  @Matches(DATE_REGEX, { message: 'Data final inválida.' })
  public to?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  public page: number = 1;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  public limit: number = 50;
}
