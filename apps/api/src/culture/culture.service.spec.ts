import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompanyService } from '../company/company.service.js';
import type { PrismaService } from '../database/prisma.service.js';
import { CultureService } from './culture.service.js';

interface CulturePrismaMock {
  cultureProfile: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  cultureProfileVersion: {
    count: ReturnType<typeof vi.fn>;
  };
}

interface CompanyServiceMock {
  getCompany: ReturnType<typeof vi.fn>;
}

describe('CultureService', () => {
  let service: CultureService;
  let prismaMock: CulturePrismaMock;
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
      cultureProfile: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      cultureProfileVersion: {
        count: vi.fn(),
      },
    };

    companyServiceMock = {
      getCompany: vi.fn().mockResolvedValue(mockCompany),
    };

    service = new CultureService(
      prismaMock as unknown as PrismaService,
      companyServiceMock as unknown as CompanyService,
    );
  });

  it('creates profile if not found and returns it with null currentVersion', async () => {
    prismaMock.cultureProfile.findUnique.mockResolvedValue(null);
    prismaMock.cultureProfile.create.mockResolvedValue({
      id: 'profile-1',
      companyId: mockCompanyId,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      versions: [],
    });

    const result = await service.getCultureProfile();

    expect(prismaMock.cultureProfile.create).toHaveBeenCalledWith({
      data: { companyId: mockCompanyId },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
      },
    });
    expect(result.id).toBe('profile-1');
    expect(result.currentVersion).toBeNull();
    expect(result.versions).toHaveLength(0);
  });

  it('returns existing profile with latest currentVersion and sorted versions', async () => {
    const existingVersion = {
      id: 'version-1',
      cultureProfileId: 'profile-1',
      versionNumber: 1,
      mission: 'Nossa missão',
      vision: 'Nossa visão',
      values: [{ title: 'Qualidade', description: 'Sempre fazer o melhor' }],
      motto: 'Excelência em duas rodas',
      generatedDocumentId: 'doc-1',
      createdById: 'user-1',
      publishedAt: new Date('2026-01-02T10:00:00Z'),
      createdAt: new Date('2026-01-02T10:00:00Z'),
    };

    prismaMock.cultureProfile.findUnique.mockResolvedValue({
      id: 'profile-1',
      companyId: mockCompanyId,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-02T10:00:00Z'),
      versions: [existingVersion],
    });

    const result = await service.getCultureProfile();

    expect(prismaMock.cultureProfile.create).not.toHaveBeenCalled();
    expect(result.currentVersion).not.toBeNull();
    expect(result.currentVersion?.versionNumber).toBe(1);
    expect(result.currentVersion?.mission).toBe('Nossa missão');
    expect(result.currentVersion?.motto).toBe('Excelência em duas rodas');
    expect(result.versions).toHaveLength(1);
  });

  it('checks if culture is published correctly', async () => {
    prismaMock.cultureProfileVersion.count.mockResolvedValue(0);
    expect(await service.isCulturePublished()).toBe(false);

    prismaMock.cultureProfileVersion.count.mockResolvedValue(1);
    expect(await service.isCulturePublished()).toBe(true);
  });
});
