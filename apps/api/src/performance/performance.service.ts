import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  CANONICAL_PERFORMANCE_CRITERIA,
  type PerformanceCriterionScoreDto,
} from '@ph-ponto/shared';
import { AuditService } from '../audit/audit.service.js';
import type { ClientContext } from '../auth/auth.types.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  AuditAction,
  AuditOutcome,
  AuditTargetType,
  type PerformanceReview,
  type Prisma,
  type User,
} from '../generated/prisma/client.js';
import {
  type ListPerformanceReviewsQueryDto,
  type PerformanceCriteriaResponseDto,
  type PerformanceReviewResponseDto,
  type SupersedePerformanceReviewDto,
} from './performance.dto.js';

type ReviewWithRelations = PerformanceReview & {
  employee?: User | null;
  evaluator?: User | null;
};

@Injectable()
export class PerformanceService {
  public constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  public async getCriteria(actorId?: string): Promise<PerformanceCriteriaResponseDto> {
    const company = await this.prisma.company.findFirst();
    if (!company) {
      throw new NotFoundException({
        code: 'COMPANY_NOT_FOUND',
        message: 'Empresa não cadastrada no sistema.',
      });
    }

    const existing = await this.prisma.performanceEvaluationCriteria.findFirst({
      where: { companyId: company.id, isActive: true },
      orderBy: { versionNumber: 'desc' },
    });

    if (existing) {
      return {
        id: existing.id,
        companyId: existing.companyId,
        versionNumber: existing.versionNumber,
        isActive: existing.isActive,
        criteria: existing.criteria as unknown as PerformanceCriteriaResponseDto['criteria'],
        createdAt: existing.createdAt.toISOString(),
      };
    }

    // Baseline creation of version 1 with canonical 8 criteria
    const fallbackActorId =
      actorId ?? (await this.prisma.user.findFirst({ where: { role: 'ADMIN' } }))?.id;

    if (!fallbackActorId) {
      throw new NotFoundException({
        code: 'ADMIN_NOT_FOUND',
        message: 'Nenhum administrador encontrado para inicializar os critérios.',
      });
    }

    const created = await this.prisma.performanceEvaluationCriteria.create({
      data: {
        companyId: company.id,
        versionNumber: 1,
        isActive: true,
        criteria: CANONICAL_PERFORMANCE_CRITERIA as unknown as Prisma.InputJsonValue,
        createdById: fallbackActorId,
      },
    });

    return {
      id: created.id,
      companyId: created.companyId,
      versionNumber: created.versionNumber,
      isActive: created.isActive,
      criteria:
        CANONICAL_PERFORMANCE_CRITERIA as unknown as PerformanceCriteriaResponseDto['criteria'],
      createdAt: created.createdAt.toISOString(),
    };
  }

  public async listReviews(
    query: ListPerformanceReviewsQueryDto,
  ): Promise<PerformanceReviewResponseDto[]> {
    const where: Prisma.PerformanceReviewWhereInput = {};

    if (query.employeeId) {
      where.employeeId = query.employeeId;
    }

    if (query.period) {
      where.evaluationPeriod = query.period;
    }

    if (query.includeSuperseded === false) {
      where.isSuperseded = false;
    }

    const reviews = await this.prisma.performanceReview.findMany({
      where,
      include: {
        employee: true,
        evaluator: true,
      },
      orderBy: { evaluationDate: 'desc' },
    });

    return reviews.map((r) => this.mapReviewToDto(r));
  }

  public async getReviewById(id: string): Promise<PerformanceReviewResponseDto> {
    const review = await this.prisma.performanceReview.findUnique({
      where: { id },
      include: {
        employee: true,
        evaluator: true,
      },
    });

    if (!review) {
      throw new NotFoundException({
        code: 'PERFORMANCE_REVIEW_NOT_FOUND',
        message: 'Avaliação de desempenho não encontrada.',
      });
    }

    return this.mapReviewToDto(review);
  }

  public async getLatestReviewForEmployee(
    employeeId: string,
  ): Promise<PerformanceReviewResponseDto | null> {
    const review = await this.prisma.performanceReview.findFirst({
      where: {
        employeeId,
        isSuperseded: false,
      },
      include: {
        employee: true,
        evaluator: true,
      },
      orderBy: { evaluationDate: 'desc' },
    });

    if (!review) return null;
    return this.mapReviewToDto(review);
  }

  public async supersedeReview(
    id: string,
    actorId: string,
    input: SupersedePerformanceReviewDto,
    context: ClientContext,
  ): Promise<PerformanceReviewResponseDto> {
    const review = await this.prisma.performanceReview.findUnique({
      where: { id },
      include: {
        employee: true,
        evaluator: true,
      },
    });

    if (!review) {
      throw new NotFoundException({
        code: 'PERFORMANCE_REVIEW_NOT_FOUND',
        message: 'Avaliação de desempenho não encontrada.',
      });
    }

    if (review.isSuperseded) {
      throw new BadRequestException({
        code: 'REVIEW_ALREADY_SUPERSEDED',
        message: 'Esta avaliação de desempenho já foi substituída anteriormente.',
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const superseded = await tx.performanceReview.update({
        where: { id },
        data: {
          isSuperseded: true,
          supersededAt: new Date(),
          supersessionReason: input.reason.trim(),
        },
        include: {
          employee: true,
          evaluator: true,
        },
      });

      await this.audit.record(
        {
          actorId,
          action: AuditAction.PERFORMANCE_REVIEW_SUPERSEDED,
          outcome: AuditOutcome.SUCCESS,
          targetType: AuditTargetType.PERFORMANCE_REVIEW,
          targetId: id,
          ...context,
          beforeState: {
            isSuperseded: false,
            evaluationPeriod: review.evaluationPeriod,
            meanScore: Number(review.meanScore),
          },
          afterState: {
            isSuperseded: true,
            supersessionReason: input.reason.trim(),
          },
        },
        tx,
      );

      return superseded;
    });

    return this.mapReviewToDto(updated);
  }

  private mapReviewToDto(review: ReviewWithRelations): PerformanceReviewResponseDto {
    return {
      id: review.id,
      companyId: review.companyId,
      employeeId: review.employeeId,
      employeeName: review.employee?.name ?? null,
      evaluatorId: review.evaluatorId,
      evaluatorName: review.evaluator?.name ?? null,
      evaluationPeriod: review.evaluationPeriod,
      evaluationDate: review.evaluationDate.toISOString().slice(0, 10),
      meanScore: Number(review.meanScore),
      classification: review.classification,
      scores: review.scores as unknown as PerformanceCriterionScoreDto[],
      strengths: review.strengths ?? null,
      improvements: review.improvements ?? null,
      actionPlan: review.actionPlan ?? null,
      evaluatorComments: review.evaluatorComments ?? null,
      employeeComments: review.employeeComments ?? null,
      generatedDocumentId: review.generatedDocumentId ?? null,
      isSuperseded: review.isSuperseded,
      supersededById: review.supersededById ?? null,
      supersededAt: review.supersededAt?.toISOString() ?? null,
      supersessionReason: review.supersessionReason ?? null,
      createdAt: review.createdAt.toISOString(),
      updatedAt: review.updatedAt.toISOString(),
    };
  }
}
