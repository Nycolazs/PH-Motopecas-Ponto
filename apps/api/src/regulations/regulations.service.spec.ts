import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompanyService } from '../company/company.service.js';
import type { PrismaService } from '../database/prisma.service.js';
import { RegulationsService } from './regulations.service.js';

interface RegulationsPrismaMock {
  companyRegulation: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  companyRegulationVersion: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
}

interface CompanyServiceMock {
  getCompany: ReturnType<typeof vi.fn>;
}

describe('RegulationsService', () => {
  let service: RegulationsService;
  let prismaMock: RegulationsPrismaMock;
  let companyServiceMock: CompanyServiceMock;

  const mockCompanyId = '10000000-0000-0000-0000-000000000001';
  const mockCompany = {
    id: mockCompanyId,
    legalName: 'PH MOTOPECAS LTDA',
    tradeName: 'PH Motopeças',
    cnpj: '00.000.000/0001-00',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    prismaMock = {
      companyRegulation: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      companyRegulationVersion: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
      },
    };

    companyServiceMock = {
      getCompany: vi.fn().mockResolvedValue(mockCompany),
    };

    service = new RegulationsService(
      prismaMock as unknown as PrismaService,
      companyServiceMock as unknown as CompanyService,
    );
  });

  it('creates regulation if not found and returns it with null currentVersion', async () => {
    prismaMock.companyRegulation.findUnique.mockResolvedValue(null);
    prismaMock.companyRegulation.create.mockResolvedValue({
      id: 'reg-1',
      companyId: mockCompanyId,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      versions: [],
    });

    const result = await service.getRegulations();

    expect(prismaMock.companyRegulation.create).toHaveBeenCalledWith({
      data: { companyId: mockCompanyId },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
      },
    });
    expect(result.id).toBe('reg-1');
    expect(result.currentVersion).toBeNull();
    expect(result.versions).toHaveLength(0);
  });

  it('returns existing regulation with latest currentVersion and sorted versions', async () => {
    const existingVersion = {
      id: 'ver-1',
      companyRegulationId: 'reg-1',
      versionNumber: 1,
      title: 'Regimento Interno de Trabalho',
      effectiveDate: new Date('2026-09-25T12:00:00Z'),
      content: { title: 'Regimento Interno de Trabalho' },
      generatedDocumentId: 'doc-1',
      createdById: 'user-1',
      publishedAt: new Date('2026-09-25T12:00:00Z'),
      createdAt: new Date('2026-09-25T12:00:00Z'),
    };

    prismaMock.companyRegulation.findUnique.mockResolvedValue({
      id: 'reg-1',
      companyId: mockCompanyId,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-09-25T12:00:00Z'),
      versions: [existingVersion],
    });

    const result = await service.getRegulations();

    expect(result.id).toBe('reg-1');
    expect(result.currentVersion).toBeDefined();
    expect(result.currentVersion?.versionNumber).toBe(1);
    expect(result.currentVersion?.effectiveDate).toBe('2026-09-25');
  });

  it('returns false for isRegulationPublished when count is 0, true when count > 0', async () => {
    prismaMock.companyRegulationVersion.count.mockResolvedValueOnce(0);
    expect(await service.isRegulationPublished()).toBe(false);

    prismaMock.companyRegulationVersion.count.mockResolvedValueOnce(2);
    expect(await service.isRegulationPublished()).toBe(true);
  });

  it('throws NotFoundException when getVersion is called for non-existent id', async () => {
    prismaMock.companyRegulationVersion.findUnique.mockResolvedValue(null);

    await expect(service.getVersion('non-existent')).rejects.toThrow();
  });
});
