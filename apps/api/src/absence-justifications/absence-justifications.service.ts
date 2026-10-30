import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { compareBusinessDates, isBusinessDate } from '../attendance/business-date.js';

import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser, ClientContext } from '../auth/auth.types.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  AbsenceJustificationKind,
  AuditAction,
  AuditTargetType,
  type Prisma,
  UserRole,
} from '../generated/prisma/client.js';
import {
  businessDateToDatabaseDate,
  databaseDateToBusinessDate,
} from '../schedules/business-date.js';
import type {
  CreateAbsenceJustificationDto,
  ListAbsenceJustificationsQueryDto,
  RevokeAbsenceJustificationDto,
} from './absence-justification.dto.js';
import {
  ABSENCE_JUSTIFICATION_INCLUDE,
  countDays,
  toAbsenceJustificationView,
  type AbsenceJustificationListViewDto,
  type AbsenceJustificationViewDto,
} from './absence-justification.view.js';

/** Longest atestado registered at once; longer leaves go through the INSS. */
export const MAX_JUSTIFIED_DAYS = 31;

const KIND_LABEL: Record<AbsenceJustificationKind, string> = {
  ALLOWANCE: 'abono',
  MEDICAL_CERTIFICATE: 'atestado',
};

function formatDate(date: Date): string {
  const [year, month, day] = databaseDateToBusinessDate(date).split('-');
  return `${day}/${month}/${year}`;
}

@Injectable()
export class AbsenceJustificationsService {
  public constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  public async create(
    actor: AuthenticatedUser,
    input: CreateAbsenceJustificationDto,
    context: ClientContext,
  ): Promise<AbsenceJustificationViewDto> {
    if (!isBusinessDate(input.startDate) || !isBusinessDate(input.endDate)) {
      throw new BadRequestException({ code: 'INVALID_DATE', message: 'Informe datas válidas.' });
    }
    if (compareBusinessDates(input.startDate, input.endDate) > 0) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: 'A data inicial deve ser anterior ou igual à data final.',
      });
    }
    if (input.kind === AbsenceJustificationKind.ALLOWANCE && input.startDate !== input.endDate) {
      throw new BadRequestException({
        code: 'ALLOWANCE_SINGLE_DAY',
        message: 'O abono vale para um dia. Para vários dias, registre um abono por dia.',
      });
    }
    if (countDays(input.startDate, input.endDate) > MAX_JUSTIFIED_DAYS) {
      throw new BadRequestException({
        code: 'JUSTIFICATION_TOO_LONG',
        message: `Um atestado pode cobrir no máximo ${MAX_JUSTIFIED_DAYS} dias.`,
      });
    }

    const startDate = businessDateToDatabaseDate(input.startDate);
    const endDate = businessDateToDatabaseDate(input.endDate);

    const created = await this.prisma.$transaction(
      async (tx) => {
        const employee = await tx.user.findUnique({
          where: { id: input.employeeId },
          select: { id: true, name: true, role: true },
        });
        if (employee === null || employee.role !== UserRole.EMPLOYEE) {
          throw new NotFoundException({
            code: 'EMPLOYEE_NOT_FOUND',
            message: 'Colaborador não encontrado.',
          });
        }

        const overlapping = await tx.absenceJustification.findFirst({
          where: {
            employeeId: input.employeeId,
            revokedAt: null,
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
          select: { kind: true, startDate: true, endDate: true },
        });
        if (overlapping !== null) {
          const period =
            overlapping.startDate.getTime() === overlapping.endDate.getTime()
              ? `em ${formatDate(overlapping.startDate)}`
              : `de ${formatDate(overlapping.startDate)} a ${formatDate(overlapping.endDate)}`;
          throw new ConflictException({
            code: 'JUSTIFICATION_OVERLAP',
            message: `Já existe um ${KIND_LABEL[overlapping.kind]} ${period} para este colaborador. Cancele-o antes, se precisar mudar.`,
          });
        }

        const vacation = await tx.vacation.findFirst({
          where: {
            employeeId: input.employeeId,
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
          select: { startDate: true, endDate: true },
        });
        if (vacation !== null) {
          throw new ConflictException({
            code: 'JUSTIFICATION_DURING_VACATION',
            message: `O colaborador está de férias de ${formatDate(vacation.startDate)} a ${formatDate(vacation.endDate)}; esses dias já não contam como falta.`,
          });
        }

        const justification = await tx.absenceJustification.create({
          data: {
            employeeId: input.employeeId,
            kind: input.kind,
            startDate,
            endDate,
            reason: input.reason,
            createdById: actor.id,
          },
          include: ABSENCE_JUSTIFICATION_INCLUDE,
        });

        await this.audit.record(
          {
            actorId: actor.id,
            action: AuditAction.ABSENCE_JUSTIFIED,
            targetType: AuditTargetType.ABSENCE_JUSTIFICATION,
            targetId: justification.id,
            ...context,
            afterState: {
              employeeId: input.employeeId,
              employeeName: employee.name,
              reason: input.reason,
              kind: input.kind,
              startDate: input.startDate,
              endDate: input.endDate,
            },
          },
          tx,
        );
        return justification;
      },
      { isolationLevel: 'Serializable' },
    );

    return toAbsenceJustificationView(created);
  }

  public async list(
    query: ListAbsenceJustificationsQueryDto,
  ): Promise<AbsenceJustificationListViewDto> {
    const where: Prisma.AbsenceJustificationWhereInput = {};
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.to) where.startDate = { lte: businessDateToDatabaseDate(query.to) };
    if (query.from) where.endDate = { gte: businessDateToDatabaseDate(query.from) };

    const items = await this.prisma.absenceJustification.findMany({
      where,
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
      take: 200,
      include: ABSENCE_JUSTIFICATION_INCLUDE,
    });
    return { items: items.map(toAbsenceJustificationView) };
  }

  public async revoke(
    actor: AuthenticatedUser,
    id: string,
    input: RevokeAbsenceJustificationDto,
    context: ClientContext,
  ): Promise<AbsenceJustificationViewDto> {
    const revoked = await this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.absenceJustification.findUnique({
          where: { id },
          include: ABSENCE_JUSTIFICATION_INCLUDE,
        });
        if (existing === null) {
          throw new NotFoundException({
            code: 'JUSTIFICATION_NOT_FOUND',
            message: 'Justificativa não encontrada.',
          });
        }
        if (existing.revokedAt !== null) {
          throw new ConflictException({
            code: 'JUSTIFICATION_ALREADY_REVOKED',
            message: 'Esta justificativa já foi cancelada.',
          });
        }

        const updated = await tx.absenceJustification.update({
          where: { id },
          data: { revokedAt: new Date(), revokedById: actor.id, revokeReason: input.reason },
          include: ABSENCE_JUSTIFICATION_INCLUDE,
        });

        await this.audit.record(
          {
            actorId: actor.id,
            action: AuditAction.ABSENCE_JUSTIFICATION_REVOKED,
            targetType: AuditTargetType.ABSENCE_JUSTIFICATION,
            targetId: id,
            ...context,
            metadata: { revokeReason: input.reason },
            beforeState: {
              employeeId: existing.employee.id,
              employeeName: existing.employee.name,
              kind: existing.kind,
              startDate: databaseDateToBusinessDate(existing.startDate),
              endDate: databaseDateToBusinessDate(existing.endDate),
              reason: existing.reason,
            },
          },
          tx,
        );
        return updated;
      },
      { isolationLevel: 'Serializable' },
    );
    return toAbsenceJustificationView(revoked);
  }
}
