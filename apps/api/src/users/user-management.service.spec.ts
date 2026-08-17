import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { PasswordService } from '../auth/password.service.js';
import type { SessionRevocationService } from '../auth/session-revocation.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { PrismaService } from '../database/prisma.service.js';
import { AuditAction, SessionRevocationReason, type Prisma } from '../generated/prisma/client.js';
import { UserManagementService } from './user-management.service.js';
import type { SafeUserRecord } from './user.view.js';

const EMPLOYEE_ACTIONS = {
  created: AuditAction.USER_CREATED,
  updated: AuditAction.USER_UPDATED,
  activated: AuditAction.USER_ACTIVATED,
  deactivated: AuditAction.USER_DEACTIVATED,
  passwordReset: AuditAction.USER_PASSWORD_RESET,
};

const ADMIN_ACTIONS = {
  created: AuditAction.ADMIN_CREATED,
  updated: AuditAction.ADMIN_UPDATED,
  activated: AuditAction.ADMIN_ACTIVATED,
  deactivated: AuditAction.ADMIN_DEACTIVATED,
  passwordReset: AuditAction.ADMIN_PASSWORD_RESET,
};

const actor = {
  id: '10000000-0000-4000-8000-000000000001',
  name: 'Administrador',
  login: 'admin',
  role: 'ADMIN' as const,
  sessionId: '20000000-0000-4000-8000-000000000001',
};

const context = {
  requestId: 'request-id',
  ipHash: 'a'.repeat(64),
  userAgent: 'PH-Ponto Test',
};

function userRecord(overrides: Partial<SafeUserRecord> = {}): SafeUserRecord {
  return {
    id: '30000000-0000-4000-8000-000000000001',
    name: 'João da Silva',
    login: 'joao.silva',
    role: 'EMPLOYEE',
    isActive: true,
    createdAt: new Date('2026-08-15T00:00:00.000Z'),
    updatedAt: new Date('2026-08-15T00:00:00.000Z'),
    avatar: null,
    ...overrides,
  };
}

function createFixture() {
  const transaction = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    user: {
      create: vi.fn().mockResolvedValue(userRecord()),
      findFirst: vi.fn().mockResolvedValue(userRecord()),
      update: vi.fn().mockResolvedValue(userRecord()),
      count: vi.fn().mockResolvedValue(2),
    },
  };
  const prisma = {
    user: {
      findFirst: vi.fn().mockResolvedValue(userRecord()),
    },
    $transaction: vi.fn(async (operation: unknown) => {
      if (typeof operation !== 'function') {
        throw new Error('Unexpected array transaction in this test.');
      }

      return (operation as (client: Prisma.TransactionClient) => Promise<unknown>)(
        transaction as unknown as Prisma.TransactionClient,
      );
    }),
  };
  const passwords = {
    hash: vi.fn().mockResolvedValue('argon2id-hash'),
  };
  const sessions = {
    revokeAllForUser: vi.fn().mockResolvedValue(1),
  };
  const audit = {
    record: vi.fn().mockResolvedValue('40000000-0000-4000-8000-000000000001'),
  };
  const service = new UserManagementService(
    prisma as unknown as PrismaService,
    passwords as unknown as PasswordService,
    sessions as unknown as SessionRevocationService,
    audit as unknown as AuditService,
  );

  return { service, prisma, transaction, passwords, sessions, audit };
}

