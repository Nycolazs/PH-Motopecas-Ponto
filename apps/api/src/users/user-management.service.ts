import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { UserRole } from '@ph-ponto/shared';

import type { ClientContext } from '../auth/auth.types.js';
import { normalizeLogin } from '../auth/login-normalization.js';
import { PasswordService } from '../auth/password.service.js';
import { SessionRevocationService } from '../auth/session-revocation.service.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  AuditOutcome,
  AuditTargetType,
  SessionRevocationReason,
  type AuditAction,
  type Prisma,
} from '../generated/prisma/client.js';
import type { CreateManagedUserDto, ListUsersQueryDto, UpdateManagedUserDto } from './user.dto.js';
import {
  safeUserSelect,
  toSafeUserState,
  toUserView,
  type SafeUserRecord,
  type UserListViewDto,
  type UserViewDto,
} from './user.view.js';

export interface UserLifecycleAuditActions {
  created: AuditAction;
  updated: AuditAction;
  activated: AuditAction;
  deactivated: AuditAction;
  passwordReset: AuditAction;
}

interface MutationActor {
  id: string;
}

function loginConflict(): ConflictException {
  return new ConflictException({
    code: 'LOGIN_ALREADY_EXISTS',
    message: 'Este login já está em uso.',
  });
}

function resourceNotFound(): NotFoundException {
  return new NotFoundException({
    code: 'RESOURCE_NOT_FOUND',
    message: 'Usuário não encontrado.',
  });
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

@Injectable()
export class UserManagementService {
  public constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(SessionRevocationService)
    private readonly sessions: SessionRevocationService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  public async create(
    role: UserRole,
    actions: UserLifecycleAuditActions,
    actor: MutationActor,
    input: CreateManagedUserDto,
    context: ClientContext,
  ): Promise<UserViewDto> {
    const login = input.login.trim();
    const passwordHash = await this.passwords.hash(input.password);

    try {
      const user = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.user.create({
          data: {
            name: input.name.trim(),
            login,
            normalizedLogin: normalizeLogin(login),
            passwordHash,
            role,
          },
          select: safeUserSelect,
        });
        await this.audit.record(
          {
            actorId: actor.id,
            action: actions.created,
            targetType: AuditTargetType.USER,
            targetId: created.id,
            ...context,
            afterState: toSafeUserState(created),
          },
          transaction,
        );
        return created;
      });
      return toUserView(user);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw loginConflict();
      }

      throw error;
    }
  }

  public async list(role: UserRole, query: ListUsersQueryDto): Promise<UserListViewDto> {
    const where: Prisma.UserWhereInput = {
      role,
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      ...(query.search === undefined || query.search.length === 0
        ? {}
        : {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { login: { contains: query.search, mode: 'insensitive' } },
            ],
          }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: safeUserSelect,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map(toUserView),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  public async get(role: UserRole, userId: string): Promise<UserViewDto> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, role },
      select: safeUserSelect,
    });
    return toUserView(this.requireUser(user));
  }

  public async update(
    role: UserRole,
    actions: UserLifecycleAuditActions,
    actor: MutationActor,
    userId: string,
    input: UpdateManagedUserDto,
    context: ClientContext,
  ): Promise<UserViewDto> {
    if (input.name === undefined && input.login === undefined) {
      throw new BadRequestException({
        code: 'EMPTY_UPDATE',
        message: 'Informe ao menos um campo para atualizar.',
      });
    }

    try {
      const user = await this.prisma.$transaction(async (transaction) => {
        const current = await this.lockAndFind(transaction, role, userId);
        const name = input.name?.trim() ?? current.name;
        const login = input.login?.trim() ?? current.login;

        if (name === current.name && login === current.login) {
          return current;
        }

        const updated = await transaction.user.update({
          where: { id: current.id },
          data: {
            ...(name === current.name ? {} : { name }),
            ...(login === current.login ? {} : { login, normalizedLogin: normalizeLogin(login) }),
          },
          select: safeUserSelect,
        });

        if (login !== current.login) {
          await this.sessions.revokeAllForUser(
            current.id,
            SessionRevocationReason.ADMIN_ACTION,
            transaction,
          );
        }

        await this.audit.record(
          {
            actorId: actor.id,
            action: actions.updated,
            targetType: AuditTargetType.USER,
            targetId: updated.id,
            ...context,
            beforeState: toSafeUserState(current),
            afterState: toSafeUserState(updated),
          },
          transaction,
        );
        return updated;
      });
      return toUserView(user);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw loginConflict();
      }

      throw error;
    }
  }

  public async updateStatus(
    role: UserRole,
    actions: UserLifecycleAuditActions,
    actor: MutationActor,
    userId: string,
    isActive: boolean,
    context: ClientContext,
  ): Promise<UserViewDto> {
    const user = await this.prisma.$transaction(async (transaction) => {
      if (role === 'ADMIN') {
        await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('ph-ponto:last-active-admin', 0))::text AS acquired`;
      }

      const current = await this.lockAndFind(transaction, role, userId);
      if (current.isActive === isActive) {
        return current;
      }

      if (role === 'ADMIN' && !isActive) {
        const activeAdminCount = await transaction.user.count({
          where: { role: 'ADMIN', isActive: true },
        });
        if (activeAdminCount <= 1) {
          throw new ConflictException({
            code: 'LAST_ACTIVE_ADMIN',
            message: 'Não é possível desativar o último administrador ativo.',
          });
        }
      }

      const updated = await transaction.user.update({
        where: { id: current.id },
        data: { isActive },
        select: safeUserSelect,
      });

      if (!isActive) {
        await this.sessions.revokeAllForUser(
          current.id,
          SessionRevocationReason.USER_DEACTIVATED,
          transaction,
        );
      }

      await this.audit.record(
        {
          actorId: actor.id,
          action: isActive ? actions.activated : actions.deactivated,
          outcome: AuditOutcome.SUCCESS,
          targetType: AuditTargetType.USER,
          targetId: updated.id,
          ...context,
          beforeState: toSafeUserState(current),
          afterState: toSafeUserState(updated),
        },
        transaction,
      );
      return updated;
    });
    return toUserView(user);
  }

  public async resetPassword(
    role: UserRole,
    actions: UserLifecycleAuditActions,
    actor: MutationActor,
    userId: string,
    password: string,
    context: ClientContext,
  ): Promise<void> {
    const passwordHash = await this.passwords.hash(password);
    await this.prisma.$transaction(async (transaction) => {
      const current = await this.lockAndFind(transaction, role, userId);
      await transaction.user.update({
        where: { id: current.id },
        data: { passwordHash },
        select: { id: true },
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: actions.passwordReset,
          targetType: AuditTargetType.USER,
          targetId: current.id,
          ...context,
          metadata: { credentialChanged: true },
        },
        transaction,
      );
    });
  }

  private async lockAndFind(
    transaction: Prisma.TransactionClient,
    role: UserRole,
    userId: string,
  ): Promise<SafeUserRecord> {
    await transaction.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
    const user = await transaction.user.findFirst({
      where: { id: userId, role },
      select: safeUserSelect,
    });
    return this.requireUser(user);
  }

  private requireUser(user: SafeUserRecord | null): SafeUserRecord {
    if (user === null) {
      throw resourceNotFound();
    }

    return user;
  }
}
