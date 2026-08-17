import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditService } from '../audit/audit.service.js';
import type { PrismaService } from '../database/prisma.service.js';
import { AdjustmentRequestStatus, AuditAction, TimePunchKind } from '../generated/prisma/client.js';
import type { TimeAdjustmentService } from '../time-adjustments/time-adjustment.service.js';
import { AdjustmentRequestsService } from './adjustment-requests.service.js';

describe('AdjustmentRequestsService', () => {
  let service: AdjustmentRequestsService;
  let prisma: {
    timePunch: { findFirst: ReturnType<typeof vi.fn> };
    timePunchAdjustmentRequest: {
      findFirst: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    timeAdjustment: { findFirst: ReturnType<typeof vi.fn> };
    $transaction: (cb: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
  };
  let timeAdjustments: { correct: ReturnType<typeof vi.fn> };
  let audit: { record: ReturnType<typeof vi.fn> };
  const mockClock = vi.fn();

  const employee = {
    id: '11111111-1111-1111-1111-111111111111',
    role: 'EMPLOYEE' as const,
    login: 'func.silva',
    name: 'Silva',
  };

  const admin = {
    id: '22222222-2222-2222-2222-222222222222',
    role: 'ADMIN' as const,
    login: 'adm.gestor',
    name: 'Gestor',
  };

  const context = {
    requestId: 'req-123',
    ipHash: 'ip-hash',
    userAgent: 'user-agent',
  };

  beforeEach(() => {
    mockClock.mockReturnValue(new Date('2026-08-16T14:00:00.000Z'));
    prisma = {
      timePunch: {
        findFirst: vi.fn(),
      },
      timePunchAdjustmentRequest: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      timeAdjustment: {
        findFirst: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => cb(prisma)),
    };
    timeAdjustments = {
      correct: vi.fn(),
    };
    audit = {
      record: vi.fn(),
    };

    service = new AdjustmentRequestsService(
      prisma as unknown as PrismaService,
      timeAdjustments as unknown as TimeAdjustmentService,
      audit as unknown as AuditService,
      mockClock,
    );
  });

  describe('create', () => {
    it('creates an adjustment request successfully for own punch', async () => {
      const punchId = '33333333-3333-3333-3333-333333333333';
      const occurredAt = new Date('2026-08-16T11:00:00.000Z');
      const requestedOccurredAt = '2026-08-16T11:15:00.000Z';

      prisma.timePunch.findFirst.mockResolvedValue({
        id: punchId,
        employeeId: employee.id,
        occurredAt,
        kind: TimePunchKind.CLOCK_IN,
        adjustments: [],
      });
      prisma.timePunchAdjustmentRequest.findFirst.mockResolvedValue(null);
      prisma.timePunchAdjustmentRequest.create.mockResolvedValue({
        id: 'req-1',
        timePunchId: punchId,
        employeeId: employee.id,
        status: AdjustmentRequestStatus.PENDING,
        requestedOccurredAt: new Date(requestedOccurredAt),
        currentOccurredAt: occurredAt,
        currentSequence: 0,
        reason: 'Cheguei 15 minutos mais tarde por causa do trânsito',
        reviewedById: null,
        reviewComment: null,
        reviewedAt: null,
        timeAdjustmentId: null,
        createdAt: new Date('2026-08-16T14:00:00.000Z'),
        updatedAt: new Date('2026-08-16T14:00:00.000Z'),
        employee: { id: employee.id, name: employee.name, login: employee.login },
        reviewedBy: null,
        timePunch: { kind: TimePunchKind.CLOCK_IN, occurredAt },
      });

      const result = await service.create(
        employee,
        {
          timePunchId: punchId,
          requestedOccurredAt,
          reason: 'Cheguei 15 minutos mais tarde por causa do trânsito',
        },
        context,
      );

      expect(result.id).toBe('req-1');
      expect(result.status).toBe(AdjustmentRequestStatus.PENDING);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.ADJUSTMENT_REQUEST_CREATED,
        }),
        expect.anything(),
      );
    });

    it('rejects future adjustment time', async () => {
      await expect(
        service.create(
          employee,
          {
            timePunchId: '33333333-3333-3333-3333-333333333333',
            requestedOccurredAt: '2026-08-16T15:00:00.000Z', // clock is 14:00
            reason: 'Hora futura',
          },
          context,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects if punch not found or does not belong to employee', async () => {
      prisma.timePunch.findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          employee,
          {
            timePunchId: '33333333-3333-3333-3333-333333333333',
            requestedOccurredAt: '2026-08-16T11:00:00.000Z',
            reason: 'Outro punch',
          },
          context,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects if a pending request already exists for the punch', async () => {
      prisma.timePunch.findFirst.mockResolvedValue({
        id: '33333333-3333-3333-3333-333333333333',
        employeeId: employee.id,
        occurredAt: new Date('2026-08-16T11:00:00.000Z'),
        adjustments: [],
      });
      prisma.timePunchAdjustmentRequest.findFirst.mockResolvedValue({
        id: 'existing-req',
      });

      await expect(
        service.create(
          employee,
          {
            timePunchId: '33333333-3333-3333-3333-333333333333',
            requestedOccurredAt: '2026-08-16T11:15:00.000Z',
            reason: 'Duplicado',
          },
          context,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('approve', () => {
    it('approves pending request and applies time adjustment', async () => {
      const requestId = 'req-1';
      const punchId = '33333333-3333-3333-3333-333333333333';
      const currentOccurredAt = new Date('2026-08-16T11:00:00.000Z');
      const requestedOccurredAt = new Date('2026-08-16T11:15:00.000Z');

      prisma.timePunchAdjustmentRequest.findUnique.mockResolvedValue({
        id: requestId,
        timePunchId: punchId,
        employeeId: employee.id,
        status: AdjustmentRequestStatus.PENDING,
        currentOccurredAt,
        requestedOccurredAt,
        currentSequence: 0,
        reason: 'Esqueci de bater na entrada',
        reviewedById: null,
        reviewComment: null,
        reviewedAt: null,
        timeAdjustmentId: null,
        createdAt: new Date('2026-08-16T12:00:00.000Z'),
        updatedAt: new Date('2026-08-16T12:00:00.000Z'),
        employee: { id: employee.id, name: employee.name, login: employee.login },
        reviewedBy: null,
        timePunch: { kind: TimePunchKind.CLOCK_IN, occurredAt: currentOccurredAt },
      });

      timeAdjustments.correct.mockResolvedValue({
        body: {
          punch: { id: punchId, effectiveOccurredAt: requestedOccurredAt.toISOString() },
        },
        replayed: false,
      });

      prisma.timeAdjustment.findFirst.mockResolvedValue({
        id: 'adj-1',
        timePunchId: punchId,
      });

      prisma.timePunchAdjustmentRequest.update.mockResolvedValue({
        id: requestId,
        timePunchId: punchId,
        employeeId: employee.id,
        status: AdjustmentRequestStatus.APPROVED,
        currentOccurredAt,
        requestedOccurredAt,
        currentSequence: 0,
        reason: 'Esqueci de bater na entrada',
        reviewedById: admin.id,
        reviewComment: 'Verificado e aprovado',
        reviewedAt: new Date('2026-08-16T14:00:00.000Z'),
        timeAdjustmentId: 'adj-1',
        createdAt: new Date('2026-08-16T12:00:00.000Z'),
        updatedAt: new Date('2026-08-16T14:00:00.000Z'),
        employee: { id: employee.id, name: employee.name, login: employee.login },
        reviewedBy: { id: admin.id, name: admin.name, login: admin.login },
        timePunch: { kind: TimePunchKind.CLOCK_IN, occurredAt: currentOccurredAt },
      });

      const result = await service.approve(
        admin,
        requestId,
        { adminComment: 'Verificado e aprovado' },
        'idemp-key-1',
        context,
      );

      expect(result.request.status).toBe(AdjustmentRequestStatus.APPROVED);
      expect(result.request.reviewedBy?.name).toBe('Gestor');
      expect(timeAdjustments.correct).toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.ADJUSTMENT_REQUEST_APPROVED,
        }),
        expect.anything(),
      );
    });
  });

  describe('reject', () => {
    it('rejects pending request with admin feedback comment', async () => {
      const requestId = 'req-1';
      const punchId = '33333333-3333-3333-3333-333333333333';
      const currentOccurredAt = new Date('2026-08-16T11:00:00.000Z');
      const requestedOccurredAt = new Date('2026-08-16T11:15:00.000Z');

      prisma.timePunchAdjustmentRequest.findUnique.mockResolvedValue({
        id: requestId,
        timePunchId: punchId,
        employeeId: employee.id,
        status: AdjustmentRequestStatus.PENDING,
        currentOccurredAt,
        requestedOccurredAt,
        currentSequence: 0,
        reason: 'Esqueci de bater na entrada',
        reviewedById: null,
        reviewComment: null,
        reviewedAt: null,
        timeAdjustmentId: null,
        createdAt: new Date('2026-08-16T12:00:00.000Z'),
        updatedAt: new Date('2026-08-16T12:00:00.000Z'),
        employee: { id: employee.id, name: employee.name, login: employee.login },
        reviewedBy: null,
        timePunch: { kind: TimePunchKind.CLOCK_IN, occurredAt: currentOccurredAt },
      });

      prisma.timePunchAdjustmentRequest.update.mockResolvedValue({
        id: requestId,
        timePunchId: punchId,
        employeeId: employee.id,
        status: AdjustmentRequestStatus.REJECTED,
        currentOccurredAt,
        requestedOccurredAt,
        currentSequence: 0,
        reason: 'Esqueci de bater na entrada',
        reviewedById: admin.id,
        reviewComment: 'Horário incompatível com o relatório da catraca',
        reviewedAt: new Date('2026-08-16T14:00:00.000Z'),
        timeAdjustmentId: null,
        createdAt: new Date('2026-08-16T12:00:00.000Z'),
        updatedAt: new Date('2026-08-16T14:00:00.000Z'),
        employee: { id: employee.id, name: employee.name, login: employee.login },
        reviewedBy: { id: admin.id, name: admin.name, login: admin.login },
        timePunch: { kind: TimePunchKind.CLOCK_IN, occurredAt: currentOccurredAt },
      });

      const result = await service.reject(
        admin,
        requestId,
        { adminComment: 'Horário incompatível com o relatório da catraca' },
        context,
      );

      expect(result.request.status).toBe(AdjustmentRequestStatus.REJECTED);
      expect(result.request.reviewComment).toBe('Horário incompatível com o relatório da catraca');
      expect(timeAdjustments.correct).not.toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.ADJUSTMENT_REQUEST_REJECTED,
        }),
        expect.anything(),
      );
    });
  });
});
