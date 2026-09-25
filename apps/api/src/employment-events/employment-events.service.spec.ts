import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AuditAction,
  AuditTargetType,
  SessionRevocationReason,
} from '../generated/prisma/client.js';
import type { PrismaService } from '../database/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { RefreshSessionService } from '../auth/refresh-session.service.js';
import { EmploymentEventsService } from './employment-events.service.js';

interface EmploymentEventsPrismaMock {
  user: {
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  employmentEvent: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
}

interface AuditMock {
  record: ReturnType<typeof vi.fn>;
}

interface SessionsMock {
  revokeAllForUser: ReturnType<typeof vi.fn>;
}

describe('EmploymentEventsService', () => {
  let service: EmploymentEventsService;
  let prisma: EmploymentEventsPrismaMock;
  let audit: AuditMock;
  let sessions: SessionsMock;

  const mockContext = {
    clientIp: '127.0.0.1',
    userAgent: 'test-agent',
    requestId: 'req-1',
  };

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      employmentEvent: {
        create: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
      $transaction: vi.fn((fn: (tx: EmploymentEventsPrismaMock) => unknown) => fn(prisma)),
    };

    audit = {
      record: vi.fn().mockResolvedValue(undefined),
    };

    sessions = {
      revokeAllForUser: vi.fn().mockResolvedValue(undefined),
    };

    service = new EmploymentEventsService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      sessions as unknown as RefreshSessionService,
    );
  });

  describe('createEvent', () => {
    it('creates an employment event and records audit', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'emp-1', name: 'João Silva' });
      prisma.employmentEvent.create.mockResolvedValue({
        id: 'evt-1',
        employeeId: 'emp-1',
        eventType: 'NOTE',
        effectiveDate: new Date('2026-09-25T00:00:00.000Z'),
        title: 'Feedback positivo',
        description: 'Elogio do cliente',
        metadata: { client: 'Carlos' },
        createdById: 'admin-1',
        createdBy: { id: 'admin-1', name: 'Admin Geral' },
        createdAt: new Date('2026-09-25T10:00:00.000Z'),
      });

      const result = await service.createEvent(
        'admin-1',
        'emp-1',
        {
          eventType: 'NOTE',
          effectiveDate: '2026-09-25',
          title: 'Feedback positivo',
          description: 'Elogio do cliente',
          metadata: { client: 'Carlos' },
        },
        mockContext,
      );

      expect(result.id).toBe('evt-1');
      expect(result.effectiveDate).toBe('2026-09-25');
      expect(result.title).toBe('Feedback positivo');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.EMPLOYMENT_EVENT_CREATED,
          targetType: AuditTargetType.EMPLOYMENT_EVENT,
          targetId: 'evt-1',
        }),
      );
    });

    it('throws NotFoundException if employee not found', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.createEvent(
          'admin-1',
          'emp-nonexistent',
          {
            eventType: 'NOTE',
            effectiveDate: '2026-09-25',
            title: 'Teste',
          },
          mockContext,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('terminate', () => {
    it('deactivates user, revokes sessions, and records termination event', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'emp-1',
        name: 'João Silva',
        isActive: true,
      });

      const result = await service.terminate(
        'admin-1',
        'emp-1',
        {
          effectiveDate: '2026-09-25',
          reason: 'WITHOUT_CAUSE',
          notes: 'Rescisão sem justa causa',
        },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'emp-1' },
        data: { isActive: false, accessEnabled: false },
      });
      expect(sessions.revokeAllForUser).toHaveBeenCalledWith(
        'emp-1',
        SessionRevocationReason.USER_DEACTIVATED,
        expect.anything(),
      );
      expect(prisma.employmentEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          employeeId: 'emp-1',
          eventType: 'TERMINATION',
        }),
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.EMPLOYEE_TERMINATED,
          targetType: AuditTargetType.USER,
          targetId: 'emp-1',
        }),
        expect.anything(),
      );
    });

    it('throws BadRequestException if employee is already inactive', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'emp-1',
        name: 'João Silva',
        isActive: false,
      });

      await expect(
        service.terminate(
          'admin-1',
          'emp-1',
          {
            effectiveDate: '2026-09-25',
            reason: 'WITHOUT_CAUSE',
          },
          mockContext,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('reactivate', () => {
    it('reactivates inactive employee and records reactivation event', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'emp-1',
        name: 'João Silva',
        isActive: false,
      });

      const result = await service.reactivate(
        'admin-1',
        'emp-1',
        {
          effectiveDate: '2026-09-25',
          notes: 'Recontratação',
        },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'emp-1' },
        data: { isActive: true },
      });
      expect(prisma.employmentEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          employeeId: 'emp-1',
          eventType: 'REACTIVATION',
        }),
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.EMPLOYEE_REACTIVATED,
          targetType: AuditTargetType.USER,
          targetId: 'emp-1',
        }),
        expect.anything(),
      );
    });

    it('throws BadRequestException if employee is already active', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'emp-1',
        name: 'João Silva',
        isActive: true,
      });

      await expect(
        service.reactivate(
          'admin-1',
          'emp-1',
          {
            effectiveDate: '2026-09-25',
          },
          mockContext,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('revokeSessions', () => {
    it('revokes all sessions for employee', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'emp-1' });

      const result = await service.revokeSessions('admin-1', 'emp-1', mockContext);

      expect(result.success).toBe(true);
      expect(sessions.revokeAllForUser).toHaveBeenCalledWith(
        'emp-1',
        SessionRevocationReason.ADMIN_ACTION,
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.USER_UPDATED,
          targetType: AuditTargetType.USER,
          targetId: 'emp-1',
        }),
      );
    });
  });
});
