import { HttpException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { describe, expect, it, vi } from 'vitest';

import type { AuditService } from '../audit/audit.service.js';
import type { PrismaService } from '../database/prisma.service.js';
import { SessionRevocationReason } from '../generated/prisma/client.js';
import { AuthService } from './auth.service.js';
import { ClientContextService } from './client-context.service.js';
import type { LoginRateLimiterService } from './login-rate-limiter.service.js';
import type { PasswordService } from './password.service.js';
import type { SessionRevocationService } from './session-revocation.service.js';
import { TokenService } from './token.service.js';
import type { AuthConfiguration, ClientContext } from './auth.types.js';

const configuration: AuthConfiguration = {
  accessSecret: 'test-access-secret-with-at-least-32-characters',
  refreshSecret: 'test-refresh-secret-with-at-least-32-characters',
  issuer: 'ph-ponto-api',
  audience: 'ph-ponto-desktop',
  accessTtlSeconds: 300,
  refreshIdleTtlSeconds: 604_800,
  refreshAbsoluteTtlSeconds: 2_592_000,
  loginWindowSeconds: 900,
  loginMaxAttempts: 5,
  loginBlockSeconds: 900,
};

const now = new Date('2026-08-14T12:00:00.000Z');
const context: ClientContext = {
  ipHash: 'a'.repeat(64),
  userAgent: 'PH-Ponto Desktop',
  requestId: 'auth-service-test',
};
const activeUser = {
  id: '487d962c-c34d-486b-83be-c1aac9772f9d',
  name: 'Ana Souza',
  login: 'ana.souza',
  normalizedLogin: 'ana.souza',
  passwordHash: '$argon2id$test',
  role: 'EMPLOYEE' as const,
  isActive: true,
};

function createHarness(
  options: {
    user?: typeof activeUser | null;
    currentUser?: Pick<typeof activeUser, 'isActive' | 'role' | 'passwordHash'> | null;
    session?: Record<string, unknown> | null;
    claimedCount?: number;
  } = {},
) {
  const userFindUnique = vi
    .fn()
    .mockResolvedValue(options.user === undefined ? activeUser : options.user);
  const refreshFindUnique = vi.fn().mockResolvedValue(options.session ?? null);
  const refreshCreate = vi.fn().mockResolvedValue({});
  const refreshUpdateMany = vi.fn().mockResolvedValue({ count: options.claimedCount ?? 1 });
  const refreshDelete = vi.fn().mockResolvedValue({});
  const throttleDeleteMany = vi.fn().mockResolvedValue({ count: 2 });
  const transaction = {
    user: {
      findUnique: vi.fn().mockResolvedValue(
        options.currentUser === undefined
          ? {
              isActive: activeUser.isActive,
              role: activeUser.role,
              passwordHash: activeUser.passwordHash,
            }
          : options.currentUser,
      ),
      update: vi.fn().mockResolvedValue({}),
    },
    refreshSession: {
      findUnique: refreshFindUnique,
      create: refreshCreate,
      updateMany: refreshUpdateMany,
      delete: refreshDelete,
    },
    loginThrottle: { deleteMany: throttleDeleteMany },
  };
  const prismaShape = {
    user: { findUnique: userFindUnique },
    $transaction: vi.fn(
      async (callback: (client: typeof transaction) => Promise<unknown>): Promise<unknown> =>
        callback(transaction),
    ),
  };
  const passwordShape = {
    verify: vi.fn().mockResolvedValue({ valid: true, needsRehash: false }),
    verifyUnknownLogin: vi.fn().mockResolvedValue(undefined),
    hash: vi.fn().mockResolvedValue('$argon2id$replacement'),
  };
  const rateLimiterShape = {
    consume: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  };
  const revocationShape = {
    revokeFamily: vi.fn().mockResolvedValue(2),
    revokeAllForUser: vi.fn().mockResolvedValue(2),
    revokeSession: vi.fn().mockResolvedValue(1),
  };
  const auditShape = { record: vi.fn().mockResolvedValue('audit-id') };
  const tokens = new TokenService(new JwtService(), configuration);
  const clientContexts = new ClientContextService(configuration);
  const service = new AuthService(
    prismaShape as unknown as PrismaService,
    passwordShape as unknown as PasswordService,
    tokens,
    rateLimiterShape as unknown as LoginRateLimiterService,
    revocationShape as unknown as SessionRevocationService,
    clientContexts,
    auditShape as unknown as AuditService,
    configuration,
    () => new Date(now),
  );

  return {
    service,
    tokens,
    transaction,
    userFindUnique,
    refreshFindUnique,
    refreshCreate,
    refreshUpdateMany,
    refreshDelete,
    throttleDeleteMany,
    passwordShape,
    rateLimiterShape,
    revocationShape,
    auditShape,
  };
}

describe('AuthService', () => {
  it('creates a persisted session for an active user and cleans device metadata', async () => {
    const harness = createHarness();

    const response = await harness.service.login(
      { login: '  ANA.SOUZA  ', password: 'senha correta', deviceName: '  Recepção\u0000  ' },
      context,
    );

    expect(response.user).toEqual({
      id: activeUser.id,
      name: activeUser.name,
      login: activeUser.login,
      role: activeUser.role,
    });
    expect(response.accessTokenExpiresInSeconds).toBe(300);
    expect(harness.refreshCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deviceName: 'Recepção', userId: activeUser.id }),
      }),
    );
    expect(harness.throttleDeleteMany).toHaveBeenCalledOnce();
    expect(harness.auditShape.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LOGIN_SUCCEEDED', actorId: activeUser.id }),
      harness.transaction,
    );
  });

  it.each([
    ['unknown login', null],
    ['inactive user', { ...activeUser, isActive: false }],
  ])('returns the same safe error for %s', async (_label, user) => {
    const harness = createHarness({ user });

    await expect(
      harness.service.login({ login: 'nao.existe', password: 'senha' }, context),
    ).rejects.toMatchObject({
      status: 401,
      response: { code: 'INVALID_CREDENTIALS', message: 'Login ou senha inválidos.' },
    });
    expect(harness.refreshCreate).not.toHaveBeenCalled();
    expect(harness.auditShape.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LOGIN_FAILED', outcome: 'FAILURE' }),
    );
  });

  it('stops before credential lookup when a throttle bucket is blocked', async () => {
    const harness = createHarness();
    harness.rateLimiterShape.consume.mockRejectedValueOnce(
      new HttpException({ code: 'LOGIN_RATE_LIMITED' }, 429),
    );

    await expect(
      harness.service.login({ login: 'ana.souza', password: 'senha' }, context),
    ).rejects.toMatchObject({ status: 429 });
    expect(harness.userFindUnique).not.toHaveBeenCalled();
    expect(harness.passwordShape.verify).not.toHaveBeenCalled();
  });

  it('does not create a session when the identity changes during password verification', async () => {
    const harness = createHarness({
      currentUser: { ...activeUser, isActive: false },
    });

    await expect(
      harness.service.login({ login: 'ana.souza', password: 'senha correta' }, context),
    ).rejects.toMatchObject({ status: 401 });
    expect(harness.refreshCreate).not.toHaveBeenCalled();
    expect(harness.auditShape.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'LOGIN_FAILED',
        metadata: { reason: 'identity_changed_during_login' },
      }),
      harness.transaction,
    );
  });

  it('rotates a valid refresh token with the database rotation pair in one update', async () => {
    const harness = createHarness();
    const original = harness.tokens.issueRefreshToken('23144362-e369-49e4-9241-1920b05e32f7');
    harness.refreshFindUnique.mockResolvedValueOnce({
      id: original.sessionId,
      userId: activeUser.id,
      familyId: '37ed5f69-72e2-4b6c-86d2-71a96e0ce85e',
      tokenHash: original.hash,
      expiresAt: new Date('2026-08-20T12:00:00.000Z'),
      absoluteExpiresAt: new Date('2026-09-01T12:00:00.000Z'),
      rotatedAt: null,
      revokedAt: null,
      deviceName: 'Recepção',
      user: activeUser,
    });

    const response = await harness.service.refresh(original.value, context);

    expect(response.refreshToken).not.toBe(original.value);
    const replacementId = harness.refreshCreate.mock.calls[0]![0].data.id as string;
    expect(harness.refreshUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          rotatedAt: now,
          lastUsedAt: now,
          replacedBySessionId: replacementId,
        },
      }),
    );
    expect(harness.refreshCreate.mock.invocationCallOrder[0]).toBeLessThan(
      harness.refreshUpdateMany.mock.invocationCallOrder[0]!,
    );
  });

  it('revokes a token family and audits detected refresh reuse', async () => {
    const harness = createHarness();
    const original = harness.tokens.issueRefreshToken('23144362-e369-49e4-9241-1920b05e32f7');
    harness.refreshFindUnique.mockResolvedValueOnce({
      id: original.sessionId,
      userId: activeUser.id,
      familyId: '37ed5f69-72e2-4b6c-86d2-71a96e0ce85e',
      tokenHash: original.hash,
      expiresAt: new Date('2026-08-20T12:00:00.000Z'),
      absoluteExpiresAt: new Date('2026-09-01T12:00:00.000Z'),
      rotatedAt: new Date('2026-08-14T11:00:00.000Z'),
      revokedAt: null,
      deviceName: null,
      user: activeUser,
    });

    await expect(harness.service.refresh(original.value, context)).rejects.toMatchObject({
      status: 401,
    });
    expect(harness.revocationShape.revokeFamily).toHaveBeenCalledWith(
      '37ed5f69-72e2-4b6c-86d2-71a96e0ce85e',
      SessionRevocationReason.REFRESH_REUSE,
      harness.transaction,
      now,
    );
    expect(harness.auditShape.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'REFRESH_REUSED', outcome: 'FAILURE' }),
      harness.transaction,
    );
    expect(harness.refreshCreate).not.toHaveBeenCalled();
  });

  it('rolls back the unused replacement logically when the rotation claim is lost', async () => {
    const harness = createHarness({ claimedCount: 0 });
    const original = harness.tokens.issueRefreshToken('23144362-e369-49e4-9241-1920b05e32f7');
    harness.refreshFindUnique.mockResolvedValueOnce({
      id: original.sessionId,
      userId: activeUser.id,
      familyId: '37ed5f69-72e2-4b6c-86d2-71a96e0ce85e',
      tokenHash: original.hash,
      expiresAt: new Date('2026-08-20T12:00:00.000Z'),
      absoluteExpiresAt: new Date('2026-09-01T12:00:00.000Z'),
      rotatedAt: null,
      revokedAt: null,
      deviceName: null,
      user: activeUser,
    });

    await expect(harness.service.refresh(original.value, context)).rejects.toMatchObject({
      status: 401,
    });
    expect(harness.refreshDelete).toHaveBeenCalledOnce();
    expect(harness.revocationShape.revokeFamily).toHaveBeenCalledWith(
      '37ed5f69-72e2-4b6c-86d2-71a96e0ce85e',
      SessionRevocationReason.REFRESH_REUSE,
      harness.transaction,
      now,
    );
  });

  it('revokes the complete family and audits logout in the same transaction', async () => {
    const harness = createHarness({
      session: { familyId: '37ed5f69-72e2-4b6c-86d2-71a96e0ce85e' },
    });

    await harness.service.logout(
      {
        id: activeUser.id,
        name: activeUser.name,
        login: activeUser.login,
        role: activeUser.role,
        sessionId: '23144362-e369-49e4-9241-1920b05e32f7',
      },
      context,
    );

    expect(harness.revocationShape.revokeFamily).toHaveBeenCalledWith(
      '37ed5f69-72e2-4b6c-86d2-71a96e0ce85e',
      SessionRevocationReason.LOGOUT,
      harness.transaction,
      now,
    );
    expect(harness.auditShape.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LOGOUT', actorId: activeUser.id }),
      harness.transaction,
    );
  });
});
