import { randomUUID } from 'node:crypto';

import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { SessionRevocationReason, UserRole, Weekday } from '../src/generated/prisma/client.js';
import { clearApplicationData } from './database-test-helpers.js';

const VALID_PASSWORD_HASH = `$argon2id$v=19$m=65536,t=3,p=1$${'a'.repeat(32)}$${'b'.repeat(43)}`;
const weekdays = Object.values(Weekday);

async function createUser(
  prisma: PrismaService,
  login: string,
  role: UserRole,
): Promise<{ id: string }> {
  return prisma.user.create({
    data: {
      name: `Usuário ${login}`,
      login,
      normalizedLogin: login.toLocaleLowerCase('pt-BR'),
      passwordHash: VALID_PASSWORD_HASH,
      role,
    },
    select: { id: true },
  });
}

describe('initial PostgreSQL contract', () => {
  let moduleReference: TestingModule;
  let prisma: PrismaService;

  beforeAll(async () => {
    moduleReference = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = moduleReference.get(PrismaService);
  });

  beforeEach(async () => {
    await clearApplicationData(prisma);
  });

  afterAll(async () => {
    await clearApplicationData(prisma);
    await moduleReference.close();
  });

  it('enforces case-insensitive login uniqueness in PostgreSQL', async () => {
    await createUser(prisma, 'Administrador', UserRole.ADMIN);

    await expect(
      prisma.user.create({
        data: {
          name: 'Outro administrador',
          login: 'ADMINISTRADOR',
          normalizedLogin: 'outro-identificador',
          passwordHash: VALID_PASSWORD_HASH,
          role: UserRole.ADMIN,
        },
      }),
    ).rejects.toBeDefined();
  });

  it('protects the final active administrator even below the service layer', async () => {
    const firstAdmin = await createUser(prisma, 'admin.one', UserRole.ADMIN);

    await expect(
      prisma.user.update({ where: { id: firstAdmin.id }, data: { isActive: false } }),
    ).rejects.toBeDefined();

    await createUser(prisma, 'admin.two', UserRole.ADMIN);
    const deactivated = await prisma.user.update({
      where: { id: firstAdmin.id },
      data: { isActive: false },
    });
    expect(deactivated.isActive).toBe(false);
  });

  it('requires every schedule version to contain all seven immutable weekdays', async () => {
    const admin = await createUser(prisma, 'schedule.admin', UserRole.ADMIN);

    await expect(
      prisma.$transaction((transaction) =>
        transaction.businessScheduleVersion.create({
          data: { effectiveDate: new Date('2026-01-01T00:00:00.000Z'), createdById: admin.id },
        }),
      ),
    ).rejects.toBeDefined();

    const schedule = await prisma.businessScheduleVersion.create({
      data: {
        effectiveDate: new Date('2026-01-02T00:00:00.000Z'),
        createdById: admin.id,
        days: {
          create: weekdays.map((weekday) => ({
            weekday,
            isOpen: false,
            openingMinute: null,
            closingMinute: null,
            lunchEnabled: false,
            lunchStartMinute: null,
            lunchEndMinute: null,
          })),
        },
      },
      include: { days: true },
    });
    expect(schedule.days).toHaveLength(7);

    await expect(
      prisma.businessScheduleDay.update({
        where: { id: schedule.days[0]!.id },
        data: { isOpen: true },
      }),
    ).rejects.toBeDefined();
  });

  it('keeps audit rows append-only', async () => {
    const admin = await createUser(prisma, 'audit.admin', UserRole.ADMIN);
    const audit = await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: 'LOGIN_SUCCEEDED',
        targetType: 'AUTH_SESSION',
        targetId: randomUUID(),
        requestId: 'integration-request-id',
      },
    });

    await expect(
      prisma.auditLog.update({ where: { id: audit.id }, data: { targetId: randomUUID() } }),
    ).rejects.toBeDefined();
    await expect(prisma.auditLog.delete({ where: { id: audit.id } })).rejects.toBeDefined();
  });

  it('supports multi-generation refresh chains and atomic family revocation', async () => {
    const admin = await createUser(prisma, 'session.admin', UserRole.ADMIN);
    const familyId = randomUUID();
    const absoluteExpiresAt = new Date(Date.now() + 86_400_000);
    const expiresAt = new Date(Date.now() + 3_600_000);
    const sessionIds = [randomUUID(), randomUUID(), randomUUID()];

    await prisma.refreshSession.create({
      data: {
        id: sessionIds[0],
        userId: admin.id,
        familyId,
        tokenHash: '1'.repeat(64),
        expiresAt,
        absoluteExpiresAt,
      },
    });

    for (let index = 1; index < sessionIds.length; index += 1) {
      await prisma.refreshSession.create({
        data: {
          id: sessionIds[index],
          userId: admin.id,
          familyId,
          tokenHash: String(index + 1).repeat(64),
          expiresAt,
          absoluteExpiresAt,
        },
      });
      await prisma.refreshSession.update({
        where: { id: sessionIds[index - 1] },
        data: {
          rotatedAt: new Date(),
          replacedBySessionId: sessionIds[index],
          lastUsedAt: new Date(),
        },
      });
    }

    const revoked = await prisma.refreshSession.updateMany({
      where: { familyId, revokedAt: null },
      data: {
        revokedAt: new Date(),
        revocationReason: SessionRevocationReason.REFRESH_REUSE,
      },
    });
    expect(revoked.count).toBe(3);

    const sessions = await prisma.refreshSession.findMany({ where: { familyId } });
    expect(sessions).toHaveLength(3);
    expect(sessions.every((session) => session.revokedAt !== null)).toBe(true);
  });
});
