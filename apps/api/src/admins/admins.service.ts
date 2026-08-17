import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedUser, ClientContext } from '../auth/auth.types.js';
import { AuditAction } from '../generated/prisma/client.js';
import type {
  CreateManagedUserDto,
  ListUsersQueryDto,
  UpdateManagedUserDto,
} from '../users/user.dto.js';
import { UserManagementService } from '../users/user-management.service.js';
import type { UserListViewDto, UserViewDto } from '../users/user.view.js';

const ADMIN_AUDIT_ACTIONS = Object.freeze({
  created: AuditAction.ADMIN_CREATED,
  updated: AuditAction.ADMIN_UPDATED,
  activated: AuditAction.ADMIN_ACTIVATED,
  deactivated: AuditAction.ADMIN_DEACTIVATED,
  passwordReset: AuditAction.ADMIN_PASSWORD_RESET,
});

@Injectable()
export class AdminsService {
  public constructor(
    @Inject(UserManagementService) private readonly management: UserManagementService,
  ) {}

  public create(
    actor: AuthenticatedUser,
    input: CreateManagedUserDto,
    context: ClientContext,
  ): Promise<UserViewDto> {
    return this.management.create('ADMIN', ADMIN_AUDIT_ACTIONS, actor, input, context);
  }

  public list(query: ListUsersQueryDto): Promise<UserListViewDto> {
    return this.management.list('ADMIN', query);
  }

  public get(adminId: string): Promise<UserViewDto> {
    return this.management.get('ADMIN', adminId);
  }

  public update(
    actor: AuthenticatedUser,
    adminId: string,
    input: UpdateManagedUserDto,
    context: ClientContext,
  ): Promise<UserViewDto> {
    return this.management.update('ADMIN', ADMIN_AUDIT_ACTIONS, actor, adminId, input, context);
  }

  public updateStatus(
    actor: AuthenticatedUser,
    adminId: string,
    isActive: boolean,
    context: ClientContext,
  ): Promise<UserViewDto> {
    return this.management.updateStatus(
      'ADMIN',
      ADMIN_AUDIT_ACTIONS,
      actor,
      adminId,
      isActive,
      context,
    );
  }

  public resetPassword(
    actor: AuthenticatedUser,
    adminId: string,
    password: string,
    context: ClientContext,
  ): Promise<void> {
    return this.management.resetPassword(
      'ADMIN',
      ADMIN_AUDIT_ACTIONS,
      actor,
      adminId,
      password,
      context,
    );
  }
}
