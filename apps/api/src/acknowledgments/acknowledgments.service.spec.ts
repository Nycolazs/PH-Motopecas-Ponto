import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../database/prisma.service.js';
import { AcknowledgmentType } from '../generated/prisma/client.js';
import { AcknowledgmentsService } from './acknowledgments.service.js';

interface AcknowledgmentsPrismaMock {
  employeeDocumentAcknowledgment: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    groupBy: ReturnType<typeof vi.fn>;
  };
  user: {
    findMany: ReturnType<typeof vi.fn>;
  };
  companyRegulationVersion: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  employeeRoleAssignment: {
    findMany: ReturnType<typeof vi.fn>;
  };
}

describe('AcknowledgmentsService', () => {
  let service: AcknowledgmentsService;
  let prismaMock: AcknowledgmentsPrismaMock;

  const mockAck = {
    id: 'ack-1',
    employeeId: 'emp-1',
    acknowledgmentType: AcknowledgmentType.REGULATION,
    regulationVersionId: 'reg-ver-1',
    jobRoleVersionId: null,
    generatedDocumentId: 'doc-1',
    acknowledgedAt: new Date('2026-09-25T12:00:00Z'),
    createdById: 'admin-1',
    createdAt: new Date('2026-09-25T12:00:00Z'),
    employee: { name: 'João da Silva' },
  };

  beforeEach(() => {
    prismaMock = {
      employeeDocumentAcknowledgment: {
        findMany: vi.fn(),
        count: vi.fn(),
        groupBy: vi.fn(),
      },
      user: {
        findMany: vi.fn(),
      },
      companyRegulationVersion: {
        findFirst: vi.fn(),
      },
      employeeRoleAssignment: {
        findMany: vi.fn(),
      },
    };

    service = new AcknowledgmentsService(prismaMock as unknown as PrismaService);
  });

  it('lists acknowledgments with pagination', async () => {
    prismaMock.employeeDocumentAcknowledgment.count.mockResolvedValue(1);
    prismaMock.employeeDocumentAcknowledgment.findMany.mockResolvedValue([mockAck]);

    const result = await service.listAcknowledgments({
      limit: 10,
      offset: 0,
    });

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].employeeName).toBe('João da Silva');
    expect(result.items[0].acknowledgmentType).toBe(AcknowledgmentType.REGULATION);
  });

  it('returns compliant status summary when all employees acknowledged both regulation and role', async () => {
    prismaMock.user.findMany.mockResolvedValue([{ id: 'emp-1' }]);
    prismaMock.companyRegulationVersion.findFirst.mockResolvedValue({ id: 'reg-ver-1' });
    prismaMock.employeeDocumentAcknowledgment.groupBy.mockResolvedValue([{ employeeId: 'emp-1' }]);
    prismaMock.employeeRoleAssignment.findMany.mockResolvedValue([
      { employeeId: 'emp-1', jobRoleVersionId: 'role-ver-1' },
    ]);
    prismaMock.employeeDocumentAcknowledgment.findMany.mockResolvedValue([
      { employeeId: 'emp-1', jobRoleVersionId: 'role-ver-1' },
    ]);

    const status = await service.getAcknowledgmentStatus();

    expect(status.totalActiveEmployees).toBe(1);
    expect(status.regulationAcknowledgedCount).toBe(1);
    expect(status.roleAcknowledgedCount).toBe(1);
    expect(status.isFullyCompliant).toBe(true);
  });

  it('returns non-compliant when some employees have not acknowledged', async () => {
    prismaMock.user.findMany.mockResolvedValue([{ id: 'emp-1' }, { id: 'emp-2' }]);
    prismaMock.companyRegulationVersion.findFirst.mockResolvedValue({ id: 'reg-ver-1' });
    prismaMock.employeeDocumentAcknowledgment.groupBy.mockResolvedValue([{ employeeId: 'emp-1' }]);
    prismaMock.employeeRoleAssignment.findMany.mockResolvedValue([
      { employeeId: 'emp-1', jobRoleVersionId: 'role-ver-1' },
      { employeeId: 'emp-2', jobRoleVersionId: 'role-ver-1' },
    ]);
    prismaMock.employeeDocumentAcknowledgment.findMany.mockResolvedValue([]);

    const status = await service.getAcknowledgmentStatus();

    expect(status.totalActiveEmployees).toBe(2);
    expect(status.regulationAcknowledgedCount).toBe(1);
    expect(status.roleAcknowledgedCount).toBe(0);
    expect(status.isFullyCompliant).toBe(false);
  });
});
