import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import {
  AuditAction,
  AuditOutcome,
  AuditTargetType,
  SessionRevocationReason,
} from '../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import type { ClientContext } from '../auth/auth.types.js';
import { SessionRevocationService } from '../auth/session-revocation.service.js';
import { PrismaService } from '../database/prisma.service.js';
import type {
  CreateEmploymentEventRequestDto,
  EmploymentEventResponseDto,
  ListEmploymentEventsQueryDto,
  PaginatedEmploymentEventsResponseDto,
  ReactivateEmployeeRequestDto,
  TerminateEmployeeRequestDto,
} from './employment-events.dto.js';

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class EmploymentEventsService {
  public constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(SessionRevocationService) private readonly sessions: SessionRevocationService,
  ) {}

  public async createEvent(
    actorId: string,
    employeeId: string,
    input: CreateEmploymentEventRequestDto,
    context: ClientContext,
  ): Promise<EmploymentEventResponseDto> {
    const employee = await this.prisma.user.findFirst({
      where: { id: employeeId, role: 'EMPLOYEE' },
      select: { id: true, name: true },
    });

    if (!employee) {
      throw new NotFoundException({
        code: 'EMPLOYEE_NOT_FOUND',
        message: 'Colaborador não encontrado.',
      });
    }

    const event = await this.prisma.employmentEvent.create({
      data: {
        employeeId: employee.id,
        eventType: input.eventType,
        effectiveDate: new Date(`${input.effectiveDate}T00:00:00.000Z`),
        title: input.title.trim(),
        description: input.description?.trim() ?? null,
        metadata: (input.metadata ?? null) as Prisma.InputJsonValue,
        createdById: actorId,
      },
      include: {
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    await this.audit.record({
      actorId,
      action: AuditAction.EMPLOYMENT_EVENT_CREATED,
      outcome: AuditOutcome.SUCCESS,
      targetType: AuditTargetType.EMPLOYMENT_EVENT,
      targetId: event.id,
      ...context,
      metadata: {
        employeeId: employee.id,
        eventType: input.eventType,
        effectiveDate: input.effectiveDate,
      },
    });

    return {
      id: event.id,
      employeeId: event.employeeId,
      eventType: event.eventType,
      effectiveDate: formatDateOnly(event.effectiveDate),
      title: event.title,
      description: event.description,
      metadata: event.metadata as Record<string, unknown> | null,
      createdById: event.createdById,
      createdByName: event.createdBy.name,
      createdAt: event.createdAt.toISOString(),
    };
  }

  public async listEvents(
    employeeId: string,
    query: ListEmploymentEventsQueryDto,
  ): Promise<PaginatedEmploymentEventsResponseDto> {
    const employee = await this.prisma.user.findFirst({
      where: { id: employeeId, role: 'EMPLOYEE' },
      select: { id: true },
    });

    if (!employee) {
      throw new NotFoundException({
        code: 'EMPLOYEE_NOT_FOUND',
        message: 'Colaborador não encontrado.',
      });
    }

    const where: Prisma.EmploymentEventWhereInput = {
      employeeId,
      ...(query.eventType ? { eventType: query.eventType } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.employmentEvent.findMany({
        where,
        orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
        skip: query.offset,
        take: query.limit,
        include: {
          createdBy: { select: { id: true, name: true } },
        },
      }),
      this.prisma.employmentEvent.count({ where }),
    ]);

    return {
      items: items.map((e) => ({
        id: e.id,
        employeeId: e.employeeId,
        eventType: e.eventType,
        effectiveDate: formatDateOnly(e.effectiveDate),
        title: e.title,
        description: e.description,
        metadata: e.metadata as Record<string, unknown> | null,
        createdById: e.createdById,
        createdByName: e.createdBy.name,
        createdAt: e.createdAt.toISOString(),
      })),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  public async terminate(
    actorId: string,
    employeeId: string,
    input: TerminateEmployeeRequestDto,
    context: ClientContext,
  ): Promise<{ success: boolean; message: string }> {
    return this.prisma.$transaction(async (tx) => {
      const employee = await tx.user.findFirst({
        where: { id: employeeId, role: 'EMPLOYEE' },
        select: { id: true, name: true, isActive: true },
      });

      if (!employee) {
        throw new NotFoundException({
          code: 'EMPLOYEE_NOT_FOUND',
          message: 'Colaborador não encontrado.',
        });
      }

      if (!employee.isActive) {
        throw new BadRequestException({
          code: 'EMPLOYEE_ALREADY_INACTIVE',
          message: 'Colaborador já se encontra inativo / desligado.',
        });
      }

      // Update user status and disable access
      await tx.user.update({
        where: { id: employee.id },
        data: {
          isActive: false,
          accessEnabled: false,
        },
      });

      // Revoke all active sessions
      await this.sessions.revokeAllForUser(
        employee.id,
        SessionRevocationReason.USER_DEACTIVATED,
        tx,
      );

      // Create Termination Event
      await tx.employmentEvent.create({
        data: {
          employeeId: employee.id,
          eventType: 'TERMINATION',
          effectiveDate: new Date(`${input.effectiveDate}T00:00:00.000Z`),
          title: 'Desligamento / Rescisão Contratual',
          description: input.notes?.trim() ?? null,
          metadata: {
            reason: input.reason,
            notes: input.notes?.trim() ?? null,
          },
          createdById: actorId,
        },
      });

      await this.audit.record(
        {
          actorId,
          action: AuditAction.EMPLOYEE_TERMINATED,
          outcome: AuditOutcome.SUCCESS,
          targetType: AuditTargetType.USER,
          targetId: employee.id,
          ...context,
          metadata: {
            reason: input.reason,
            effectiveDate: input.effectiveDate,
          },
        },
        tx,
      );

      return {
        success: true,
        message: 'Colaborador desligado com sucesso.',
      };
    });
  }

  public async reactivate(
    actorId: string,
    employeeId: string,
    input: ReactivateEmployeeRequestDto,
    context: ClientContext,
  ): Promise<{ success: boolean; message: string }> {
    return this.prisma.$transaction(async (tx) => {
      const employee = await tx.user.findFirst({
        where: { id: employeeId, role: 'EMPLOYEE' },
        select: { id: true, name: true, isActive: true },
      });

      if (!employee) {
        throw new NotFoundException({
          code: 'EMPLOYEE_NOT_FOUND',
          message: 'Colaborador não encontrado.',
        });
      }

      if (employee.isActive) {
        throw new BadRequestException({
          code: 'EMPLOYEE_ALREADY_ACTIVE',
          message: 'Colaborador já se encontra ativo.',
        });
      }

      // Reactivate employment; access remains disabled until explicitly granted
      await tx.user.update({
        where: { id: employee.id },
        data: {
          isActive: true,
        },
      });

      // Create Reactivation Event
      await tx.employmentEvent.create({
        data: {
          employeeId: employee.id,
          eventType: 'REACTIVATION',
          effectiveDate: new Date(`${input.effectiveDate}T00:00:00.000Z`),
          title: 'Reativação de Colaborador',
          description: input.notes?.trim() ?? null,
          metadata: {
            notes: input.notes?.trim() ?? null,
          },
          createdById: actorId,
        },
      });

      await this.audit.record(
        {
          actorId,
          action: AuditAction.EMPLOYEE_REACTIVATED,
          outcome: AuditOutcome.SUCCESS,
          targetType: AuditTargetType.USER,
          targetId: employee.id,
          ...context,
          metadata: {
            effectiveDate: input.effectiveDate,
          },
        },
        tx,
      );

      return {
        success: true,
        message: 'Colaborador reativado com sucesso.',
      };
    });
  }

  public async revokeSessions(
    actorId: string,
    employeeId: string,
    context: ClientContext,
  ): Promise<{ success: boolean; message: string }> {
    const employee = await this.prisma.user.findFirst({
      where: { id: employeeId, role: 'EMPLOYEE' },
      select: { id: true },
    });

    if (!employee) {
      throw new NotFoundException({
        code: 'EMPLOYEE_NOT_FOUND',
        message: 'Colaborador não encontrado.',
      });
    }

    await this.sessions.revokeAllForUser(employee.id, SessionRevocationReason.ADMIN_ACTION);

    await this.audit.record({
      actorId,
      action: AuditAction.USER_UPDATED,
      outcome: AuditOutcome.SUCCESS,
      targetType: AuditTargetType.USER,
      targetId: employee.id,
      ...context,
      metadata: { action: 'revoke_all_sessions' },
    });

    return {
      success: true,
      message: 'Todas as sessões do colaborador foram revogadas com sucesso.',
    };
  }
}
