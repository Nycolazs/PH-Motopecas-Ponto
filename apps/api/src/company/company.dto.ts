import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator';

export class UpdateCompanyRequestDto {
  @ApiProperty({ description: 'Razão Social', example: 'PH MOTOPECAS LTDA' })
  @IsString({ message: 'Razão Social deve ser um texto.' })
  @MinLength(2, { message: 'Razão Social deve ter pelo menos 2 caracteres.' })
  @MaxLength(200, { message: 'Razão Social não pode exceder 200 caracteres.' })
  public legalName!: string;

  @ApiProperty({ description: 'Nome Fantasia', example: 'PH Motopeças' })
  @IsString({ message: 'Nome Fantasia deve ser um texto.' })
  @MinLength(2, { message: 'Nome Fantasia deve ter pelo menos 2 caracteres.' })
  @MaxLength(200, { message: 'Nome Fantasia não pode exceder 200 caracteres.' })
  public tradeName!: string;

  @ApiProperty({ description: 'CNPJ da empresa', example: '12.345.678/0001-90' })
  @IsString({ message: 'CNPJ deve ser um texto.' })
  @Length(14, 18, { message: 'CNPJ deve ter entre 14 e 18 caracteres.' })
  public cnpj!: string;

  @ApiPropertyOptional({ description: 'Inscrição Estadual', example: '123456789' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  public stateRegistration?: string | null;

  @ApiPropertyOptional({ description: 'E-mail principal', example: 'contato@phmotos.com.br' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  public email?: string | null;

  @ApiPropertyOptional({ description: 'Telefone comercial', example: '(85) 3000-0000' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  public phone?: string | null;

  @ApiPropertyOptional({ description: 'Logradouro / Rua', example: 'Av. Principal' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  public addressStreet?: string | null;

  @ApiPropertyOptional({ description: 'Número', example: '123' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  public addressNumber?: string | null;

  @ApiPropertyOptional({ description: 'Complemento', example: 'Galpão 2' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  public addressComplement?: string | null;

  @ApiPropertyOptional({ description: 'Bairro', example: 'Centro' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  public addressNeighborhood?: string | null;

  @ApiPropertyOptional({ description: 'Cidade', example: 'Fortaleza' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  public addressCity?: string | null;

  @ApiPropertyOptional({ description: 'UF (Estado com 2 letras)', example: 'CE' })
  @IsOptional()
  @IsString()
  @Length(2, 2, { message: 'UF deve conter exatamente 2 letras.' })
  public addressState?: string | null;

  @ApiPropertyOptional({ description: 'CEP', example: '60000-000' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  public addressPostalCode?: string | null;

  @ApiPropertyOptional({ description: 'Responsável principal', example: 'Pedro Nycolas' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  public primaryContactName?: string | null;
}

export class CompanyResponseDto {
  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiProperty()
  public legalName!: string;

  @ApiProperty()
  public tradeName!: string;

  @ApiProperty()
  public cnpj!: string;

  @ApiPropertyOptional()
  public stateRegistration?: string | null;

  @ApiPropertyOptional()
  public email?: string | null;

  @ApiPropertyOptional()
  public phone?: string | null;

  @ApiPropertyOptional()
  public addressStreet?: string | null;

  @ApiPropertyOptional()
  public addressNumber?: string | null;

  @ApiPropertyOptional()
  public addressComplement?: string | null;

  @ApiPropertyOptional()
  public addressNeighborhood?: string | null;

  @ApiPropertyOptional()
  public addressCity?: string | null;

  @ApiPropertyOptional()
  public addressState?: string | null;

  @ApiPropertyOptional()
  public addressPostalCode?: string | null;

  @ApiPropertyOptional()
  public primaryContactName?: string | null;

  @ApiProperty()
  public createdAt!: string;

  @ApiProperty()
  public updatedAt!: string;
}

export class SetupItemStatusDto {
  @ApiProperty()
  public id!: string;

  @ApiProperty()
  public label!: string;

  @ApiProperty()
  public description!: string;

  @ApiProperty()
  public isCompleted!: boolean;

  @ApiPropertyOptional()
  public actionUrl?: string;
}

export class SetupStatusResponseDto {
  @ApiProperty()
  public completionPercentage!: number;

  @ApiProperty({ type: [SetupItemStatusDto] })
  public items!: SetupItemStatusDto[];
}
