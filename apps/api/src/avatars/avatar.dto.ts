import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class UploadAvatarDto {
  @ApiProperty({
    description: 'Imagem codificada em Base64 (JPEG, PNG ou WebP, máximo 2MB)',
    example:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  })
  @IsString()
  @IsNotEmpty()
  public dataBase64!: string;

  @ApiProperty({
    enum: ['image/jpeg', 'image/png', 'image/webp'],
    example: 'image/png',
  })
  @IsIn(['image/jpeg', 'image/png', 'image/webp'])
  public mimeType!: 'image/jpeg' | 'image/png' | 'image/webp';
}

export class AvatarViewDto {
  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiProperty({ format: 'uuid' })
  public userId!: string;

  @ApiProperty({ enum: ['IMAGE_JPEG', 'IMAGE_PNG', 'IMAGE_WEBP'] })
  public mimeType!: 'IMAGE_JPEG' | 'IMAGE_PNG' | 'IMAGE_WEBP';

  @ApiProperty({ example: 24500 })
  public byteSize!: number;

  @ApiProperty({ example: 512 })
  public width!: number;

  @ApiProperty({ example: 512 })
  public height!: number;

  @ApiProperty({ example: 'a1b2c3d4...' })
  public checksum!: string;

  @ApiProperty()
  public createdAt!: string;
}
