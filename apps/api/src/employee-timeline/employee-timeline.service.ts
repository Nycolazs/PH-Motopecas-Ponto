import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type {
  EmployeeTimelineItemResponseDto,
  ListTimelineQueryDto,
  PaginatedTimelineResponseDto,
} from './employee-timeline.dto.js';

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class EmployeeTimelineService {
  public constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  public async getTimeline(
    employeeId: string,
    query: ListTimelineQueryDto,
  ): Promise<PaginatedTimelineResponseDto> {
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

    // 1. Fetch all historical streams in parallel
    const [events, roleAssignments, documents, vacations, accessAudits] = await Promise.all([
      this.prisma.employmentEvent.findMany({
        where: { employeeId },
        include: { createdBy: { select: { name: true } } },
      }),
      this.prisma.employeeRoleAssignment.findMany({
        where: { employeeId },
        include: {
          jobRole: { select: { title: true, department: true } },
          jobRoleVersion: { select: { versionNumber: true } },
          createdBy: { select: { name: true } },
        },
      }),
      this.prisma.generatedDocument.findMany({
        where: { employeeId, isVoid: false },
        include: { author: { select: { name: true } } },
      }),
      this.prisma.vacation.findMany({
        where: { employeeId },
        include: { createdBy: { select: { name: true } } },
      }),
      this.prisma.auditLog.findMany({
        where: {
          targetType: 'USER',
          targetId: employeeId,
          action: 'EMPLOYEE_ACCESS_UPDATED',
        },
        include: { actor: { select: { name: true } } },
      }),
    ]);

    const items: EmployeeTimelineItemResponseDto[] = [];

    // Map Employment Events
    for (const e of events) {
      const isDiscipline = e.eventType === 'SUSPENSION';
      items.push({
        id: `evt-${e.id}`,
        category: isDiscipline ? 'DISCIPLINE' : 'EMPLOYMENT',
        title: e.title,
        description: e.description,
        occurredAt: e.effectiveDate.toISOString(),
        businessDate: formatDateOnly(e.effectiveDate),
        actorName: e.createdBy.name,
        metadata: e.metadata as Record<string, unknown> | null,
      });
    }

    // Map Role Assignments
    for (const r of roleAssignments) {
      items.push({
        id: `role-${r.id}`,
        category: 'ROLE',
        title: `Atribuição de Cargo: ${r.jobRole.title}${r.isPrincipal ? ' (Principal)' : ''}`,
        description: r.jobRole.department
          ? `Departamento: ${r.jobRole.department} · Versão v${r.jobRoleVersion.versionNumber}`
          : `Versão v${r.jobRoleVersion.versionNumber}`,
        occurredAt: r.startDate.toISOString(),
        businessDate: formatDateOnly(r.startDate),
        actorName: r.createdBy.name,
        metadata: {
          roleId: r.jobRoleId,
          versionNumber: r.jobRoleVersion.versionNumber,
          isPrincipal: r.isPrincipal,
        },
      });
    }

    // Map Generated Documents
    for (const d of documents) {
      items.push({
        id: `doc-${d.id}`,
        category: 'DOCUMENT',
        title: d.title,
        description: `Documento emitido: ${d.documentType}`,
        occurredAt: d.createdAt.toISOString(),
        businessDate: formatDateOnly(d.createdAt),
        actorName: d.author.name,
        documentId: d.id,
        documentType: d.documentType,
        metadata: {
          documentType: d.documentType,
        },
      });
    }

    // Map Vacations
    for (const v of vacations) {
      items.push({
        id: `vac-${v.id}`,
        category: 'VACATION',
        title: `Férias: ${formatDateOnly(v.startDate)} até ${formatDateOnly(v.endDate)}`,
        description: v.note ?? 'Período regular de descanso anual registrado.',
        occurredAt: v.startDate.toISOString(),
        businessDate: formatDateOnly(v.startDate),
        actorName: v.createdBy.name,
        metadata: {
          startDate: formatDateOnly(v.startDate),
          endDate: formatDateOnly(v.endDate),
        },
      });
    }

    // Map Access Updates
    for (const a of accessAudits) {
      const afterState = a.afterState as { accessEnabled?: boolean } | null;
      const isEnabled = afterState?.accessEnabled ?? true;
      items.push({
        id: `access-${a.id}`,
        category: 'ACCESS',
        title: isEnabled ? 'Acesso ao Aplicativo Liberado' : 'Acesso ao Aplicativo Bloqueado',
        description: isEnabled
          ? 'Permissão de autenticação no aplicativo concedida.'
          : 'Acesso ao aplicativo revogado (sessões encerradas).',
        occurredAt: a.createdAt.toISOString(),
        businessDate: formatDateOnly(a.createdAt),
        actorName: a.actor?.name ?? null,
        metadata: {
          accessEnabled: isEnabled,
        },
      });
    }

    // Filter by Category
    const filtered =
      query.category && query.category !== 'ALL'
        ? items.filter((item) => item.category === query.category)
        : items;

    // Stable sort: chronological DESC, then ID DESC
    filtered.sort((a, b) => {
      const timeDiff = new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
      if (timeDiff !== 0) return timeDiff;
      return b.id.localeCompare(a.id);
    });

    const total = filtered.length;
    const sliced = filtered.slice(query.offset, query.offset + query.limit);

    return {
      items: sliced,
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }
}
