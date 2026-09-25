import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const LOGIN_PATTERN = /^[\p{L}\p{N}._-]+$/u;

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function optionalBoolean({ value }: { value: unknown }): unknown {
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return value;
}

export class CreateManagedUserDto {
  @ApiProperty({ example: 'João da Silva', minLength: 2, maxLength: 120 })
  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  public name!: string;

  @ApiProperty({ example: 'joao.silva', minLength: 3, maxLength: 64 })
  @Transform(trimString)
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  @Matches(LOGIN_PATTERN, { message: 'O login contém caracteres não permitidos.' })
  public login!: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 128, writeOnly: true })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  public password?: string;

  @ApiPropertyOptional({ description: 'Indica se o colaborador terá acesso inicial ao aplicativo' })
  @IsOptional()
  @IsBoolean()
  public accessEnabled?: boolean;
}

export class UpdateManagedUserDto {
  @ApiPropertyOptional({ example: 'João da Silva', minLength: 2, maxLength: 120 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  public name?: string;

  @ApiPropertyOptional({ example: 'joao.silva', minLength: 3, maxLength: 64 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  @Matches(LOGIN_PATTERN, { message: 'O login contém caracteres não permitidos.' })
  public login?: string;
}

export class UpdateUserStatusDto {
  @ApiProperty({ example: false })
  @IsBoolean()
  public isActive!: boolean;
}

export class ResetUserPasswordDto {
  @ApiProperty({ minLength: 1, maxLength: 128, writeOnly: true })
  @IsString()
  @MinLength(1, { message: 'A senha é obrigatória.' })
  @MaxLength(128)
  public password!: string;
}

export class ListUsersQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  public page = 1;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  public limit = 25;

  @ApiPropertyOptional({ description: 'Busca por nome ou login.', maxLength: 120 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(120)
  public search?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  public isActive?: boolean;
}

export class ChangeOwnPasswordDto {
  @ApiProperty({
    minLength: 1,
    maxLength: 128,
    writeOnly: true,
    description: 'Senha atual do usuário',
  })
  @IsString()
  @MinLength(1, { message: 'Informe a senha atual.' })
  @MaxLength(128, { message: 'A senha atual é muito longa.' })
  public currentPassword!: string;

  @ApiProperty({
    minLength: 1,
    maxLength: 128,
    writeOnly: true,
    description: 'Nova senha',
  })
  @IsString()
  @MinLength(1, { message: 'Informe a nova senha.' })
  @MaxLength(128, { message: 'A nova senha deve ter no máximo 128 caracteres.' })
  public newPassword!: string;
}

export class ToggleUserAccessDto {
  @ApiProperty({ description: 'Indica se o colaborador possui acesso ao aplicativo' })
  @IsBoolean({ message: 'accessEnabled deve ser um valor booleano.' })
  public accessEnabled!: boolean;

  @ApiPropertyOptional({
    description: 'Nova senha necessária ao habilitar o acesso pela primeira vez',
    minLength: 8,
  })
  @IsOptional()
  @IsString({ message: 'A senha deve ser uma string.' })
  @MinLength(8, { message: 'A senha deve ter no mínimo 8 caracteres.' })
  public password?: string;
}

export class UpdateEmployeeProfileRequestDto {
  @ApiPropertyOptional({ description: 'CPF do colaborador', example: '123.456.789-00' })
  @IsOptional()
  @IsString()
  @MaxLength(14)
  public cpf?: string | null;

  @ApiPropertyOptional({ description: 'RG do colaborador', example: '1234567-8' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  public rg?: string | null;

  @ApiPropertyOptional({ description: 'Data de nascimento (AAAA-MM-DD)', example: '1995-05-15' })
  @IsOptional()
  @IsString()
  public birthDate?: string | null;

  @ApiPropertyOptional({ description: 'Telefone de contato', example: '(85) 98888-7777' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  public phone?: string | null;

  @ApiPropertyOptional({ description: 'E-mail pessoal', example: 'colaborador@email.com' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  public personalEmail?: string | null;

  @ApiPropertyOptional({ description: 'Logradouro / Rua', example: 'Rua A' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  public addressStreet?: string | null;

  @ApiPropertyOptional({ description: 'Número', example: '10' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  public addressNumber?: string | null;

  @ApiPropertyOptional({ description: 'Complemento', example: 'Apto 101' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  public addressComplement?: string | null;

  @ApiPropertyOptional({ description: 'Bairro', example: 'Bairro Feliz' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  public addressNeighborhood?: string | null;

  @ApiPropertyOptional({ description: 'Cidade', example: 'Fortaleza' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  public addressCity?: string | null;

  @ApiPropertyOptional({ description: 'UF', example: 'CE' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  public addressState?: string | null;

  @ApiPropertyOptional({ description: 'CEP', example: '60000-000' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  public addressPostalCode?: string | null;

  @ApiPropertyOptional({ description: 'Data de admissão (AAAA-MM-DD)', example: '2024-01-10' })
  @IsOptional()
  @IsString()
  public hireDate?: string | null;

  @ApiPropertyOptional({ description: 'Observações internas' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  public notes?: string | null;
}

export class EmployeeProfileResponseDto {
  @ApiProperty({ format: 'uuid' })
  public userId!: string;

  @ApiPropertyOptional()
  public cpf?: string | null;

  @ApiPropertyOptional()
  public rg?: string | null;

  @ApiPropertyOptional()
  public birthDate?: string | null;

  @ApiPropertyOptional()
  public phone?: string | null;

  @ApiPropertyOptional()
  public personalEmail?: string | null;

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
  public hireDate?: string | null;

  @ApiPropertyOptional()
  public notes?: string | null;

  @ApiProperty()
  public accessEnabled!: boolean;

  @ApiProperty()
  public isActive!: boolean;

  @ApiProperty()
  public createdAt!: string;

  @ApiProperty()
  public updatedAt!: string;
}
