import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditService } from '../audit/audit.service.js';
import type { PrismaService } from '../database/prisma.service.js';
import { JobRolesService } from './job-roles.service.js';

interface JobRolesPrismaMock {
  jobRole: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  jobRoleVersion: {
    create: ReturnType<typeof vi.fn>;
  };
  user: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  employeeRoleAssignment: {
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
}

interface AuditMock {
  record: ReturnType<typeof vi.fn>;
}

describe('JobRolesService', () => {
  let service: JobRolesService;
  let prismaMock: JobRolesPrismaMock;
  let auditMock: AuditMock;

  const actorId = '10000000-0000-4000-8000-000000000001';
  const roleId = '20000000-0000-4000-8000-000000000001';
  const employeeId = '30000000-0000-4000-8000-000000000001';
  const versionId = '40000000-0000-4000-8000-000000000001';

  const mockVersion = {
    id: versionId,
    jobRoleId: roleId,
    versionNumber: 1,
    title: 'Mecânico de Motos',
    cbo: '9144-05',
    description: 'Manutenção preventiva e corretiva de motos.',
    responsibilities: ['Revisão de motores', 'Troca de óleo'],
    requirements: ['Ensino Médio'],
    createdById: actorId,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    publishedAt: new Date('2026-08-01T00:00:00.000Z'),
  };

  const mockRole = {
    id: roleId,
    title: 'Mecânico de Motos',
    department: 'Oficina',
    isActive: true,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    versions: [mockVersion],
    assignments: [{ employeeId }],
  };

  beforeEach(() => {
    prismaMock = {
      jobRole: {
        findMany: vi.fn().mockResolvedValue([mockRole]),
        findUnique: vi.fn().mockResolvedValue(mockRole),
        create: vi.fn().mockResolvedValue(mockRole),
        update: vi.fn().mockResolvedValue(mockRole),
      },
      jobRoleVersion: {
        create: vi.fn().mockResolvedValue(mockVersion),
      },
      user: {
        findFirst: vi.fn().mockResolvedValue({
          id: employeeId,
          role: 'EMPLOYEE',
          isActive: true,
        }),
      },
      employeeRoleAssignment: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({
          id: '50000000-0000-4000-8000-000000000001',
          employeeId,
          jobRoleId: roleId,
          jobRoleVersionId: versionId,
          startDate: new Date('2026-08-15T00:00:00.000Z'),
          endDate: null,
          isPrincipal: true,
          notes: null,
          createdAt: new Date('2026-08-15T00:00:00.000Z'),
          jobRole: mockRole,
          jobRoleVersion: mockVersion,
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(prismaMock)),
    };

    auditMock = {
      record: vi.fn().mockResolvedValue('audit-123'),
    };

    service = new JobRolesService(
      prismaMock as unknown as PrismaService,
      auditMock as unknown as AuditService,
    );
  });

  it('lists active roles with version and active employee count', async () => {
    const roles = await service.listRoles();

    expect(roles).toHaveLength(1);
    expect(roles[0].title).toBe('Mecânico de Motos');
    expect(roles[0].currentVersion?.versionNumber).toBe(1);
    expect(roles[0].activeEmployeesCount).toBe(1);
  });

  it('creates role and initial version atomically with audit record', async () => {
    const created = await service.createRole(
      actorId,
      {
        title: 'Mecânico de Motos',
        department: 'Oficina',
        cbo: '9144-05',
        description: 'Manutenção preventiva e corretiva de motos.',
        responsibilities: ['Revisão de motores'],
        requirements: ['Ensino Médio'],
      },
      { requestId: 'req-1', ipHash: 'hash-1' },
    );

    expect(created.title).toBe('Mecânico de Motos');
    expect(created.currentVersion?.versionNumber).toBe(1);
    expect(auditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'JOB_ROLE_CREATED',
        targetId: roleId,
      }),
      expect.anything(),
    );
  });

  it('gets a role by ID and throws NotFoundException if absent', async () => {
    prismaMock.jobRole.findUnique.mockResolvedValue(null);

    await expect(service.getRole('unknown-id')).rejects.toThrow(NotFoundException);
  });

  it('publishes a new immutable version incrementing versionNumber', async () => {
    prismaMock.jobRole.findUnique.mockResolvedValue({
      ...mockRole,
      versions: [mockVersion],
    });
    prismaMock.jobRoleVersion.create.mockResolvedValue({
      ...mockVersion,
      id: 'version-2-id',
      versionNumber: 2,
      description: 'Descrição atualizada da função.',
    });

    const newVersion = await service.publishVersion(
      actorId,
      roleId,
      {
        description: 'Descrição atualizada da função.',
      },
      { requestId: 'req-1', ipHash: 'hash-1' },
    );

    expect(newVersion.versionNumber).toBe(2);
    expect(prismaMock.jobRoleVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          versionNumber: 2,
          description: 'Descrição atualizada da função.',
        }),
      }),
    );
    expect(auditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'JOB_ROLE_VERSION_PUBLISHED',
      }),
      expect.anything(),
    );
  });

  it('assigns role to employee, auto-closing prior open principal assignment', async () => {
    const priorAssignment = {
      id: 'prior-assign-id',
      employeeId,
      jobRoleId: 'old-role-id',
      jobRoleVersionId: 'old-version-id',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: null,
      isPrincipal: true,
    };
    prismaMock.employeeRoleAssignment.findMany.mockResolvedValue([priorAssignment]);

    const result = await service.assignRole(
      actorId,
      employeeId,
      {
        jobRoleId: roleId,
        startDate: '2026-08-15',
        isPrincipal: true,
      },
      { requestId: 'req-1', ipHash: 'hash-1' },
    );

    expect(result.roleTitle).toBe('Mecânico de Motos');
    expect(prismaMock.employeeRoleAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'prior-assign-id' },
        data: expect.objectContaining({
          endDate: expect.any(Date),
        }),
      }),
    );
    expect(auditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'EMPLOYEE_ROLE_ASSIGNED',
      }),
      expect.anything(),
    );
  });

  it('rejects assignment when endDate is before startDate', async () => {
    await expect(
      service.assignRole(
        actorId,
        employeeId,
        {
          jobRoleId: roleId,
          startDate: '2026-08-15',
          endDate: '2026-08-10',
        },
        { requestId: 'req-1', ipHash: 'hash-1' },
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
