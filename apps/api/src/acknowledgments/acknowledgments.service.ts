import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import {
  AcknowledgmentType,
  type EmployeeDocumentAcknowledgment,
  type Prisma,
  UserRole,
} from '../generated/prisma/client.js';
import type {
  AcknowledgmentStatusSummaryResponseDto,
  EmployeeDocumentAcknowledgmentResponseDto,
  ListAcknowledgmentsQueryDto,
  PaginatedAcknowledgmentsResponseDto,
} from './acknowledgments.dto.js';

interface AcknowledgmentWithRelations extends EmployeeDocumentAcknowledgment {
  employee?: {
    name: string;
  } | null;
}

@Injectable()
export class AcknowledgmentsService {
  public constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  public async listAcknowledgments(
    query: ListAcknowledgmentsQueryDto,
  ): Promise<PaginatedAcknowledgmentsResponseDto> {
    const where: Prisma.EmployeeDocumentAcknowledgmentWhereInput = {};

    if (query.employeeId) {
      where.employeeId = query.employeeId;
    }

    if (query.type) {
      where.acknowledgmentType = query.type;
    }

    const [total, items] = await Promise.all([
      this.prisma.employeeDocumentAcknowledgment.count({ where }),
      this.prisma.employeeDocumentAcknowledgment.findMany({
        where,
        include: {
          employee: {
            select: { name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
    ]);

    return {
      items: items.map((item) => this.serializeAcknowledgment(item)),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  public async getAcknowledgmentStatus(): Promise<AcknowledgmentStatusSummaryResponseDto> {
    const activeEmployees = await this.prisma.user.findMany({
      where: {
        role: UserRole.EMPLOYEE,
        isActive: true,
      },
      select: { id: true },
    });

    const totalActiveEmployees = activeEmployees.length;

    if (totalActiveEmployees === 0) {
      return {
        totalActiveEmployees: 0,
        regulationAcknowledgedCount: 0,
        roleAcknowledgedCount: 0,
        isFullyCompliant: true,
      };
    }

    const activeEmployeeIds = activeEmployees.map((e) => e.id);

    // Latest regulation version
    const latestRegulation = await this.prisma.companyRegulationVersion.findFirst({
      orderBy: { versionNumber: 'desc' },
    });

    let regulationAcknowledgedCount = 0;
    if (latestRegulation) {
      const regAcks = await this.prisma.employeeDocumentAcknowledgment.groupBy({
        by: ['employeeId'],
        where: {
          employeeId: { in: activeEmployeeIds },
          acknowledgmentType: AcknowledgmentType.REGULATION,
          regulationVersionId: latestRegulation.id,
        },
      });
      regulationAcknowledgedCount = regAcks.length;
    }

    // Role assignments
    const activeAssignments = await this.prisma.employeeRoleAssignment.findMany({
      where: {
        employeeId: { in: activeEmployeeIds },
        isPrincipal: true,
        endDate: null,
      },
      select: { employeeId: true, jobRoleVersionId: true },
    });

    let roleAcknowledgedCount = 0;
    if (activeAssignments.length > 0) {
      const roleAcks = await this.prisma.employeeDocumentAcknowledgment.findMany({
        where: {
          employeeId: { in: activeEmployeeIds },
          acknowledgmentType: AcknowledgmentType.ROLE,
        },
        select: { employeeId: true, jobRoleVersionId: true },
      });

      const ackSet = new Set(roleAcks.map((a) => `${a.employeeId}:${a.jobRoleVersionId}`));
      const acknowledgedEmployees = new Set<string>();

      for (const assignment of activeAssignments) {
        if (ackSet.has(`${assignment.employeeId}:${assignment.jobRoleVersionId}`)) {
          acknowledgedEmployees.add(assignment.employeeId);
        }
      }

      roleAcknowledgedCount = acknowledgedEmployees.size;
    }

    const isFullyCompliant =
      totalActiveEmployees > 0 &&
      regulationAcknowledgedCount >= totalActiveEmployees &&
      roleAcknowledgedCount >= totalActiveEmployees;

    return {
      totalActiveEmployees,
      regulationAcknowledgedCount,
      roleAcknowledgedCount,
      isFullyCompliant,
    };
  }

  private serializeAcknowledgment(
    ack: AcknowledgmentWithRelations,
  ): EmployeeDocumentAcknowledgmentResponseDto {
    return {
      id: ack.id,
      employeeId: ack.employeeId,
      employeeName: ack.employee?.name ?? null,
      acknowledgmentType: ack.acknowledgmentType,
      regulationVersionId: ack.regulationVersionId,
      jobRoleVersionId: ack.jobRoleVersionId,
      generatedDocumentId: ack.generatedDocumentId,
      acknowledgedAt: ack.acknowledgedAt.toISOString(),
      createdById: ack.createdById,
      createdAt: ack.createdAt.toISOString(),
    };
  }
}
