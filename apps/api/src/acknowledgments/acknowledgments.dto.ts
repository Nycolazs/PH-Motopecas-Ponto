import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { AcknowledgmentType } from '../generated/prisma/client.js';

export class ListAcknowledgmentsQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Filtro por colaborador' })
  @IsOptional()
  @IsString()
  public employeeId?: string;

  @ApiPropertyOptional({ enum: AcknowledgmentType, description: 'Filtro por tipo de ciência' })
  @IsOptional()
  @IsEnum(AcknowledgmentType)
  public type?: AcknowledgmentType;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  public limit: number = 50;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  public offset: number = 0;
}

export class EmployeeDocumentAcknowledgmentResponseDto {
  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiProperty({ format: 'uuid' })
  public employeeId!: string;

  @ApiPropertyOptional({ example: 'João da Silva', nullable: true })
  public employeeName!: string | null;

  @ApiProperty({ enum: AcknowledgmentType, example: AcknowledgmentType.REGULATION })
  public acknowledgmentType!: AcknowledgmentType;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  public regulationVersionId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  public jobRoleVersionId!: string | null;

  @ApiProperty({ format: 'uuid' })
  public generatedDocumentId!: string;

  @ApiProperty()
  public acknowledgedAt!: string;

  @ApiProperty({ format: 'uuid' })
  public createdById!: string;

  @ApiProperty()
  public createdAt!: string;
}

export class AcknowledgmentStatusSummaryResponseDto {
  @ApiProperty({ example: 10, description: 'Total de colaboradores ativos' })
  public totalActiveEmployees!: number;

  @ApiProperty({ example: 8, description: 'Colaboradores com ciência do regimento vigente' })
  public regulationAcknowledgedCount!: number;

  @ApiProperty({
    example: 7,
    description: 'Colaboradores com ciência da descrição do cargo vigente',
  })
  public roleAcknowledgedCount!: number;

  @ApiProperty({
    example: false,
    description: 'Indica se 100% dos ativos assinaram ambos os termos vigentes',
  })
  public isFullyCompliant!: boolean;
}

export class PaginatedAcknowledgmentsResponseDto {
  @ApiProperty({ type: [EmployeeDocumentAcknowledgmentResponseDto] })
  public items!: EmployeeDocumentAcknowledgmentResponseDto[];

  @ApiProperty({ example: 1 })
  public total!: number;

  @ApiProperty({ example: 50 })
  public limit!: number;

  @ApiProperty({ example: 0 })
  public offset!: number;
}
