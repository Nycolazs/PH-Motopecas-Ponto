import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { UserRole } from '@ph-ponto/shared';

import type { Prisma } from '../generated/prisma/client.js';

interface LockedUserRow {
  id: string;
  role: UserRole;
  isActive: boolean;
}

function isLockTimeoutError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const message = (error as { message?: string }).message ?? '';
  if (message.includes('55P03') || message.toLowerCase().includes('lock timeout')) {
    return true;
  }

  const code = databaseCode(error);
  return code === '55P03';
}

function databaseCode(error: unknown, depth = 0): string | undefined {
  if (depth > 5 || typeof error !== 'object' || error === null) {
    return undefined;
  }

  // Prioritize actual Postgres SQLSTATE codes over generic Prisma error codes (like P2010)
  for (const property of ['sqlState', 'originalCode'] as const) {
    const value = (error as Record<string, unknown>)[property];
    if (typeof value === 'string' && value.length === 5) {
      return value;
    }
  }

  const meta = (error as Record<string, unknown>).meta;
  if (typeof meta === 'object' && meta !== null) {
    const metaCode = (meta as Record<string, unknown>).code;
    if (typeof metaCode === 'string' && metaCode.length === 5) {
      return metaCode;
    }
  }

  for (const property of ['code'] as const) {
    const value = (error as Record<string, unknown>)[property];
    if (typeof value === 'string' && value !== 'P2010') {
      return value;
    }
  }

  for (const property of ['cause', 'meta', 'driverAdapterError'] as const) {
    const nested = databaseCode((error as Record<string, unknown>)[property], depth + 1);
    if (nested !== undefined) {
      return nested;
    }
  }

  return undefined;
}

@Injectable()
export class MutationLockService {
  public async acquireIdempotencyLock(
    transaction: Prisma.TransactionClient,
    lockIdentity: string,
  ): Promise<void> {
    await transaction.$queryRaw`SELECT set_config('lock_timeout', '10000ms', true)`;

    try {
      await transaction.$queryRaw`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${`ph-ponto:idempotency:${lockIdentity}`}, 0)
        )::text AS "acquired"
      `;
    } catch (error) {
      if (isLockTimeoutError(error)) {
        throw new ConflictException({
          code: 'IDEMPOTENCY_BUSY',
          message: 'Esta solicitação ainda está sendo processada. Tente novamente.',
        });
      }

      throw error;
    }
  }

  public async lockActor(
    transaction: Prisma.TransactionClient,
    actorId: string,
    requiredRole: UserRole,
  ): Promise<LockedUserRow> {
    const rows = await transaction.$queryRaw<LockedUserRow[]>`
      SELECT "id", "role", "is_active" AS "isActive"
      FROM "users"
      WHERE "id" = ${actorId}::uuid
      FOR UPDATE
    `;
    const actor = rows[0];

    if (actor === undefined || actor.role !== requiredRole) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Você não tem permissão para esta ação.',
      });
    }

    if (!actor.isActive) {
      throw new ForbiddenException({
        code: 'USER_INACTIVE',
        message: 'Este usuário está inativo.',
      });
    }

    return actor;
  }

  public async lockEmployee(
    transaction: Prisma.TransactionClient,
    employeeId: string,
    requireActive: boolean,
  ): Promise<LockedUserRow> {
    const rows = await transaction.$queryRaw<LockedUserRow[]>`
      SELECT "id", "role", "is_active" AS "isActive"
      FROM "users"
      WHERE "id" = ${employeeId}::uuid
      FOR UPDATE
    `;
    const employee = rows[0];

    if (employee === undefined || employee.role !== 'EMPLOYEE') {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Funcionário não encontrado.',
      });
    }

    if (requireActive && !employee.isActive) {
      throw new ForbiddenException({
        code: 'USER_INACTIVE',
        message: 'Este funcionário está inativo.',
      });
    }

    return employee;
  }

  public async lockEmployeeStream(
    transaction: Prisma.TransactionClient,
    employeeId: string,
  ): Promise<void> {
    await transaction.$queryRaw`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${`ph-ponto:employee-stream:${employeeId}`}, 0)
      )::text AS "acquired"
    `;
  }
}
