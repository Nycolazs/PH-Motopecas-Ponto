import { ApiProperty } from '@nestjs/swagger';
import type { UserRole } from '@ph-ponto/shared';

import type { Prisma } from '../generated/prisma/client.js';

export const safeUserSelect = {
  id: true,
  name: true,
  login: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  avatar: { select: { id: true } },
} satisfies Prisma.UserSelect;

export type SafeUserRecord = Prisma.UserGetPayload<{ select: typeof safeUserSelect }>;

export interface SafeUserState extends Record<string, string | boolean> {
  name: string;
  login: string;
  role: UserRole;
  isActive: boolean;
}

export class UserViewDto {
  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiProperty({ example: 'João da Silva' })
  public name!: string;

  @ApiProperty({ example: 'joao.silva' })
  public login!: string;

  @ApiProperty({ enum: ['ADMIN', 'EMPLOYEE'] })
  public role!: UserRole;

  @ApiProperty()
  public isActive!: boolean;

  @ApiProperty()
  public hasAvatar!: boolean;

  @ApiProperty({ format: 'date-time' })
  public createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  public updatedAt!: string;
}

export class UserPaginationDto {
  @ApiProperty()
  public page!: number;

  @ApiProperty()
  public limit!: number;

  @ApiProperty()
  public total!: number;

  @ApiProperty()
  public totalPages!: number;
}

export class UserListViewDto {
  @ApiProperty({ type: [UserViewDto] })
  public items!: UserViewDto[];

  @ApiProperty({ type: UserPaginationDto })
  public pagination!: UserPaginationDto;
}

export function toUserView(user: SafeUserRecord): UserViewDto {
  return {
    id: user.id,
    name: user.name,
    login: user.login,
    role: user.role,
    isActive: user.isActive,
    hasAvatar: user.avatar !== null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function toSafeUserState(user: SafeUserRecord): SafeUserState {
  return {
    name: user.name,
    login: user.login,
    role: user.role,
    isActive: user.isActive,
  };
}
