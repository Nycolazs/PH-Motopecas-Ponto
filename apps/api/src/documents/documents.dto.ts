import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { DocumentType } from '../generated/prisma/client.js';

export class SaveDocumentDraftDto {
  @ApiProperty({ enum: DocumentType })
  @IsEnum(DocumentType)
  public documentType!: DocumentType;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  public employeeId?: string;

  @ApiProperty({ example: 'Cultura e Princípios da Empresa' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(200)
  public title!: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  public expectedRevision?: number;

  @ApiProperty({ description: 'Payload em JSON estruturado de acordo com o tipo do documento' })
  @IsObject()
  public payload!: Record<string, unknown>;
}

export class PrepareDocumentDraftDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @IsPositive()
  public expectedRevision!: number;
}

export class ConfirmDocumentDraftDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @IsPositive()
  public expectedRevision!: number;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  public preparedArtifactId!: string;
}

export class VoidDocumentDto {
  @ApiProperty({ example: 'Documento emitido com erro nos dados de identificação.' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(255)
  public reason!: string;
}

export class ListDocumentsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  public page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  public limit?: number = 20;

  @ApiPropertyOptional({ enum: DocumentType })
  @IsOptional()
  @IsEnum(DocumentType)
  public documentType?: DocumentType;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  public employeeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public search?: string;
}

export class DocumentDraftResponseDto {
  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiProperty({ enum: DocumentType })
  public documentType!: DocumentType;

  @ApiProperty({ format: 'uuid' })
  public authorId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  public employeeId!: string | null;

  @ApiProperty()
  public revision!: number;

  @ApiProperty()
  public title!: string;

  @ApiProperty()
  public payload!: Record<string, unknown>;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  public preparedArtifactId!: string | null;

  @ApiProperty()
  public createdAt!: string;

  @ApiProperty()
  public updatedAt!: string;
}

export class GeneratedDocumentResponseDto {
  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiProperty({ enum: DocumentType })
  public documentType!: DocumentType;

  @ApiProperty()
  public title!: string;

  @ApiProperty({ format: 'uuid' })
  public companyId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  public employeeId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  public employeeName?: string | null;

  @ApiProperty({ format: 'uuid' })
  public authorId!: string;

  @ApiPropertyOptional({ nullable: true })
  public authorName?: string | null;

  @ApiProperty({ format: 'uuid' })
  public artifactId!: string;

  @ApiPropertyOptional({ nullable: true })
  public fileSize?: number | null;

  @ApiProperty()
  public version!: number;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  public supersededById!: string | null;

  @ApiProperty()
  public isVoid!: boolean;

  @ApiPropertyOptional({ nullable: true })
  public voidReason!: string | null;

  @ApiPropertyOptional({ nullable: true })
  public voidedAt!: string | null;

  @ApiProperty()
  public createdAt!: string;
}

export class DocumentListPaginationDto {
  @ApiProperty()
  public page!: number;

  @ApiProperty()
  public limit!: number;

  @ApiProperty()
  public total!: number;

  @ApiProperty()
  public totalPages!: number;
}

export class DocumentListResponseDto {
  @ApiProperty({ type: [GeneratedDocumentResponseDto] })
  public items!: GeneratedDocumentResponseDto[];

  @ApiProperty({ type: DocumentListPaginationDto })
  public pagination!: DocumentListPaginationDto;
}
