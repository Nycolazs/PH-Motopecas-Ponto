import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { ClientContext } from '../auth/client-context.service.js';
import type { PrismaService } from '../database/prisma.service.js';
import { AuditAction, AuditTargetType, UserRole } from '../generated/prisma/client.js';
import { businessDateToDatabaseDate } from '../schedules/business-date.js';
import { VacationsService } from './vacations.service.js';

const actor: AuthenticatedUser = {
  id: '10000000-0000-4000-8000-000000000001',
  name: 'Administrador',
  login: 'admin',
  role: 'ADMIN',
  sessionId: '20000000-0000-4000-8000-000000000001',
};

const context: ClientContext = {
  ipHash: 'a'.repeat(64),
  requestId: 'request-1',
};

const employeeId = '10000000-0000-4000-8000-000000000002';

describe('VacationsService', () => {
  it('rejects invalid date range where startDate is after endDate', async () => {
    const prisma = {} as unknown as PrismaService;
    const audit = { record: vi.fn() } as unknown as AuditService;
    const service = new VacationsService(prisma, audit);

    await expect(
      service.create(
        actor,
        {
          employeeId,
          startDate: '2026-09-30',
          endDate: '2026-09-01',
        },
        context,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects if employee is not found or is an admin', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: employeeId, role: UserRole.ADMIN }),
      },
    } as unknown as PrismaService;
    const audit = { record: vi.fn() } as unknown as AuditService;
    const service = new VacationsService(prisma, audit);

    await expect(
      service.create(
        actor,
        {
          employeeId,
          startDate: '2026-09-01',
          endDate: '2026-09-30',
        },
        context,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects if employee already has overlapping vacation', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: employeeId,
          name: 'João',
          login: 'joao',
          role: UserRole.EMPLOYEE,
          isActive: true,
        }),
      },
      vacation: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'v-existing',
          startDate: businessDateToDatabaseDate('2026-09-10'),
          endDate: businessDateToDatabaseDate('2026-09-20'),
        }),
      },
    } as unknown as PrismaService;
    const audit = { record: vi.fn() } as unknown as AuditService;
    const service = new VacationsService(prisma, audit);

    await expect(
      service.create(
        actor,
        {
          employeeId,
          startDate: '2026-09-01',
          endDate: '2026-09-15',
        },
        context,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('creates vacation and records audit log when valid', async () => {
    const createdVacation = {
      id: '40000000-0000-4000-8000-000000000001',
      employeeId,
      startDate: businessDateToDatabaseDate('2026-09-01'),
      endDate: businessDateToDatabaseDate('2026-09-30'),
      note: 'Férias regulares 2026',
      createdById: actor.id,
      createdAt: new Date('2026-08-19T12:00:00.000Z'),
      updatedAt: new Date('2026-08-19T12:00:00.000Z'),
      employee: { id: employeeId, name: 'João Silva', login: 'joao.silva' },
      createdBy: { id: actor.id, name: actor.name, login: actor.login },
    };

    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: employeeId,
          name: 'João Silva',
          login: 'joao.silva',
          role: UserRole.EMPLOYEE,
          isActive: true,
        }),
      },
      vacation: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      $transaction: vi.fn().mockImplementation(async (callback) => {
        const tx = {
          vacation: {
            create: vi.fn().mockResolvedValue(createdVacation),
          },
        };
        return callback(tx);
      }),
    } as unknown as PrismaService;

    const audit = {
      record: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    const service = new VacationsService(prisma, audit);
    const result = await service.create(
      actor,
      {
        employeeId,
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        note: 'Férias regulares 2026',
      },
      context,
    );

    expect(result.id).toBe(createdVacation.id);
    expect(result.startDate).toBe('2026-09-01');
    expect(result.endDate).toBe('2026-09-30');
    expect(result.daysCount).toBe(30);
    expect(result.employee.name).toBe('João Silva');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.VACATION_CREATED,
        targetType: AuditTargetType.VACATION,
      }),
      expect.anything(),
    );
  });

  it('deletes vacation and records audit log', async () => {
    const existing = {
      id: '40000000-0000-4000-8000-000000000001',
      employeeId,
      startDate: businessDateToDatabaseDate('2026-09-01'),
      endDate: businessDateToDatabaseDate('2026-09-30'),
      note: 'Férias',
      employee: { id: employeeId, name: 'João Silva', login: 'joao.silva' },
    };

    const prisma = {
      vacation: {
        findUnique: vi.fn().mockResolvedValue(existing),
      },
      $transaction: vi.fn().mockImplementation(async (callback) => {
        const tx = {
          vacation: {
            delete: vi.fn().mockResolvedValue(existing),
          },
        };
        return callback(tx);
      }),
    } as unknown as PrismaService;

    const audit = {
      record: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    const service = new VacationsService(prisma, audit);
    const result = await service.delete(actor, existing.id, context);

    expect(result.success).toBe(true);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.VACATION_DELETED,
        targetType: AuditTargetType.VACATION,
        targetId: existing.id,
      }),
      expect.anything(),
    );
  });
});
