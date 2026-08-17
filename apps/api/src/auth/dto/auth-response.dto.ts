import { ApiProperty } from '@nestjs/swagger';
import { USER_ROLES, type UserRole } from '@ph-ponto/shared';

import type { AuthResponse, PublicAuthUser } from '../auth.types.js';

export class AuthUserDto implements PublicAuthUser {
  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiProperty({ example: 'João Silva' })
  public name!: string;

  @ApiProperty({ example: 'joao.silva' })
  public login!: string;

  @ApiProperty({ enum: USER_ROLES })
  public role!: UserRole;
}

export class AuthResponseDto implements AuthResponse {
  @ApiProperty()
  public accessToken!: string;

  @ApiProperty({ writeOnly: true })
  public refreshToken!: string;

  @ApiProperty({ example: 300 })
  public accessTokenExpiresInSeconds!: number;

  @ApiProperty({ type: AuthUserDto })
  public user!: AuthUserDto;
}
