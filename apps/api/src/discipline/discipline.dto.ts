import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  type DisciplinaryActionDto,
  type DisciplinaryActionType,
  type DisciplinaryProgressionStage,
  type DisciplinaryProgressionSummaryDto,
  type DocumentTypeDto,
} from '@ph-ponto/shared';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class VoidDisciplinaryActionDto {
  @ApiProperty({
    description: 'Justificativa obrigatória para a anulação da medida disciplinar',
    example: 'Anulação administrativa por acordo de reconsideração e retratação.',
  })
  @IsString({ message: 'A justificativa deve ser um texto válido.' })
  @MinLength(5, { message: 'A justificativa deve conter no mínimo 5 caracteres.' })
  @MaxLength(255, { message: 'A justificativa não pode ultrapassar 255 caracteres.' })
  public reason!: string;
}

export class ListDisciplinaryActionsQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrar medidas disciplinares por ID do colaborador',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('all', { message: 'O ID do colaborador deve ser um UUID válido.' })
  public employeeId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por status de anulação' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  public isVoid?: boolean;

  @ApiPropertyOptional({ description: 'Limite de registros', minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  public limit?: number;

  @ApiPropertyOptional({ description: 'Deslocamento de paginação', minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  public offset?: number;
}

export class DisciplinaryActionResponseDto implements DisciplinaryActionDto {
  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiProperty({ format: 'uuid' })
  public companyId!: string;

  @ApiProperty({ format: 'uuid' })
  public employeeId!: string;

  @ApiPropertyOptional()
  public employeeName?: string | null;

  @ApiProperty({ format: 'uuid' })
  public issuerId!: string;

  @ApiPropertyOptional()
  public issuerName?: string | null;

  @ApiProperty({ enum: ['VERBAL_WARNING', 'WRITTEN_WARNING', 'SUSPENSION'] })
  public actionType!: DisciplinaryActionType;

  @ApiProperty({ enum: ['DISCIPLINE_VERBAL', 'DISCIPLINE_WRITTEN', 'DISCIPLINE_SUSPENSION'] })
  public documentType!: DocumentTypeDto;

  @ApiProperty({ example: '2026-09-25' })
  public incidentDate!: string;

  @ApiProperty({ example: 'Atraso reiterado' })
  public reason!: string;

  @ApiProperty()
  public details!: string;

  @ApiPropertyOptional()
  public internalClauseRef?: string | null;

  @ApiPropertyOptional()
  public suspensionDays?: number | null;

  @ApiPropertyOptional()
  public suspensionStartDate?: string | null;

  @ApiPropertyOptional()
  public suspensionEndDate?: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  public priorActionId?: string | null;

  @ApiPropertyOptional()
  public priorActionSummary?: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  public generatedDocumentId?: string | null;

  @ApiProperty()
  public isVoid!: boolean;

  @ApiPropertyOptional()
  public voidReason?: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  public voidedById?: string | null;

  @ApiPropertyOptional()
  public voidedAt?: string | null;

  @ApiProperty()
  public createdAt!: string;

  @ApiProperty()
  public updatedAt!: string;
}

export class DisciplinaryProgressionSummaryResponseDto implements DisciplinaryProgressionSummaryDto {
  @ApiProperty({ format: 'uuid' })
  public employeeId!: string;

  @ApiPropertyOptional()
  public employeeName?: string | null;

  @ApiProperty()
  public verbalCount!: number;

  @ApiProperty()
  public writtenCount!: number;

  @ApiProperty()
  public suspensionCount!: number;

  @ApiProperty()
  public totalSuspensionDays!: number;

  @ApiProperty()
  public voidedCount!: number;

  @ApiProperty({
    enum: ['NONE', 'VERBAL_WARNING', 'WRITTEN_WARNING', 'SUSPENSION', 'DISMISSAL_REVIEW'],
  })
  public currentStage!: DisciplinaryProgressionStage;

  @ApiPropertyOptional()
  public lastActionDate?: string | null;

  @ApiPropertyOptional({ enum: ['VERBAL_WARNING', 'WRITTEN_WARNING', 'SUSPENSION'] })
  public lastActionType?: DisciplinaryActionType | null;

  @ApiProperty({
    enum: ['NONE', 'VERBAL_WARNING', 'WRITTEN_WARNING', 'SUSPENSION', 'DISMISSAL_REVIEW'],
  })
  public nextSuggestedStage!: DisciplinaryProgressionStage;
}
