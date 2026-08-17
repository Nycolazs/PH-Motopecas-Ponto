import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class RefreshDto {
  @ApiProperty({ writeOnly: true, minLength: 80, maxLength: 128 })
  @IsString()
  @Length(80, 128)
  public refreshToken!: string;
}
