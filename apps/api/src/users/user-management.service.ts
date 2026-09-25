import { randomUUID } from 'node:crypto';
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
  AuditAction,
  AuditOutcome,
  AuditTargetType,
  SessionRevocationReason,
  type Prisma,
} from '../generated/prisma/client.js';
import type {
  CreateManagedUserDto,
  EmployeeProfileResponseDto,
  ListUsersQueryDto,
  ToggleUserAccessDto,
  UpdateEmployeeProfileRequestDto,
  UpdateManagedUserDto,
} from './user.dto.js';
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

function parseDateOnly(dateStr: string | null | undefined): Date | null | undefined {
  if (dateStr === undefined) return undefined;
  if (dateStr === null || dateStr.trim() === '') return null;
  const parts = dateStr.trim().split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new BadRequestException('Formato de data inválido. Use AAAA-MM-DD.');
  }
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateOnly(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date.toISOString().slice(0, 10);
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
    const rawPassword =
      input.password?.trim() || (input.accessEnabled === false ? randomUUID() : '');
    if (!rawPassword) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'A senha é obrigatória para usuários com acesso ativo.',
      });
    }
    const passwordHash = await this.passwords.hash(rawPassword);

    try {
      const user = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.user.create({
          data: {
            name: input.name.trim(),
            login,
            normalizedLogin: normalizeLogin(login),
            passwordHash,
            role,
            accessEnabled: input.accessEnabled ?? true,
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
      await this.sessions.revokeAllForUser(
        current.id,
        SessionRevocationReason.PASSWORD_RESET,
        transaction,
      );
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

  public async toggleAccess(
    role: UserRole,
    actor: MutationActor,
    userId: string,
    input: ToggleUserAccessDto,
    context: ClientContext,
  ): Promise<UserViewDto> {
    const user = await this.prisma.$transaction(async (transaction) => {
      const current = await this.lockAndFind(transaction, role, userId);
      const isEnabling = input.accessEnabled && !current.accessEnabled;

      let passwordHash: string | undefined;
      if (input.accessEnabled) {
        if (input.password?.trim()) {
          passwordHash = await this.passwords.hash(input.password.trim());
        } else if (isEnabling) {
          throw new BadRequestException({
            code: 'PASSWORD_REQUIRED',
            message: 'Uma senha válida é obrigatória para habilitar o acesso ao aplicativo.',
          });
        }
      }

      if (current.accessEnabled === input.accessEnabled && !passwordHash) {
        return current;
      }

      const updated = await transaction.user.update({
        where: { id: current.id },
        data: {
          accessEnabled: input.accessEnabled,
          ...(passwordHash ? { passwordHash } : {}),
        },
        select: safeUserSelect,
      });

      if (!input.accessEnabled) {
        await this.sessions.revokeAllForUser(
          current.id,
          SessionRevocationReason.ACCESS_DISABLED,
          transaction,
        );
      }

      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.EMPLOYEE_ACCESS_UPDATED,
          outcome: AuditOutcome.SUCCESS,
          targetType: AuditTargetType.USER,
          targetId: updated.id,
          ...context,
          beforeState: { accessEnabled: current.accessEnabled },
          afterState: { accessEnabled: updated.accessEnabled },
        },
        transaction,
      );

      return updated;
    });

    return toUserView(user);
  }

  public async getEmployeeProfile(userId: string): Promise<EmployeeProfileResponseDto> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, role: 'EMPLOYEE' },
      include: {
        employeeProfile: true,
      },
    });

    if (!user) {
      throw resourceNotFound();
    }

    const profile = user.employeeProfile;

    return {
      userId: user.id,
      cpf: profile?.cpf ?? null,
      rg: profile?.rg ?? null,
      birthDate: formatDateOnly(profile?.birthDate),
      phone: profile?.phone ?? null,
      personalEmail: profile?.personalEmail ?? null,
      addressStreet: profile?.addressStreet ?? null,
      addressNumber: profile?.addressNumber ?? null,
      addressComplement: profile?.addressComplement ?? null,
      addressNeighborhood: profile?.addressNeighborhood ?? null,
      addressCity: profile?.addressCity ?? null,
      addressState: profile?.addressState ?? null,
      addressPostalCode: profile?.addressPostalCode ?? null,
      hireDate: formatDateOnly(profile?.hireDate),
      notes: profile?.notes ?? null,
      accessEnabled: user.accessEnabled,
      isActive: user.isActive,
      createdAt: (profile?.createdAt ?? user.createdAt).toISOString(),
      updatedAt: (profile?.updatedAt ?? user.updatedAt).toISOString(),
    };
  }

  public async updateEmployeeProfile(
    actor: MutationActor,
    userId: string,
    input: UpdateEmployeeProfileRequestDto,
    context: ClientContext,
  ): Promise<EmployeeProfileResponseDto> {
    const result = await this.prisma.$transaction(async (transaction) => {
      const user = await this.lockAndFind(transaction, 'EMPLOYEE', userId);

      const existingProfile = await transaction.employeeProfile.findUnique({
        where: { userId },
      });

      const birthDate = parseDateOnly(input.birthDate);
      const hireDate = parseDateOnly(input.hireDate);

      const profile = await transaction.employeeProfile.upsert({
        where: { userId },
        create: {
          userId,
          cpf: input.cpf !== undefined ? input.cpf?.trim() || null : null,
          rg: input.rg !== undefined ? input.rg?.trim() || null : null,
          birthDate: birthDate !== undefined ? birthDate : null,
          phone: input.phone !== undefined ? input.phone?.trim() || null : null,
          personalEmail:
            input.personalEmail !== undefined ? input.personalEmail?.trim() || null : null,
          addressStreet:
            input.addressStreet !== undefined ? input.addressStreet?.trim() || null : null,
          addressNumber:
            input.addressNumber !== undefined ? input.addressNumber?.trim() || null : null,
          addressComplement:
            input.addressComplement !== undefined ? input.addressComplement?.trim() || null : null,
          addressNeighborhood:
            input.addressNeighborhood !== undefined
              ? input.addressNeighborhood?.trim() || null
              : null,
          addressCity: input.addressCity !== undefined ? input.addressCity?.trim() || null : null,
          addressState:
            input.addressState !== undefined
              ? input.addressState?.trim().toUpperCase() || null
              : null,
          addressPostalCode:
            input.addressPostalCode !== undefined ? input.addressPostalCode?.trim() || null : null,
          hireDate: hireDate !== undefined ? hireDate : null,
          notes: input.notes !== undefined ? input.notes?.trim() || null : null,
        },
        update: {
          ...(input.cpf !== undefined ? { cpf: input.cpf?.trim() || null } : {}),
          ...(input.rg !== undefined ? { rg: input.rg?.trim() || null } : {}),
          ...(birthDate !== undefined ? { birthDate } : {}),
          ...(input.phone !== undefined ? { phone: input.phone?.trim() || null } : {}),
          ...(input.personalEmail !== undefined
            ? { personalEmail: input.personalEmail?.trim() || null }
            : {}),
          ...(input.addressStreet !== undefined
            ? { addressStreet: input.addressStreet?.trim() || null }
            : {}),
          ...(input.addressNumber !== undefined
            ? { addressNumber: input.addressNumber?.trim() || null }
            : {}),
          ...(input.addressComplement !== undefined
            ? { addressComplement: input.addressComplement?.trim() || null }
            : {}),
          ...(input.addressNeighborhood !== undefined
            ? { addressNeighborhood: input.addressNeighborhood?.trim() || null }
            : {}),
          ...(input.addressCity !== undefined
            ? { addressCity: input.addressCity?.trim() || null }
            : {}),
          ...(input.addressState !== undefined
            ? { addressState: input.addressState?.trim().toUpperCase() || null }
            : {}),
          ...(input.addressPostalCode !== undefined
            ? { addressPostalCode: input.addressPostalCode?.trim() || null }
            : {}),
          ...(hireDate !== undefined ? { hireDate } : {}),
          ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
        },
      });

      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.EMPLOYEE_PROFILE_UPDATED,
          outcome: AuditOutcome.SUCCESS,
          targetType: AuditTargetType.EMPLOYEE_PROFILE,
          targetId: userId,
          ...context,
          beforeState: existingProfile
            ? {
                cpf: existingProfile.cpf,
                rg: existingProfile.rg,
                hireDate: formatDateOnly(existingProfile.hireDate),
              }
            : {},
          afterState: {
            cpf: profile.cpf,
            rg: profile.rg,
            hireDate: formatDateOnly(profile.hireDate),
          },
        },
        transaction,
      );

      return {
        userId: user.id,
        cpf: profile.cpf,
        rg: profile.rg,
        birthDate: formatDateOnly(profile.birthDate),
        phone: profile.phone,
        personalEmail: profile.personalEmail,
        addressStreet: profile.addressStreet,
        addressNumber: profile.addressNumber,
        addressComplement: profile.addressComplement,
        addressNeighborhood: profile.addressNeighborhood,
        addressCity: profile.addressCity,
        addressState: profile.addressState,
        addressPostalCode: profile.addressPostalCode,
        hireDate: formatDateOnly(profile.hireDate),
        notes: profile.notes,
        accessEnabled: user.accessEnabled,
        isActive: user.isActive,
        createdAt: profile.createdAt.toISOString(),
        updatedAt: profile.updatedAt.toISOString(),
      };
    });

    return result;
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
