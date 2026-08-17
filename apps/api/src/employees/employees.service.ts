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

const EMPLOYEE_AUDIT_ACTIONS = Object.freeze({
  created: AuditAction.USER_CREATED,
  updated: AuditAction.USER_UPDATED,
  activated: AuditAction.USER_ACTIVATED,
  deactivated: AuditAction.USER_DEACTIVATED,
  passwordReset: AuditAction.USER_PASSWORD_RESET,
});

@Injectable()
export class EmployeesService {
  public constructor(
    @Inject(UserManagementService) private readonly management: UserManagementService,
  ) {}

  public create(
    actor: AuthenticatedUser,
    input: CreateManagedUserDto,
    context: ClientContext,
  ): Promise<UserViewDto> {
    return this.management.create('EMPLOYEE', EMPLOYEE_AUDIT_ACTIONS, actor, input, context);
  }

  public list(query: ListUsersQueryDto): Promise<UserListViewDto> {
    return this.management.list('EMPLOYEE', query);
  }

  public get(employeeId: string): Promise<UserViewDto> {
    return this.management.get('EMPLOYEE', employeeId);
  }

  public update(
    actor: AuthenticatedUser,
    employeeId: string,
    input: UpdateManagedUserDto,
    context: ClientContext,
  ): Promise<UserViewDto> {
    return this.management.update(
      'EMPLOYEE',
      EMPLOYEE_AUDIT_ACTIONS,
      actor,
      employeeId,
      input,
      context,
    );
  }

  public updateStatus(
    actor: AuthenticatedUser,
    employeeId: string,
    isActive: boolean,
    context: ClientContext,
  ): Promise<UserViewDto> {
    return this.management.updateStatus(
      'EMPLOYEE',
      EMPLOYEE_AUDIT_ACTIONS,
      actor,
      employeeId,
      isActive,
      context,
    );
  }

  public resetPassword(
    actor: AuthenticatedUser,
    employeeId: string,
    password: string,
    context: ClientContext,
  ): Promise<void> {
    return this.management.resetPassword(
      'EMPLOYEE',
      EMPLOYEE_AUDIT_ACTIONS,
      actor,
      employeeId,
      password,
      context,
    );
  }
}
