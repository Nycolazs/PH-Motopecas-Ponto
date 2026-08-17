import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../database/prisma.service.js';
import {
  AuditAction,
  AuditOutcome,
  AuditTargetType,
  type Prisma,
} from '../generated/prisma/client.js';
import { AuditService } from './audit.service.js';

describe('AuditService', () => {
  it('writes through the supplied transaction with bounded context', async () => {
    const create = vi.fn().mockResolvedValue({
      id: '40000000-0000-4000-8000-000000000001',
    });
    const transaction = { auditLog: { create } } as unknown as Prisma.TransactionClient;
    const service = new AuditService({} as PrismaService);

    const id = await service.record(
      {
        actorId: '10000000-0000-4000-8000-000000000001',
        action: AuditAction.USER_UPDATED,
        outcome: AuditOutcome.SUCCESS,
        targetType: AuditTargetType.USER,
        targetId: 'target',
        requestId: 'r'.repeat(80),
        ipHash: 'a'.repeat(64),
        userAgent: 'u'.repeat(600),
        beforeState: { isActive: true },
        afterState: { isActive: false },
      },
      transaction,
    );

    expect(id).toBe('40000000-0000-4000-8000-000000000001');
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        requestId: 'r'.repeat(64),
        userAgent: 'u'.repeat(512),
        beforeState: { isActive: true },
        afterState: { isActive: false },
      }),
      select: { id: true },
    });
  });

  it('rejects an inverted audit date range before querying', async () => {
    const service = new AuditService({} as PrismaService);

    await expect(
      service.list({
        page: 1,
        limit: 50,
        from: '2026-08-16T00:00:00.000Z',
        to: '2026-08-15T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
