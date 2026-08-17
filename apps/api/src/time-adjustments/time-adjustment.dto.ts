import { ApiProperty } from '@nestjs/swagger';
import {
  IsISO8601,
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const EXPLICIT_OFFSET_PATTERN = /(?:Z|[+-]\d{2}:\d{2})$/;

export class CorrectTimePunchDto {
  @ApiProperty({ format: 'date-time', example: '2026-08-14T17:00:00-03:00' })
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(EXPLICIT_OFFSET_PATTERN)
  public correctedOccurredAt!: string;

  @ApiProperty({ format: 'date-time', example: '2026-08-14T15:00:00-03:00' })
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(EXPLICIT_OFFSET_PATTERN)
  public expectedCurrentOccurredAt!: string;

  @ApiProperty({ minimum: 0, maximum: 100_000 })
  @IsInt()
  @Min(0)
  @Max(100_000)
  public expectedSequence!: number;

  @ApiProperty({ minLength: 1, maxLength: 500 })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  public reason!: string;
}