describe('UserManagementService', () => {
  it('creates a user with normalized login, Argon2id output and atomic audit', async () => {
    const fixture = createFixture();

    const result = await fixture.service.create(
      'EMPLOYEE',
      EMPLOYEE_ACTIONS,
      actor,
      { name: ' João da Silva ', login: ' ＪＯＡＯ.SILVA ', password: 'safe-password-value' },
      context,
    );

    expect(fixture.passwords.hash).toHaveBeenCalledWith('safe-password-value');
    expect(fixture.transaction.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'João da Silva',
          login: 'ＪＯＡＯ.SILVA',
          normalizedLogin: 'joao.silva',
          passwordHash: 'argon2id-hash',
          role: 'EMPLOYEE',
        }),
      }),
    );
    expect(fixture.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.USER_CREATED, targetId: result.id }),
      fixture.transaction,
    );
    expect(result).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(fixture.audit.record.mock.calls)).not.toContain('argon2id-hash');
  });

  it('maps a case-insensitive unique-login violation to a safe conflict', async () => {
    const fixture = createFixture();
    fixture.prisma.$transaction.mockRejectedValueOnce({ code: 'P2002' });

    await expect(
      fixture.service.create(
        'EMPLOYEE',
        EMPLOYEE_ACTIONS,
        actor,
        { name: 'Outro usuário', login: 'JOAO.SILVA', password: 'safe-password-value' },
        context,
      ),
    ).rejects.toMatchObject({
      response: { code: 'LOGIN_ALREADY_EXISTS', message: 'Este login já está em uso.' },
    });
  });

  it('keeps role in the resource lookup predicate to prevent cross-role IDOR', async () => {
    const fixture = createFixture();
    fixture.prisma.user.findFirst.mockResolvedValueOnce(null);

    await expect(
      fixture.service.get('EMPLOYEE', '30000000-0000-4000-8000-000000000001'),
    ).rejects.toMatchObject({ response: { code: 'RESOURCE_NOT_FOUND' } });
    expect(fixture.prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: '30000000-0000-4000-8000-000000000001', role: 'EMPLOYEE' },
      }),
    );
  });

  it('rejects deactivation of the last active administrator', async () => {
    const fixture = createFixture();
    fixture.transaction.user.findFirst.mockResolvedValueOnce(userRecord({ role: 'ADMIN' }));
    fixture.transaction.user.count.mockResolvedValueOnce(1);

    await expect(
      fixture.service.updateStatus(
        'ADMIN',
        ADMIN_ACTIONS,
        actor,
        '30000000-0000-4000-8000-000000000001',
        false,
        context,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(fixture.transaction.user.update).not.toHaveBeenCalled();
    expect(fixture.sessions.revokeAllForUser).not.toHaveBeenCalled();
    expect(fixture.audit.record).not.toHaveBeenCalled();
  });

  it('deactivates, revokes sessions and audits in the same transaction', async () => {
    const fixture = createFixture();
    fixture.transaction.user.update.mockResolvedValueOnce(userRecord({ isActive: false }));

    const result = await fixture.service.updateStatus(
      'EMPLOYEE',
      EMPLOYEE_ACTIONS,
      actor,
      '30000000-0000-4000-8000-000000000001',
      false,
      context,
    );

    expect(result.isActive).toBe(false);
    expect(fixture.sessions.revokeAllForUser).toHaveBeenCalledWith(
      result.id,
      SessionRevocationReason.USER_DEACTIVATED,
      fixture.transaction,
    );
    expect(fixture.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.USER_DEACTIVATED,
        beforeState: expect.objectContaining({ isActive: true }),
        afterState: expect.objectContaining({ isActive: false }),
      }),
      fixture.transaction,
    );
  });

  it('resets a password without placing credentials or hashes in audit state', async () => {
    const fixture = createFixture();

    await fixture.service.resetPassword(
      'EMPLOYEE',
      EMPLOYEE_ACTIONS,
      actor,
      '30000000-0000-4000-8000-000000000001',
      'new-safe-password',
      context,
    );

    expect(fixture.transaction.user.update).toHaveBeenCalledWith({
      where: { id: '30000000-0000-4000-8000-000000000001' },
      data: { passwordHash: 'argon2id-hash' },
      select: { id: true },
    });
    expect(fixture.sessions.revokeAllForUser).not.toHaveBeenCalled();
    const auditPayload = JSON.stringify(fixture.audit.record.mock.calls);
    expect(auditPayload).not.toContain('new-safe-password');
    expect(auditPayload).not.toContain('argon2id-hash');
  });
});
