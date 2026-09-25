import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CANONICAL_PERFORMANCE_CRITERIA } from '@ph-ponto/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditService } from '../audit/audit.service.js';
import type { PrismaService } from '../database/prisma.service.js';
import {
  AuditAction,
  AuditOutcome,
  AuditTargetType,
  PerformanceClassification,
} from '../generated/prisma/client.js';
import { PerformanceService } from './performance.service.js';

interface PerformancePrismaMock {
  company: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  user: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  performanceEvaluationCriteria: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  performanceReview: {
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
}

interface PerformanceAuditMock {
  record: ReturnType<typeof vi.fn>;
}

describe('PerformanceService', () => {
  let service: PerformanceService;
  let prisma: PerformancePrismaMock;
  let audit: PerformanceAuditMock;

  const mockEmployeeId = '11111111-1111-4111-8111-111111111111';
  const mockEvaluatorId = '22222222-2222-4222-8222-222222222222';
  const mockActorId = '99999999-9999-4999-8999-999999999999';
  const mockCompanyId = '00000000-0000-4000-8000-000000000000';
  const mockReviewId = '33333333-3333-4333-8333-333333333333';

  const mockContext = {
    ip: '127.0.0.1',
    userAgent: 'test-agent',
    requestId: 'req-123',
  };

  const mockCriteriaScores = CANONICAL_PERFORMANCE_CRITERIA.map((c) => ({
    criterionKey: c.key,
    criterionTitle: c.title,
    score: 4,
    feedback: 'Bom desempenho.',
  }));

  const mockReview = {
    id: mockReviewId,
    companyId: mockCompanyId,
    employeeId: mockEmployeeId,
    evaluatorId: mockEvaluatorId,
    evaluationPeriod: '2026-Q1',
    evaluationDate: new Date('2026-03-31T00:00:00.000Z'),
    meanScore: 4.0,
    classification: PerformanceClassification.GOOD,
    scores: mockCriteriaScores,
    strengths: 'Pontualidade e trabalho em equipe',
    improvements: 'Agilidade',
    actionPlan: 'Treinamento de processos',
    evaluatorComments: 'Ótimo trimestre',
    employeeComments: 'De acordo',
    generatedDocumentId: 'doc-123',
    isSuperseded: false,
    supersededById: null,
    supersededAt: null,
    supersessionReason: null,
    createdAt: new Date('2026-04-01T10:00:00.000Z'),
    updatedAt: new Date('2026-04-01T10:00:00.000Z'),
    employee: { id: mockEmployeeId, name: 'João Silva' },
    evaluator: { id: mockEvaluatorId, name: 'Maria Gestora' },
  };

  beforeEach(() => {
    prisma = {
      company: {
        findFirst: vi.fn(),
      },
      user: {
        findFirst: vi.fn(),
      },
      performanceEvaluationCriteria: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      performanceReview: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(prisma)),
    };

    audit = {
      record: vi.fn().mockResolvedValue(undefined),
    };

    service = new PerformanceService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
    );
  });

  describe('getCriteria', () => {
    it('throws NotFoundException if company does not exist', async () => {
      prisma.company.findFirst.mockResolvedValue(null);

      await expect(service.getCriteria(mockActorId)).rejects.toThrow(NotFoundException);
    });

    it('returns existing criteria when available', async () => {
      prisma.company.findFirst.mockResolvedValue({ id: mockCompanyId });
      prisma.performanceEvaluationCriteria.findFirst.mockResolvedValue({
        id: 'crit-1',
        companyId: mockCompanyId,
        versionNumber: 1,
        isActive: true,
        criteria: CANONICAL_PERFORMANCE_CRITERIA,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      });

      const result = await service.getCriteria(mockActorId);

      expect(result.versionNumber).toBe(1);
      expect(result.criteria).toHaveLength(8);
      expect(result.isActive).toBe(true);
    });

    it('creates canonical criteria v1 if none exist yet', async () => {
      prisma.company.findFirst.mockResolvedValue({ id: mockCompanyId });
      prisma.performanceEvaluationCriteria.findFirst.mockResolvedValue(null);
      prisma.performanceEvaluationCriteria.create.mockResolvedValue({
        id: 'crit-new',
        companyId: mockCompanyId,
        versionNumber: 1,
        isActive: true,
        criteria: CANONICAL_PERFORMANCE_CRITERIA,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      });

      const result = await service.getCriteria(mockActorId);

      expect(prisma.performanceEvaluationCriteria.create).toHaveBeenCalledWith({
        data: {
          companyId: mockCompanyId,
          versionNumber: 1,
          isActive: true,
          criteria: CANONICAL_PERFORMANCE_CRITERIA,
          createdById: mockActorId,
        },
      });
      expect(result.versionNumber).toBe(1);
      expect(result.criteria).toHaveLength(8);
    });
  });

