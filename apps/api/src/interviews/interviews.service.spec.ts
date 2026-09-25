import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../database/prisma.service.js';
import { InterviewRecommendation } from '../generated/prisma/client.js';
import { InterviewsService } from './interviews.service.js';

interface InterviewsPrismaMock {
  hiringInterview: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
}

describe('InterviewsService', () => {
  let service: InterviewsService;
  let prismaMock: InterviewsPrismaMock;

  const mockInterview = {
    id: 'int-1',
    candidateName: 'Maria Silva',
    candidateEmail: 'maria@test.com',
    candidatePhone: '(11) 98765-4321',
    jobRoleId: 'role-1',
    roleTitle: 'Vendedora de Peças',
    interviewDate: new Date('2026-09-25T12:00:00Z'),
    interviewerName: 'Carlos Admin',
    evaluatorId: 'admin-1',
    recommendation: InterviewRecommendation.RECOMMENDED,
    notes: 'Ótima candidata',
    scores: [{ criterion: 'Comunicação', score: 5 }],
    generatedDocumentId: 'doc-1',
    createdAt: new Date('2026-09-25T12:00:00Z'),
    updatedAt: new Date('2026-09-25T12:00:00Z'),
  };

  beforeEach(() => {
    prismaMock = {
      hiringInterview: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
      },
    };

    service = new InterviewsService(prismaMock as unknown as PrismaService);
  });

  it('lists interviews with pagination and search filter', async () => {
    prismaMock.hiringInterview.count.mockResolvedValue(1);
    prismaMock.hiringInterview.findMany.mockResolvedValue([mockInterview]);

    const result = await service.listInterviews({
      search: 'Maria',
      limit: 10,
      offset: 0,
    });

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].candidateName).toBe('Maria Silva');
    expect(result.items[0].recommendation).toBe(InterviewRecommendation.RECOMMENDED);
    expect(result.items[0].interviewDate).toBe('2026-09-25');
  });

  it('gets interview by id', async () => {
    prismaMock.hiringInterview.findUnique.mockResolvedValue(mockInterview);

    const result = await service.getInterview('int-1');

    expect(result.id).toBe('int-1');
    expect(result.candidateName).toBe('Maria Silva');
  });

  it('throws NotFoundException when interview is not found', async () => {
    prismaMock.hiringInterview.findUnique.mockResolvedValue(null);

    await expect(service.getInterview('not-found')).rejects.toThrow();
  });
});
