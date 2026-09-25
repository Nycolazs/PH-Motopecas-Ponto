import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../database/prisma.service.js';
import { EmployeeTimelineService } from './employee-timeline.service.js';

interface TimelinePrismaMock {
  user: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  employmentEvent: {
    findMany: ReturnType<typeof vi.fn>;
  };
  employeeRoleAssignment: {
    findMany: ReturnType<typeof vi.fn>;
  };
  generatedDocument: {
    findMany: ReturnType<typeof vi.fn>;
  };
  vacation: {
    findMany: ReturnType<typeof vi.fn>;
  };
  auditLog: {
    findMany: ReturnType<typeof vi.fn>;
  };
}

describe('EmployeeTimelineService', () => {
  let service: EmployeeTimelineService;
  let prisma: TimelinePrismaMock;

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: vi.fn(),
      },
      employmentEvent: {
        findMany: vi.fn(),
      },
      employeeRoleAssignment: {
        findMany: vi.fn(),
      },
      generatedDocument: {
        findMany: vi.fn(),
      },
      vacation: {
        findMany: vi.fn(),
      },
      auditLog: {
        findMany: vi.fn(),
      },
    };

    service = new EmployeeTimelineService(prisma as unknown as PrismaService);
  });

  it('aggregates events, roles, documents, vacations and access audits in chronological order', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'emp-1' });

    prisma.employmentEvent.findMany.mockResolvedValue([
      {
        id: 'evt-1',
        eventType: 'ADMISSION',
        effectiveDate: new Date('2026-01-10T00:00:00.000Z'),
        title: 'Admissão',
        description: 'Contratação do colaborador',
        metadata: null,
        createdBy: { name: 'Admin 1' },
      },
    ]);

    prisma.employeeRoleAssignment.findMany.mockResolvedValue([
      {
        id: 'role-1',
        jobRoleId: 'job-1',
        startDate: new Date('2026-01-10T00:00:00.000Z'),
        isPrincipal: true,
        jobRole: { title: 'Mecânico', department: 'Oficina' },
        jobRoleVersion: { versionNumber: 1 },
        createdBy: { name: 'Admin 1' },
      },
    ]);

    prisma.generatedDocument.findMany.mockResolvedValue([
      {
        id: 'doc-1',
        title: 'Termo de Ciência',
        documentType: 'ACKNOWLEDGMENT_REGULATION',
        createdAt: new Date('2026-01-15T00:00:00.000Z'),
        author: { name: 'Admin 1' },
      },
    ]);

    prisma.vacation.findMany.mockResolvedValue([
      {
        id: 'vac-1',
        startDate: new Date('2026-05-01T00:00:00.000Z'),
        endDate: new Date('2026-05-15T00:00:00.000Z'),
        note: 'Férias regulares',
        createdBy: { name: 'Admin 1' },
      },
    ]);

    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'aud-1',
        createdAt: new Date('2026-01-11T00:00:00.000Z'),
        afterState: { accessEnabled: true },
        actor: { name: 'Admin 1' },
      },
    ]);

    const result = await service.getTimeline('emp-1', { limit: 10, offset: 0 });

    expect(result.total).toBe(5);
    expect(result.items).toHaveLength(5);
    // Most recent first: vacation (May), document (Jan 15), access (Jan 11), role / admission (Jan 10)
    expect(result.items[0]!.category).toBe('VACATION');
    expect(result.items[1]!.category).toBe('DOCUMENT');
    expect(result.items[2]!.category).toBe('ACCESS');
  });

  it('filters items by category when category query is specified', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'emp-1' });

    prisma.employmentEvent.findMany.mockResolvedValue([
      {
        id: 'evt-1',
        eventType: 'ADMISSION',
        effectiveDate: new Date('2026-01-10T00:00:00.000Z'),
        title: 'Admissão',
        description: 'Contratação',
        metadata: null,
        createdBy: { name: 'Admin' },
      },
    ]);
    prisma.employeeRoleAssignment.findMany.mockResolvedValue([]);
    prisma.generatedDocument.findMany.mockResolvedValue([
      {
        id: 'doc-1',
        title: 'Doc',
        documentType: 'ROLE_MAP',
        createdAt: new Date('2026-01-12T00:00:00.000Z'),
        author: { name: 'Admin' },
      },
    ]);
    prisma.vacation.findMany.mockResolvedValue([]);
    prisma.auditLog.findMany.mockResolvedValue([]);

    const result = await service.getTimeline('emp-1', {
      category: 'DOCUMENT',
      limit: 10,
      offset: 0,
    });

    expect(result.total).toBe(1);
    expect(result.items[0]!.category).toBe('DOCUMENT');
    expect(result.items[0]!.title).toBe('Doc');
  });

  it('throws NotFoundException if employee not found', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(service.getTimeline('emp-nonexistent', { limit: 10, offset: 0 })).rejects.toThrow(
      NotFoundException,
    );
  });
});
