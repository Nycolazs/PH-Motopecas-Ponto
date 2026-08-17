import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'joao.silva', minLength: 3, maxLength: 64 })
  @IsString()
  @Length(3, 64)
  public login!: string;

  @ApiProperty({ format: 'password', minLength: 1, maxLength: 256, writeOnly: true })
  @IsString()
  @Length(1, 256)
  public password!: string;

  @ApiPropertyOptional({ example: 'Recepção', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  public deviceName?: string;
}
