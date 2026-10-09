import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

const BUSINESS_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const BUSINESS_MONTH_PATTERN = /^\d{4}-\d{2}$/;

function optionalBoolean({ value }: { value: unknown }): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

export class AttendanceDateQueryDto {
  @ApiProperty({ example: '2026-08-14', pattern: '^\\d{4}-\\d{2}-\\d{2}$' })
  @IsString()
  @Matches(BUSINESS_DATE_PATTERN)
  public date!: string;
}

export class AttendanceOverviewQueryDto {
  @ApiPropertyOptional({ example: '2026-08-14', pattern: '^\\d{4}-\\d{2}-\\d{2}$' })
  @IsOptional()
  @IsString()
  @Matches(BUSINESS_DATE_PATTERN)
  public date?: string;
}

export class AttendanceHistoryQueryDto {
  @ApiProperty({ example: '2026-08-01', pattern: '^\\d{4}-\\d{2}-\\d{2}$' })
  @IsString()
  @Matches(BUSINESS_DATE_PATTERN)
  public from!: string;

  @ApiProperty({ example: '2026-08-14', pattern: '^\\d{4}-\\d{2}-\\d{2}$' })
  @IsString()
  @Matches(BUSINESS_DATE_PATTERN)
  public to!: string;
}

export class AttendanceMonthQueryDto {
  @ApiProperty({ example: '2026-08', pattern: '^\\d{4}-\\d{2}$' })
  @IsString()
  @Matches(BUSINESS_MONTH_PATTERN)
  public month!: string;
}

export class AttendanceIncompletesQueryDto {
  @ApiPropertyOptional({ example: '2026-08', pattern: '^\\d{4}-\\d{2}$' })
  @IsOptional()
  @IsString()
  @Matches(BUSINESS_MONTH_PATTERN)
  public month?: string;
}

export class AttendanceTimesheetReportQueryDto {
  @ApiProperty({ example: '2026-09-01', pattern: '^\\d{4}-\\d{2}-\\d{2}$' })
  @IsString()
  @Matches(BUSINESS_DATE_PATTERN, { message: 'Informe a data no formato AAAA-MM-DD.' })
  public from!: string;

  @ApiProperty({ example: '2026-09-30', pattern: '^\\d{4}-\\d{2}-\\d{2}$' })
  @IsString()
  @Matches(BUSINESS_DATE_PATTERN, { message: 'Informe a data no formato AAAA-MM-DD.' })
  public to!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Restringe o relatório a um único colaborador (ativo ou inativo).',
  })
  @IsOptional()
  @IsUUID('all')
  public employeeId?: string;

  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description: 'Inclui colaboradores inativos no relatório da equipe.',
  })
  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  public includeInactive?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description: 'Inclui o detalhamento diário (espelho completo) de cada colaborador.',
  })
  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  public includeDays?: boolean;
}