  describe('listReviews', () => {
    it('returns formatted reviews list', async () => {
      prisma.performanceReview.findMany.mockResolvedValue([mockReview]);

      const result = await service.listReviews({ employeeId: mockEmployeeId });

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe(mockReviewId);
      expect(result[0]!.employeeName).toBe('João Silva');
      expect(result[0]!.evaluatorName).toBe('Maria Gestora');
      expect(result[0]!.meanScore).toBe(4.0);
      expect(result[0]!.classification).toBe(PerformanceClassification.GOOD);
    });
  });

  describe('getReviewById', () => {
    it('throws NotFoundException if review does not exist', async () => {
      prisma.performanceReview.findUnique.mockResolvedValue(null);

      await expect(service.getReviewById(mockReviewId)).rejects.toThrow(NotFoundException);
    });

    it('returns the review DTO if found', async () => {
      prisma.performanceReview.findUnique.mockResolvedValue(mockReview);

      const result = await service.getReviewById(mockReviewId);

      expect(result.id).toBe(mockReviewId);
      expect(result.meanScore).toBe(4.0);
      expect(result.evaluationPeriod).toBe('2026-Q1');
    });
  });

  describe('getLatestReviewForEmployee', () => {
    it('returns null if no review found', async () => {
      prisma.performanceReview.findFirst.mockResolvedValue(null);

      const result = await service.getLatestReviewForEmployee(mockEmployeeId);

      expect(result).toBeNull();
    });

    it('returns latest active review if found', async () => {
      prisma.performanceReview.findFirst.mockResolvedValue(mockReview);

      const result = await service.getLatestReviewForEmployee(mockEmployeeId);

      expect(result?.id).toBe(mockReviewId);
      expect(result?.isSuperseded).toBe(false);
    });
  });

  describe('supersedeReview', () => {
    it('throws NotFoundException if review does not exist', async () => {
      prisma.performanceReview.findUnique.mockResolvedValue(null);

      await expect(
        service.supersedeReview(
          mockReviewId,
          mockActorId,
          { reason: 'Retificação de notas' },
          mockContext,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if review is already superseded', async () => {
      prisma.performanceReview.findUnique.mockResolvedValue({
        ...mockReview,
        isSuperseded: true,
      });

      await expect(
        service.supersedeReview(
          mockReviewId,
          mockActorId,
          { reason: 'Retificação de notas' },
          mockContext,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('marks review as superseded and records audit log', async () => {
      prisma.performanceReview.findUnique.mockResolvedValue(mockReview);
      prisma.performanceReview.update.mockResolvedValue({
        ...mockReview,
        isSuperseded: true,
        supersededAt: new Date('2026-04-02T10:00:00.000Z'),
        supersessionReason: 'Retificação de notas',
      });

      const result = await service.supersedeReview(
        mockReviewId,
        mockActorId,
        { reason: 'Retificação de notas' },
        mockContext,
      );

      expect(result.isSuperseded).toBe(true);
      expect(result.supersessionReason).toBe('Retificação de notas');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: mockActorId,
          action: AuditAction.PERFORMANCE_REVIEW_SUPERSEDED,
          outcome: AuditOutcome.SUCCESS,
          targetType: AuditTargetType.PERFORMANCE_REVIEW,
          targetId: mockReviewId,
        }),
        expect.anything(),
      );
    });
  });
});
