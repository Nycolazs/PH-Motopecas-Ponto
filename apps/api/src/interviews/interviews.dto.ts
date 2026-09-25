import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { InterviewRecommendation } from '../generated/prisma/client.js';

export class ListInterviewsQueryDto {
  @ApiPropertyOptional({ description: 'Busca por nome do candidato' })
  @IsOptional()
  @IsString()
  public search?: string;

  @ApiPropertyOptional({ enum: InterviewRecommendation, description: 'Filtro por recomendação' })
  @IsOptional()
  @IsEnum(InterviewRecommendation)
  public recommendation?: InterviewRecommendation;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filtro por ID do cargo' })
  @IsOptional()
  @IsString()
  public jobRoleId?: string;

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

export class HiringInterviewResponseDto {
  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiProperty({ example: 'João da Silva' })
  public candidateName!: string;

  @ApiPropertyOptional({ example: 'joao@email.com', nullable: true })
  public candidateEmail!: string | null;

  @ApiPropertyOptional({ example: '(11) 98765-4321', nullable: true })
  public candidatePhone!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  public jobRoleId!: string | null;

  @ApiProperty({ example: 'Mecânico de Motocicletas' })
  public roleTitle!: string;

  @ApiProperty({ example: '2026-09-25' })
  public interviewDate!: string;

  @ApiProperty({ example: 'Carlos Gerente' })
  public interviewerName!: string;

  @ApiProperty({ format: 'uuid' })
  public evaluatorId!: string;

  @ApiProperty({ enum: InterviewRecommendation, example: InterviewRecommendation.RECOMMENDED })
  public recommendation!: InterviewRecommendation;

  @ApiPropertyOptional({ example: 'Excelente comunicação e perfil técnico', nullable: true })
  public notes!: string | null;

  @ApiProperty({ description: 'Critérios e notas avaliadas' })
  public scores!: Record<string, unknown> | unknown[];

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  public generatedDocumentId!: string | null;

  @ApiProperty()
  public createdAt!: string;

  @ApiProperty()
  public updatedAt!: string;
}

export class PaginatedInterviewsResponseDto {
  @ApiProperty({ type: [HiringInterviewResponseDto] })
  public items!: HiringInterviewResponseDto[];

  @ApiProperty({ example: 1 })
  public total!: number;

  @ApiProperty({ example: 50 })
  public limit!: number;

  @ApiProperty({ example: 0 })
  public offset!: number;
}
