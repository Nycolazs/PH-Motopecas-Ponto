import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

const BUSINESS_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const BUSINESS_MONTH_PATTERN = /^\d{4}-\d{2}$/;

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
