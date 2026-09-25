import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CultureValueItemDto {
  @ApiProperty({ example: 'Compromisso com o Cliente' })
  public title!: string;

  @ApiProperty({ example: 'Atender com agilidade, honestidade e excelência técnica.' })
  public description!: string;
}

export class CultureVersionResponseDto {
  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiProperty({ example: 1 })
  public versionNumber!: number;

  @ApiProperty({ example: 'Prover as melhores peças e serviços de manutenção de motos.' })
  public mission!: string;

  @ApiProperty({ example: 'Ser referência regional em agilidade, confiança e qualidade.' })
  public vision!: string;

  @ApiProperty({ type: [CultureValueItemDto] })
  public values!: CultureValueItemDto[];

  @ApiPropertyOptional({ example: 'Qualidade que move sua moto com segurança.' })
  public motto!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  public generatedDocumentId!: string | null;

  @ApiProperty()
  public publishedAt!: string;

  @ApiProperty({ format: 'uuid' })
  public createdById!: string;

  @ApiProperty()
  public createdAt!: string;
}

export class CultureProfileResponseDto {
  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiProperty({ format: 'uuid' })
  public companyId!: string;

  @ApiPropertyOptional({ type: CultureVersionResponseDto, nullable: true })
  public currentVersion!: CultureVersionResponseDto | null;

  @ApiProperty({ type: [CultureVersionResponseDto] })
  public versions!: CultureVersionResponseDto[];

  @ApiProperty()
  public createdAt!: string;

  @ApiProperty()
  public updatedAt!: string;
}
