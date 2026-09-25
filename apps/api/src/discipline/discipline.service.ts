import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { calculateDisciplinaryProgression, type ActionForProgression } from '@ph-ponto/shared';
import { AuditService } from '../audit/audit.service.js';
import type { ClientContext } from '../auth/auth.types.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  AuditAction,
  AuditOutcome,
  AuditTargetType,
  type DisciplinaryAction,
  type User,
} from '../generated/prisma/client.js';
import type {
  DisciplinaryActionResponseDto,
  DisciplinaryProgressionSummaryResponseDto,
  ListDisciplinaryActionsQueryDto,
  VoidDisciplinaryActionDto,
} from './discipline.dto.js';

function formatDateOnly(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}

type ActionWithRelations = DisciplinaryAction & {
  employee?: User | null;
  issuer?: User | null;
  priorAction?: DisciplinaryAction | null;
  voidedBy?: User | null;
};

@Injectable()
export class DisciplineService {
  public constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  public async getProgressionSummary(
    employeeId: string,
  ): Promise<DisciplinaryProgressionSummaryResponseDto> {
    const employee = await this.prisma.user.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new NotFoundException({
        code: 'EMPLOYEE_NOT_FOUND',
        message: 'Colaborador não encontrado.',
      });
    }

    const actions = await this.prisma.disciplinaryAction.findMany({
      where: { employeeId },
      orderBy: { incidentDate: 'desc' },
    });

    const progressionInputs: ActionForProgression[] = actions.map((act) => ({
      actionType: act.actionType,
      isVoid: act.isVoid,
      incidentDate: formatDateOnly(act.incidentDate)!,
      suspensionDays: act.suspensionDays,
    }));

    const summary = calculateDisciplinaryProgression(employee.id, employee.name, progressionInputs);

    return {
      ...summary,
      employeeName: summary.employeeName ?? null,
      lastActionDate: summary.lastActionDate ?? null,
      lastActionType: summary.lastActionType ?? null,
    };
  }

  public async listActions(
    query: ListDisciplinaryActionsQueryDto,
  ): Promise<DisciplinaryActionResponseDto[]> {
    const whereClause: {
      employeeId?: string;
      isVoid?: boolean;
    } = {};

    if (query.employeeId) {
      whereClause.employeeId = query.employeeId;
    }

    if (query.isVoid !== undefined) {
      whereClause.isVoid = query.isVoid;
    }

    const actions = await this.prisma.disciplinaryAction.findMany({
      where: whereClause,
      include: {
        employee: true,
        issuer: true,
        priorAction: true,
        voidedBy: true,
      },
      orderBy: { incidentDate: 'desc' },
    });

    return actions.map((act) => this.serializeAction(act));
  }

  public async getActionById(id: string): Promise<DisciplinaryActionResponseDto> {
    const action = await this.prisma.disciplinaryAction.findUnique({
      where: { id },
      include: {
        employee: true,
        issuer: true,
        priorAction: true,
        voidedBy: true,
      },
    });

    if (!action) {
      throw new NotFoundException({
        code: 'DISCIPLINARY_ACTION_NOT_FOUND',
        message: 'Medida disciplinar não encontrada.',
      });
    }

    return this.serializeAction(action);
  }

  public async voidAction(
    id: string,
    actorId: string,
    input: VoidDisciplinaryActionDto,
    context: ClientContext,
  ): Promise<DisciplinaryActionResponseDto> {
    const action = await this.prisma.disciplinaryAction.findUnique({
      where: { id },
      include: {
        employee: true,
        issuer: true,
        priorAction: true,
      },
    });

    if (!action) {
      throw new NotFoundException({
        code: 'DISCIPLINARY_ACTION_NOT_FOUND',
        message: 'Medida disciplinar não encontrada.',
      });
    }

    if (action.isVoid) {
      throw new BadRequestException({
        code: 'DISCIPLINARY_ACTION_ALREADY_VOID',
        message: 'Esta medida disciplinar já se encontra anulada.',
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const voidedAt = new Date();
      const voidReason = input.reason.trim();

      const voidedAction = await tx.disciplinaryAction.update({
        where: { id },
        data: {
          isVoid: true,
          voidReason,
          voidedById: actorId,
          voidedAt,
        },
        include: {
          employee: true,
          issuer: true,
          priorAction: true,
          voidedBy: true,
        },
      });

      if (action.generatedDocumentId) {
        await tx.generatedDocument.update({
          where: { id: action.generatedDocumentId },
          data: {
            isVoid: true,
            voidReason,
            voidedById: actorId,
            voidedAt,
          },
        });
      }

      await this.audit.record(
        {
          actorId,
          action: AuditAction.DISCIPLINARY_ACTION_VOIDED,
          outcome: AuditOutcome.SUCCESS,
          targetType: AuditTargetType.DISCIPLINARY_ACTION,
          targetId: id,
          ...context,
          beforeState: {
            isVoid: false,
          },
          afterState: {
            isVoid: true,
            voidReason,
            voidedAt: voidedAt.toISOString(),
          },
        },
        tx,
      );

      return voidedAction;
    });

    return this.serializeAction(updated);
  }

  private serializeAction(act: ActionWithRelations): DisciplinaryActionResponseDto {
    return {
      id: act.id,
      companyId: act.companyId,
      employeeId: act.employeeId,
      employeeName: act.employee?.name ?? null,
      issuerId: act.issuerId,
      issuerName: act.issuer?.name ?? null,
      actionType: act.actionType,
      documentType: act.documentType,
      incidentDate: formatDateOnly(act.incidentDate)!,
      reason: act.reason,
      details: act.details,
      internalClauseRef: act.internalClauseRef,
      suspensionDays: act.suspensionDays,
      suspensionStartDate: formatDateOnly(act.suspensionStartDate),
      suspensionEndDate: formatDateOnly(act.suspensionEndDate),
      priorActionId: act.priorActionId,
      priorActionSummary: act.priorAction
        ? `${act.priorAction.actionType} - ${formatDateOnly(act.priorAction.incidentDate)}: ${act.priorAction.reason}`
        : null,
      generatedDocumentId: act.generatedDocumentId,
      isVoid: act.isVoid,
      voidReason: act.voidReason,
      voidedById: act.voidedById,
      voidedAt: act.voidedAt?.toISOString() ?? null,
      createdAt: act.createdAt.toISOString(),
      updatedAt: act.updatedAt.toISOString(),
    };
  }
}
