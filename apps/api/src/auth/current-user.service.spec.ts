import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../database/prisma.service.js';
import type { AccessTokenClaims } from './auth.types.js';
import { CurrentUserService } from './current-user.service.js';

const claims: AccessTokenClaims = {
  sub: '487d962c-c34d-486b-83be-c1aac9772f9d',
  role: 'EMPLOYEE',
  sid: '23144362-e369-49e4-9241-1920b05e32f7',
  type: 'access',
};

function session(overrides: Record<string, unknown> = {}) {
  return {
    revokedAt: null,
    expiresAt: new Date('2026-08-20T12:00:00.000Z'),
    absoluteExpiresAt: new Date('2026-09-01T12:00:00.000Z'),
    user: {
      id: claims.sub,
      name: 'Ana Souza',
      login: 'ana.souza',
      role: 'EMPLOYEE',
      isActive: true,
    },
    ...overrides,
  };
}

describe('CurrentUserService', () => {
  it('returns the database-authoritative active identity', async () => {
    const prisma = {
      refreshSession: { findUnique: vi.fn().mockResolvedValue(session()) },
    } as unknown as PrismaService;
    const service = new CurrentUserService(prisma, () => new Date('2026-08-14T12:00:00.000Z'));

    await expect(service.resolve(claims)).resolves.toEqual({
      id: claims.sub,
      name: 'Ana Souza',
      login: 'ana.souza',
      role: 'EMPLOYEE',
      sessionId: claims.sid,
    });
  });

  it.each([
    ['inactive user', { user: { ...session().user, isActive: false } }],
    ['revoked session', { revokedAt: new Date('2026-08-14T11:00:00.000Z') }],
    ['expired idle session', { expiresAt: new Date('2026-08-14T11:00:00.000Z') }],
    ['changed role', { user: { ...session().user, role: 'ADMIN' } }],
  ])('rejects an access token for %s', async (_label, overrides) => {
    const prisma = {
      refreshSession: { findUnique: vi.fn().mockResolvedValue(session(overrides)) },
    } as unknown as PrismaService;
    const service = new CurrentUserService(prisma, () => new Date('2026-08-14T12:00:00.000Z'));

    await expect(service.resolve(claims)).rejects.toMatchObject({ status: 401 });
  });
});
