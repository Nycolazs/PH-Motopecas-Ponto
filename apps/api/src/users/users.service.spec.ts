import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import type { AuditService } from '../audit/audit.service.js';
import type { PasswordService } from '../auth/password.service.js';
import type { PrismaService } from '../database/prisma.service.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  it('returns only the safe active-user profile view', async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: '30000000-0000-4000-8000-000000000001',
      name: 'João da Silva',
      login: 'joao.silva',
      role: 'EMPLOYEE',
      isActive: true,
      createdAt: new Date('2026-08-15T00:00:00.000Z'),
      updatedAt: new Date('2026-08-15T01:00:00.000Z'),
      avatar: { id: '40000000-0000-4000-8000-000000000001' },
      passwordHash: 'must-not-leak',
    });
    const service = new UsersService(
      { user: { findFirst } } as unknown as PrismaService,
      {} as unknown as PasswordService,
      {} as unknown as AuditService,
    );

    const result = await service.getOwnProfile('30000000-0000-4000-8000-000000000001');

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: '30000000-0000-4000-8000-000000000001', isActive: true },
      }),
    );
    expect(result).toMatchObject({ login: 'joao.silva', hasAvatar: true });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('changes password successfully when current password is valid', async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: 'user-1',
      role: 'EMPLOYEE',
      passwordHash: 'old-hash',
    });
    const update = vi.fn().mockResolvedValue({ id: 'user-1' });
    const $transaction = vi
      .fn()
      .mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        return callback({ user: { update } });
      });
    const prisma = { user: { findFirst }, $transaction } as unknown as PrismaService;
    const passwords = {
      verify: vi.fn().mockResolvedValue({ valid: true, needsRehash: false }),
      hash: vi.fn().mockResolvedValue('new-hash'),
    } as unknown as PasswordService;
    const audit = { record: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;

    const service = new UsersService(prisma, passwords, audit);

    await service.changeOwnPassword(
      'user-1',
      { currentPassword: 'correct-password', newPassword: 'new-secure-password' },
      { requestId: 'req-1', userAgent: 'test', ipHash: 'ip-hash' },
    );

    expect(passwords.verify).toHaveBeenCalledWith('correct-password', 'old-hash');
    expect(passwords.hash).toHaveBeenCalledWith('new-secure-password');
    expect(update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { passwordHash: 'new-hash' },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'user-1',
        action: 'USER_PASSWORD_RESET',
        targetType: 'USER',
        targetId: 'user-1',
      }),
      expect.anything(),
    );
  });

  it('rejects password change when current password is invalid', async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: 'user-1',
      role: 'EMPLOYEE',
      passwordHash: 'old-hash',
    });
    const prisma = { user: { findFirst } } as unknown as PrismaService;
    const passwords = {
      verify: vi.fn().mockResolvedValue({ valid: false, needsRehash: false }),
      hash: vi.fn(),
    } as unknown as PasswordService;
    const audit = { record: vi.fn() } as unknown as AuditService;

    const service = new UsersService(prisma, passwords, audit);

    await expect(
      service.changeOwnPassword(
        'user-1',
        { currentPassword: 'wrong-password', newPassword: 'new-secure-password' },
        { requestId: 'req-1', userAgent: 'test', ipHash: 'ip-hash' },
      ),
    ).rejects.toThrow(BadRequestException);

    expect(passwords.hash).not.toHaveBeenCalled();
  });

  it('rejects password change when user is not found', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const prisma = { user: { findFirst } } as unknown as PrismaService;
    const passwords = { verify: vi.fn() } as unknown as PasswordService;
    const audit = { record: vi.fn() } as unknown as AuditService;

    const service = new UsersService(prisma, passwords, audit);

    await expect(
      service.changeOwnPassword(
        'non-existent',
        { currentPassword: 'any', newPassword: 'new-secure-password' },
        { requestId: 'req-1', userAgent: 'test', ipHash: 'ip-hash' },
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
