import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  type PerformanceClassification,
  type PerformanceCriterionScoreDto,
  type PerformanceReviewDto,
} from '@ph-ponto/shared';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class SupersedePerformanceReviewDto {
  @ApiProperty({
    description: 'Justificativa obrigatória para a substituição da avaliação de desempenho',
    example: 'Substituição formal após retificação da pontuação de pontualidade.',
  })
  @IsString({ message: 'A justificativa deve ser um texto válido.' })
  @MinLength(5, { message: 'A justificativa deve conter no mínimo 5 caracteres.' })
  @MaxLength(500, { message: 'A justificativa não pode ultrapassar 500 caracteres.' })
  public reason!: string;
}

export class ListPerformanceReviewsQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrar avaliações por ID do colaborador',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('all', { message: 'O ID do colaborador deve ser um UUID válido.' })
  public employeeId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por período de avaliação' })
  @IsOptional()
  @IsString()
  public period?: string;

  @ApiPropertyOptional({
    description: 'Incluir avaliações substituídas/históricas na listagem (padrão: true)',
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  public includeSuperseded?: boolean;
}

export class PerformanceCriterionScoreResponseDto implements PerformanceCriterionScoreDto {
  @ApiProperty()
  public criterionKey!: string;

  @ApiProperty()
  public criterionTitle!: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  public score!: number;

  @ApiPropertyOptional()
  public feedback?: string | null | undefined;
}

export class PerformanceReviewResponseDto implements PerformanceReviewDto {
  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiProperty({ format: 'uuid' })
  public companyId!: string;

  @ApiProperty({ format: 'uuid' })
  public employeeId!: string;

  @ApiPropertyOptional()
  public employeeName?: string | null;

  @ApiProperty({ format: 'uuid' })
  public evaluatorId!: string;

  @ApiPropertyOptional()
  public evaluatorName?: string | null;

  @ApiProperty()
  public evaluationPeriod!: string;

  @ApiProperty({ example: '2026-09-25' })
  public evaluationDate!: string;

  @ApiProperty({ example: 4.25 })
  public meanScore!: number;

  @ApiProperty({ enum: ['EXCELLENT', 'GOOD', 'REGULAR', 'NEEDS_IMPROVEMENT'] })
  public classification!: PerformanceClassification;

  @ApiProperty({ type: [PerformanceCriterionScoreResponseDto] })
  public scores!: PerformanceCriterionScoreResponseDto[];

  @ApiPropertyOptional()
  public strengths?: string | null;

  @ApiPropertyOptional()
  public improvements?: string | null;

  @ApiPropertyOptional()
  public actionPlan?: string | null;

  @ApiPropertyOptional()
  public evaluatorComments?: string | null;

  @ApiPropertyOptional()
  public employeeComments?: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  public generatedDocumentId?: string | null;

  @ApiProperty()
  public isSuperseded!: boolean;

  @ApiPropertyOptional({ format: 'uuid' })
  public supersededById?: string | null;

  @ApiPropertyOptional()
  public supersededAt?: string | null;

  @ApiPropertyOptional()
  public supersessionReason?: string | null;

  @ApiProperty()
  public createdAt!: string;

  @ApiProperty()
  public updatedAt!: string;
}

export class PerformanceCriteriaItemDto {
  @ApiProperty()
  public key!: string;

  @ApiProperty()
  public order!: number;

  @ApiProperty()
  public title!: string;

  @ApiProperty()
  public description!: string;
}

export class PerformanceCriteriaResponseDto {
  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiProperty({ format: 'uuid' })
  public companyId!: string;

  @ApiProperty()
  public versionNumber!: number;

  @ApiProperty()
  public isActive!: boolean;

  @ApiProperty({ type: [PerformanceCriteriaItemDto] })
  public criteria!: PerformanceCriteriaItemDto[];

  @ApiProperty()
  public createdAt!: string;
}
