import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditService } from '../audit/audit.service.js';
import type { PrismaService } from '../database/prisma.service.js';
import { CompanyService } from './company.service.js';

interface CompanyPrismaMock {
  company: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  jobRole: {
    count: ReturnType<typeof vi.fn>;
  };
  jobRoleVersion: {
    count: ReturnType<typeof vi.fn>;
  };
  user: {
    count: ReturnType<typeof vi.fn>;
  };
  employeeRoleAssignment: {
    groupBy: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
}

interface AuditMock {
  record: ReturnType<typeof vi.fn>;
}

describe('CompanyService', () => {
  let service: CompanyService;
  let prismaMock: CompanyPrismaMock;
  let auditMock: AuditMock;

  beforeEach(() => {
    prismaMock = {
      company: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      jobRole: {
        count: vi.fn().mockResolvedValue(1),
      },
      jobRoleVersion: {
        count: vi.fn().mockResolvedValue(1),
      },
      user: {
        count: vi.fn().mockResolvedValue(1),
      },
      employeeRoleAssignment: {
        groupBy: vi.fn().mockResolvedValue([{ employeeId: 'emp-1' }]),
      },
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(prismaMock)),
    };

    auditMock = {
      record: vi.fn().mockResolvedValue('audit-123'),
    };

    service = new CompanyService(
      prismaMock as unknown as PrismaService,
      auditMock as unknown as AuditService,
    );
  });

  it('creates default company if none exists', async () => {
    prismaMock.company.findFirst.mockResolvedValue(null);
    prismaMock.company.create.mockResolvedValue({
      id: '10000000-0000-0000-0000-000000000001',
      legalName: 'PH MOTOPECAS LTDA',
      tradeName: 'PH Motopeças',
      cnpj: '00.000.000/0001-00',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.getCompany();

    expect(result.tradeName).toBe('PH Motopeças');
    expect(prismaMock.company.create).toHaveBeenCalled();
  });

  it('updates company and records audit log', async () => {
    const existing = {
      id: '10000000-0000-0000-0000-000000000001',
      legalName: 'PH MOTOPECAS LTDA',
      tradeName: 'PH Motopeças',
      cnpj: '00.000.000/0001-00',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prismaMock.company.findFirst.mockResolvedValue(existing);
    prismaMock.company.update.mockResolvedValue({
      ...existing,
      legalName: 'PH MOTOPECAS MATRIZ LTDA',
      cnpj: '12.345.678/0001-90',
    });

    const result = await service.updateCompany(
      'admin-id',
      {
        legalName: 'PH MOTOPECAS MATRIZ LTDA',
        tradeName: 'PH Motopeças',
        cnpj: '12.345.678/0001-90',
      },
      { requestId: 'req-1', ipHash: 'hash-1' },
    );

    expect(result.legalName).toBe('PH MOTOPECAS MATRIZ LTDA');
    expect(auditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'COMPANY_UPDATED',
        targetId: existing.id,
      }),
      expect.anything(),
    );
  });

  it('calculates onboarding setup status accurately', async () => {
    prismaMock.company.findFirst.mockResolvedValue({
      id: '10000000-0000-0000-0000-000000000001',
      legalName: 'PH MOTOPECAS LTDA',
      tradeName: 'PH Motopeças',
      cnpj: '12.345.678/0001-90',
      addressCity: 'Fortaleza',
      addressState: 'CE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const status = await service.getSetupStatus();

    expect(status.items.find((i) => i.id === 'company')?.isCompleted).toBe(true);
    expect(status.items.find((i) => i.id === 'roles')?.isCompleted).toBe(true);
    expect(status.items.find((i) => i.id === 'employee')?.isCompleted).toBe(true);
    expect(status.items.find((i) => i.id === 'assignment')?.isCompleted).toBe(true);
    expect(status.completionPercentage).toBeGreaterThan(0);
  });
});
