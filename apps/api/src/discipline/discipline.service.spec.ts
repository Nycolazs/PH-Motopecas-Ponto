import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditService } from '../audit/audit.service.js';
import type { PrismaService } from '../database/prisma.service.js';
import {
  AuditAction,
  AuditOutcome,
  AuditTargetType,
  DisciplinaryActionType,
  DocumentType,
} from '../generated/prisma/client.js';
import { DisciplineService } from './discipline.service.js';

interface DisciplinePrismaMock {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  disciplinaryAction: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  generatedDocument: {
    update: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
}

interface DisciplineAuditMock {
  record: ReturnType<typeof vi.fn>;
}

describe('DisciplineService', () => {
  let service: DisciplineService;
  let prisma: DisciplinePrismaMock;
  let audit: DisciplineAuditMock;

  const mockEmployeeId = '11111111-1111-4111-8111-111111111111';
  const mockActorId = '99999999-9999-4999-8999-999999999999';
  const mockCompanyId = '00000000-0000-4000-8000-000000000000';

  const mockContext = {
    ip: '127.0.0.1',
    userAgent: 'test-agent',
    requestId: 'req-123',
  };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: vi.fn(),
      },
      disciplinaryAction: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      generatedDocument: {
        update: vi.fn(),
      },
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(prisma)),
    };

    audit = {
      record: vi.fn().mockResolvedValue(undefined),
    };

    service = new DisciplineService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
    );
  });

  describe('getProgressionSummary', () => {
    it('throws NotFoundException if employee does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProgressionSummary(mockEmployeeId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns progression summary with active and voided counts correctly calculated', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockEmployeeId,
        name: 'Roberto Silva',
      });

      prisma.disciplinaryAction.findMany.mockResolvedValue([
        {
          id: 'action-1',
          actionType: DisciplinaryActionType.VERBAL_WARNING,
          isVoid: false,
          incidentDate: new Date('2026-08-01T12:00:00Z'),
          suspensionDays: null,
        },
        {
          id: 'action-2',
          actionType: DisciplinaryActionType.WRITTEN_WARNING,
          isVoid: false,
          incidentDate: new Date('2026-08-15T12:00:00Z'),
          suspensionDays: null,
        },
        {
          id: 'action-3',
          actionType: DisciplinaryActionType.SUSPENSION,
          isVoid: false,
          incidentDate: new Date('2026-09-01T12:00:00Z'),
          suspensionDays: 2,
        },
        {
          id: 'action-4',
          actionType: DisciplinaryActionType.SUSPENSION,
          isVoid: true, // voided!
          incidentDate: new Date('2026-09-10T12:00:00Z'),
          suspensionDays: 5,
        },
      ]);

      const summary = await service.getProgressionSummary(mockEmployeeId);

      expect(summary.employeeId).toBe(mockEmployeeId);
      expect(summary.employeeName).toBe('Roberto Silva');
      expect(summary.verbalCount).toBe(1);
      expect(summary.writtenCount).toBe(1);
      expect(summary.suspensionCount).toBe(1); // the voided one is excluded
      expect(summary.totalSuspensionDays).toBe(2); // only the active 2 days
      expect(summary.voidedCount).toBe(1);
      expect(summary.currentStage).toBe('SUSPENSION');
      expect(summary.nextSuggestedStage).toBe('DISMISSAL_REVIEW');
      expect(summary.lastActionDate).toBe('2026-09-01');
      expect(summary.lastActionType).toBe('SUSPENSION');
    });

    it('returns stage NONE if employee has only voided actions', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockEmployeeId,
        name: 'Roberto Silva',
      });

      prisma.disciplinaryAction.findMany.mockResolvedValue([
        {
          id: 'action-1',
          actionType: DisciplinaryActionType.VERBAL_WARNING,
          isVoid: true,
          incidentDate: new Date('2026-08-01T12:00:00Z'),
          suspensionDays: null,
        },
      ]);

      const summary = await service.getProgressionSummary(mockEmployeeId);

      expect(summary.currentStage).toBe('NONE');
      expect(summary.voidedCount).toBe(1);
      expect(summary.verbalCount).toBe(0);
      expect(summary.nextSuggestedStage).toBe('VERBAL_WARNING');
    });
  });

  describe('listActions', () => {
    it('returns serialized list of actions', async () => {
      prisma.disciplinaryAction.findMany.mockResolvedValue([
        {
          id: 'action-1',
          companyId: mockCompanyId,
          employeeId: mockEmployeeId,
          employee: { name: 'Roberto Silva' },
          issuerId: mockActorId,
          issuer: { name: 'Admin RH' },
          actionType: DisciplinaryActionType.VERBAL_WARNING,
          documentType: DocumentType.DISCIPLINE_VERBAL,
          incidentDate: new Date('2026-08-01T12:00:00Z'),
          reason: 'Atraso',
          details: 'Detalhes do atraso observado.',
          internalClauseRef: 'Art. 4',
          suspensionDays: null,
          suspensionStartDate: null,
          suspensionEndDate: null,
          priorActionId: null,
          priorAction: null,
          generatedDocumentId: 'doc-1',
          isVoid: false,
          voidReason: null,
          voidedById: null,
          voidedAt: null,
          createdAt: new Date('2026-08-01T12:00:00Z'),
          updatedAt: new Date('2026-08-01T12:00:00Z'),
        },
      ]);

      const actions = await service.listActions({ employeeId: mockEmployeeId });

      expect(actions).toHaveLength(1);
      expect(actions[0].id).toBe('action-1');
      expect(actions[0].employeeName).toBe('Roberto Silva');
      expect(actions[0].issuerName).toBe('Admin RH');
      expect(actions[0].incidentDate).toBe('2026-08-01');
    });
  });

  describe('voidAction', () => {
    it('throws NotFoundException when action does not exist', async () => {
      prisma.disciplinaryAction.findUnique.mockResolvedValue(null);

      await expect(
        service.voidAction('invalid-id', mockActorId, { reason: 'Motivo válido' }, mockContext),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when action is already void', async () => {
      prisma.disciplinaryAction.findUnique.mockResolvedValue({
        id: 'action-1',
        isVoid: true,
      });

      await expect(
        service.voidAction('action-1', mockActorId, { reason: 'Motivo de anulação' }, mockContext),
      ).rejects.toThrow(BadRequestException);
    });

    it('successfully voids action, voids linked generated document, and records audit', async () => {
      const existing = {
        id: 'action-1',
        companyId: mockCompanyId,
        employeeId: mockEmployeeId,
        issuerId: mockActorId,
        actionType: DisciplinaryActionType.WRITTEN_WARNING,
        documentType: DocumentType.DISCIPLINE_WRITTEN,
        incidentDate: new Date('2026-08-15T12:00:00Z'),
        reason: 'Desídia',
        details: 'Descrição dos fatos',
        generatedDocumentId: 'doc-123',
        isVoid: false,
      };

      prisma.disciplinaryAction.findUnique.mockResolvedValue(existing);

      const now = new Date();
      prisma.disciplinaryAction.update.mockResolvedValue({
        ...existing,
        isVoid: true,
        voidReason: 'Acordo firmado em reconsideração',
        voidedById: mockActorId,
        voidedAt: now,
        employee: { name: 'Roberto Silva' },
        issuer: { name: 'Admin RH' },
        priorAction: null,
        createdAt: now,
        updatedAt: now,
      });

      const result = await service.voidAction(
        'action-1',
        mockActorId,
        { reason: 'Acordo firmado em reconsideração' },
        mockContext,
      );

      expect(result.isVoid).toBe(true);
      expect(result.voidReason).toBe('Acordo firmado em reconsideração');

      // Verify generated document was also marked void
      expect(prisma.generatedDocument.update).toHaveBeenCalledWith({
        where: { id: 'doc-123' },
        data: expect.objectContaining({
          isVoid: true,
          voidReason: 'Acordo firmado em reconsideração',
          voidedById: mockActorId,
        }),
      });

      // Verify audit was recorded
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: mockActorId,
          action: AuditAction.DISCIPLINARY_ACTION_VOIDED,
          outcome: AuditOutcome.SUCCESS,
          targetType: AuditTargetType.DISCIPLINARY_ACTION,
          targetId: 'action-1',
        }),
        expect.anything(),
      );
    });
  });
});
