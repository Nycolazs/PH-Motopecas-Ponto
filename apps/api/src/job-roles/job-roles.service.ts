import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { ClientContext } from '../auth/auth.types.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  AuditAction,
  AuditOutcome,
  AuditTargetType,
  type EmployeeRoleAssignment,
  type JobRole,
  type JobRoleVersion,
} from '../generated/prisma/client.js';
import type {
  AssignEmployeeRoleDto,
  CreateJobRoleDto,
  CreateJobRoleVersionDto,
  EmployeeRoleAssignmentResponseDto,
  JobRoleResponseDto,
  JobRoleVersionResponseDto,
  UpdateJobRoleDto,
} from './job-roles.dto.js';

function parseDateOnly(dateStr: string): Date {
  const parts = dateStr.trim().split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateOnly(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class JobRolesService {
  public constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  public async listRoles(includeInactive = false): Promise<JobRoleResponseDto[]> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const roles = await this.prisma.jobRole.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
        assignments: {
          where: {
            isPrincipal: true,
            startDate: { lte: today },
            OR: [{ endDate: null }, { endDate: { gte: today } }],
          },
          select: { employeeId: true },
        },
      },
      orderBy: { title: 'asc' },
    });

    return roles.map((role) => {
      const currentVersion = role.versions[0] ? this.serializeVersion(role.versions[0]) : null;
      const uniqueEmployeeIds = new Set(role.assignments.map((a) => a.employeeId));

      return {
        id: role.id,
        title: role.title,
        department: role.department,
        isActive: role.isActive,
        createdAt: role.createdAt.toISOString(),
        updatedAt: role.updatedAt.toISOString(),
        currentVersion,
        activeEmployeesCount: uniqueEmployeeIds.size,
      };
    });
  }

  public async getRole(id: string): Promise<JobRoleResponseDto> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const role = await this.prisma.jobRole.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
        assignments: {
          where: {
            isPrincipal: true,
            startDate: { lte: today },
            OR: [{ endDate: null }, { endDate: { gte: today } }],
          },
          select: { employeeId: true },
        },
      },
    });

    if (!role) {
      throw new NotFoundException({
        code: 'ROLE_NOT_FOUND',
        message: 'Cargo não encontrado.',
      });
    }

    const uniqueEmployeeIds = new Set(role.assignments.map((a) => a.employeeId));

    return {
      id: role.id,
      title: role.title,
      department: role.department,
      isActive: role.isActive,
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt.toISOString(),
      currentVersion: role.versions[0] ? this.serializeVersion(role.versions[0]) : null,
      versions: role.versions.map((v) => this.serializeVersion(v)),
      activeEmployeesCount: uniqueEmployeeIds.size,
    };
  }

  public async createRole(
    actorId: string,
    input: CreateJobRoleDto,
    context: ClientContext,
  ): Promise<JobRoleResponseDto> {
    const title = input.title.trim();
    const department = input.department?.trim() || null;
    const cbo = input.cbo?.trim() || null;
    const description = input.description.trim();
    const responsibilities = input.responsibilities?.map((r) => r.trim()).filter(Boolean) ?? [];
    const requirements = input.requirements?.map((r) => r.trim()).filter(Boolean) ?? [];

    const result = await this.prisma.$transaction(async (tx) => {
      const role = await tx.jobRole.create({
        data: {
          title,
          department,
          isActive: true,
        },
      });

      const version = await tx.jobRoleVersion.create({
        data: {
          jobRoleId: role.id,
          versionNumber: 1,
          title,
          cbo,
          description,
          responsibilities,
          requirements,
          createdById: actorId,
        },
      });

      await this.audit.record(
        {
          actorId,
          action: AuditAction.JOB_ROLE_CREATED,
          outcome: AuditOutcome.SUCCESS,
          targetType: AuditTargetType.JOB_ROLE,
          targetId: role.id,
          ...context,
          afterState: {
            title: role.title,
            department: role.department ?? null,
            versionNumber: version.versionNumber,
          },
        },
        tx,
      );

      return {
        role,
        version,
      };
    });

    return {
      id: result.role.id,
      title: result.role.title,
      department: result.role.department,
      isActive: result.role.isActive,
      createdAt: result.role.createdAt.toISOString(),
      updatedAt: result.role.updatedAt.toISOString(),
      currentVersion: this.serializeVersion(result.version),
      versions: [this.serializeVersion(result.version)],
      activeEmployeesCount: 0,
    };
  }

  public async updateRole(
    actorId: string,
    id: string,
    input: UpdateJobRoleDto,
    context: ClientContext,
  ): Promise<JobRoleResponseDto> {
    const existing = await this.getRole(id);

    const title = input.title !== undefined ? input.title.trim() : existing.title;
    const department =
      input.department !== undefined ? input.department?.trim() || null : existing.department;
    const isActive = input.isActive !== undefined ? input.isActive : existing.isActive;

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.jobRole.update({
        where: { id },
        data: {
          title,
          department: department ?? null,
          isActive,
        },
      });

      await this.audit.record(
        {
          actorId,
          action: AuditAction.JOB_ROLE_UPDATED,
          outcome: AuditOutcome.SUCCESS,
          targetType: AuditTargetType.JOB_ROLE,
          targetId: saved.id,
          ...context,
          beforeState: {
            title: existing.title,
            department: existing.department ?? null,
            isActive: existing.isActive,
          },
          afterState: {
            title: saved.title,
            department: saved.department ?? null,
            isActive: saved.isActive,
          },
        },
        tx,
      );

      return saved;
    });

    return {
      ...existing,
      title: updated.title,
      department: updated.department,
      isActive: updated.isActive,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  public async publishVersion(
    actorId: string,
    jobRoleId: string,
    input: CreateJobRoleVersionDto,
    context: ClientContext,
  ): Promise<JobRoleVersionResponseDto> {
    const role = await this.prisma.jobRole.findUnique({
      where: { id: jobRoleId },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
    });

    if (!role) {
      throw new NotFoundException({
        code: 'ROLE_NOT_FOUND',
        message: 'Cargo não encontrado.',
      });
    }

    const latestVersion = role.versions[0];
    const newVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;
    const title = input.title?.trim() || role.title;
    const cbo = input.cbo !== undefined ? input.cbo?.trim() || null : (latestVersion?.cbo ?? null);
    const description = input.description.trim();
    const responsibilities = input.responsibilities?.map((r) => r.trim()).filter(Boolean) ?? [];
    const requirements = input.requirements?.map((r) => r.trim()).filter(Boolean) ?? [];

    const version = await this.prisma.$transaction(async (tx) => {
      const created = await tx.jobRoleVersion.create({
        data: {
          jobRoleId,
          versionNumber: newVersionNumber,
          title,
          cbo,
          description,
          responsibilities,
          requirements,
          createdById: actorId,
        },
      });

      await this.audit.record(
        {
          actorId,
          action: AuditAction.JOB_ROLE_VERSION_PUBLISHED,
          outcome: AuditOutcome.SUCCESS,
          targetType: AuditTargetType.JOB_ROLE_VERSION,
          targetId: created.id,
          ...context,
          afterState: {
            jobRoleId,
            versionNumber: created.versionNumber,
            title: created.title,
          },
        },
        tx,
      );

      return created;
    });

    return this.serializeVersion(version);
  }

  public async assignRole(
    actorId: string,
    employeeId: string,
    input: AssignEmployeeRoleDto,
    context: ClientContext,
  ): Promise<EmployeeRoleAssignmentResponseDto> {
    const employee = await this.prisma.user.findFirst({
      where: { id: employeeId, role: 'EMPLOYEE' },
    });

    if (!employee) {
      throw new NotFoundException({
        code: 'EMPLOYEE_NOT_FOUND',
        message: 'Colaborador não encontrado.',
      });
    }

    const jobRole = await this.prisma.jobRole.findUnique({
      where: { id: input.jobRoleId },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
      },
    });

    if (!jobRole || !jobRole.isActive) {
      throw new BadRequestException({
        code: 'INVALID_JOB_ROLE',
        message: 'Cargo selecionado não existe ou está inativo.',
      });
    }

    let versionToAssign: JobRoleVersion | undefined;
    if (input.jobRoleVersionId) {
      versionToAssign = jobRole.versions.find((v) => v.id === input.jobRoleVersionId);
      if (!versionToAssign) {
        throw new BadRequestException({
          code: 'INVALID_JOB_ROLE_VERSION',
          message: 'Versão do cargo informada não pertence a este cargo.',
        });
      }
    } else {
      versionToAssign = jobRole.versions[0];
      if (!versionToAssign) {
        throw new BadRequestException({
          code: 'NO_PUBLISHED_VERSION',
          message: 'O cargo selecionado não possui nenhuma versão publicada.',
        });
      }
    }

    const startDate = parseDateOnly(input.startDate);
    const endDate = input.endDate ? parseDateOnly(input.endDate) : null;

    if (endDate && endDate < startDate) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: 'A data de término não pode ser anterior à data de início.',
      });
    }

    const isPrincipal = input.isPrincipal ?? true;

    const assignment = await this.prisma.$transaction(async (tx) => {
      if (isPrincipal) {
        // Find existing principal assignments for this employee
        const existingAssignments = await tx.employeeRoleAssignment.findMany({
          where: {
            employeeId,
            isPrincipal: true,
          },
        });

        for (const existing of existingAssignments) {
          const exStart = existing.startDate;
          const exEnd = existing.endDate;

          // If there is an open-ended assignment that started before new start date, close it
          if (exEnd === null && exStart < startDate) {
            const dayBefore = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
            await tx.employeeRoleAssignment.update({
              where: { id: existing.id },
              data: { endDate: dayBefore < exStart ? exStart : dayBefore },
            });
            continue;
          }

          // Check overlap:
          // Overlap exists if (exEnd == null or exEnd >= startDate) AND (endDate == null or exStart <= endDate)
          const overlaps =
            (exEnd === null || exEnd >= startDate) && (endDate === null || exStart <= endDate);

          if (overlaps) {
            throw new ConflictException({
              code: 'PRINCIPAL_ROLE_OVERLAP',
              message: 'O colaborador já possui um cargo principal ativo no período informado.',
            });
          }
        }
      }

      const created = await tx.employeeRoleAssignment.create({
        data: {
          employeeId,
          jobRoleId: jobRole.id,
          jobRoleVersionId: versionToAssign.id,
          startDate,
          endDate,
          isPrincipal,
          notes: input.notes?.trim() || null,
          createdById: actorId,
        },
        include: {
          jobRole: true,
          jobRoleVersion: true,
        },
      });

      await this.audit.record(
        {
          actorId,
          action: AuditAction.EMPLOYEE_ROLE_ASSIGNED,
          outcome: AuditOutcome.SUCCESS,
          targetType: AuditTargetType.EMPLOYEE_ROLE_ASSIGNMENT,
          targetId: created.id,
          ...context,
          afterState: {
            employeeId,
            jobRoleId: jobRole.id,
            roleTitle: jobRole.title,
            versionNumber: versionToAssign.versionNumber,
            startDate: input.startDate,
            endDate: input.endDate ?? null,
            isPrincipal,
          },
        },
        tx,
      );

      return created;
    });

    return this.serializeAssignment(assignment);
  }

  public async getEmployeeAssignments(
    employeeId: string,
  ): Promise<EmployeeRoleAssignmentResponseDto[]> {
    const assignments = await this.prisma.employeeRoleAssignment.findMany({
      where: { employeeId },
      include: {
        jobRole: true,
        jobRoleVersion: true,
      },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    });

    return assignments.map((a) => this.serializeAssignment(a));
  }

  private serializeVersion(v: JobRoleVersion): JobRoleVersionResponseDto {
    return {
      id: v.id,
      jobRoleId: v.jobRoleId,
      versionNumber: v.versionNumber,
      title: v.title,
      cbo: v.cbo,
      description: v.description,
      responsibilities: (v.responsibilities as string[]) ?? [],
      requirements: (v.requirements as string[]) ?? [],
      createdById: v.createdById,
      createdAt: v.createdAt.toISOString(),
      publishedAt: v.publishedAt.toISOString(),
    };
  }

  private serializeAssignment(
    a: EmployeeRoleAssignment & { jobRole: JobRole; jobRoleVersion: JobRoleVersion },
  ): EmployeeRoleAssignmentResponseDto {
    return {
      id: a.id,
      employeeId: a.employeeId,
      jobRoleId: a.jobRoleId,
      jobRoleVersionId: a.jobRoleVersionId,
      roleTitle: a.jobRole.title,
      versionNumber: a.jobRoleVersion.versionNumber,
      startDate: formatDateOnly(a.startDate)!,
      endDate: formatDateOnly(a.endDate),
      isPrincipal: a.isPrincipal,
      notes: a.notes,
      createdAt: a.createdAt.toISOString(),
    };
  }
}
