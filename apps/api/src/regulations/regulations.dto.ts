import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { RegulationPayloadDto } from '@ph-ponto/shared';

export class CompanyRegulationVersionResponseDto {
  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiProperty({ format: 'uuid' })
  public companyRegulationId!: string;

  @ApiProperty({ example: 1 })
  public versionNumber!: number;

  @ApiProperty({ example: 'Regimento Interno de Trabalho' })
  public title!: string;

  @ApiProperty({ example: '2026-09-25' })
  public effectiveDate!: string;

  @ApiProperty({ type: Object, description: 'Conteúdo estruturado completo do regimento' })
  public content!: RegulationPayloadDto;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  public generatedDocumentId!: string | null;

  @ApiProperty()
  public publishedAt!: string;

  @ApiProperty({ format: 'uuid' })
  public createdById!: string;

  @ApiProperty()
  public createdAt!: string;
}

export class CompanyRegulationResponseDto {
  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiProperty({ format: 'uuid' })
  public companyId!: string;

  @ApiPropertyOptional({ type: CompanyRegulationVersionResponseDto, nullable: true })
  public currentVersion!: CompanyRegulationVersionResponseDto | null;

  @ApiProperty({ type: [CompanyRegulationVersionResponseDto] })
  public versions!: CompanyRegulationVersionResponseDto[];

  @ApiProperty()
  public createdAt!: string;

  @ApiProperty()
  public updatedAt!: string;
}
