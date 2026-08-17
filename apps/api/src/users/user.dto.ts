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

  @ApiProperty({ minLength: 8, maxLength: 128, writeOnly: true })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  public password!: string;
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
  @ApiProperty({ minLength: 8, maxLength: 128, writeOnly: true })
  @IsString()
  @MinLength(8)
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
    minLength: 8,
    maxLength: 128,
    writeOnly: true,
    description: 'Nova senha (mínimo 8 caracteres)',
  })
  @IsString()
  @MinLength(8, { message: 'A nova senha deve ter no mínimo 8 caracteres.' })
  @MaxLength(128, { message: 'A nova senha deve ter no máximo 128 caracteres.' })
  public newPassword!: string;
}
