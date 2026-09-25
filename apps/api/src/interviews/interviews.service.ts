import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { HiringInterview, Prisma } from '../generated/prisma/client.js';
import type {
  HiringInterviewResponseDto,
  ListInterviewsQueryDto,
  PaginatedInterviewsResponseDto,
} from './interviews.dto.js';

@Injectable()
export class InterviewsService {
  public constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  public async listInterviews(
    query: ListInterviewsQueryDto,
  ): Promise<PaginatedInterviewsResponseDto> {
    const where: Prisma.HiringInterviewWhereInput = {};

    if (query.search) {
      where.candidateName = { contains: query.search.trim(), mode: 'insensitive' };
    }

    if (query.recommendation) {
      where.recommendation = query.recommendation;
    }

    if (query.jobRoleId) {
      where.jobRoleId = query.jobRoleId;
    }

    const [total, items] = await Promise.all([
      this.prisma.hiringInterview.count({ where }),
      this.prisma.hiringInterview.findMany({
        where,
        orderBy: { interviewDate: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
    ]);

    return {
      items: items.map((item) => this.serializeInterview(item)),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  public async getInterview(id: string): Promise<HiringInterviewResponseDto> {
    const interview = await this.prisma.hiringInterview.findUnique({
      where: { id },
    });

    if (!interview) {
      throw new NotFoundException({
        code: 'INTERVIEW_NOT_FOUND',
        message: 'Entrevista de contratação não encontrada.',
      });
    }

    return this.serializeInterview(interview);
  }

  private serializeInterview(interview: HiringInterview): HiringInterviewResponseDto {
    const interviewDateStr =
      interview.interviewDate instanceof Date
        ? interview.interviewDate.toISOString().slice(0, 10)
        : String(interview.interviewDate);

    return {
      id: interview.id,
      candidateName: interview.candidateName,
      candidateEmail: interview.candidateEmail,
      candidatePhone: interview.candidatePhone,
      jobRoleId: interview.jobRoleId,
      roleTitle: interview.roleTitle,
      interviewDate: interviewDateStr,
      interviewerName: interview.interviewerName,
      evaluatorId: interview.evaluatorId,
      recommendation: interview.recommendation,
      notes: interview.notes,
      scores: interview.scores as Record<string, unknown> | unknown[],
      generatedDocumentId: interview.generatedDocumentId,
      createdAt: interview.createdAt.toISOString(),
      updatedAt: interview.updatedAt.toISOString(),
    };
  }
}
