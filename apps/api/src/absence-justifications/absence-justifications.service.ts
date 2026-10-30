import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { DailyAttendanceSummary } from '@ph-ponto/shared';

import {
  compareBusinessDates,
  enumerateBusinessDates,
  isBusinessDate,
} from '../attendance/business-date.js';
import {
  ATTENDANCE_SUMMARY_RESOLVER,
  type AttendanceSummaryResolver,
} from '../time-punches/attendance-summary.port.js';

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
  UploadJustificationAttachmentDto,
} from './absence-justification.dto.js';
import {
  detectAttachmentMimeType,
  JustificationAttachmentStorageService,
  type AttachmentMimeType,
} from './justification-attachment-storage.service.js';
import {
  ABSENCE_JUSTIFICATION_INCLUDE,
  countDays,
  toAbsenceJustificationView,
  type AbsenceJustificationListViewDto,
  type AbsenceJustificationViewDto,
} from './absence-justification.view.js';

/** Longest atestado registered at once; longer leaves go through the INSS. */
export const MAX_JUSTIFIED_DAYS = 31;
/** Photos are reduced in the browser; PDFs of scanned atestados rarely exceed this. */
export const MAX_ATTACHMENT_BYTES = 7 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_JUSTIFICATION = 5;

/** Strict Base64 (optionally a data URL); anything else is rejected instead of guessed. */
export function decodeAttachmentBase64(value: string): Buffer | null {
  const base64 = value.replace(/^data:[\w/+.-]+;base64,/, '').replace(/\s+/g, '');
  if (base64.length === 0 || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    return null;
  }
  return Buffer.from(base64, 'base64');
}

/** Keeps the name readable but harmless in headers and on disk listings. */
export function sanitizeAttachmentFileName(name: string, mimeType: AttachmentMimeType): string {
  const extension =
    mimeType === 'application/pdf'
      ? 'pdf'
      : mimeType === 'image/png'
        ? 'png'
        : mimeType === 'image/webp'
          ? 'webp'
          : 'jpg';
  const withoutControls = Array.from(name.split(/[\\/]/).pop() ?? '', (char) => {
    const code = char.charCodeAt(0);
    return code < 32 || code === 127 ? ' ' : char;
  }).join('');
  const base = withoutControls
    .normalize('NFC')
    .replace(/[:*?"<>|]+/g, ' ')
    .replace(/\.[^.]*$/, '')
    .replace(/^[.\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150);
  return `${base || 'atestado'}.${extension}`;
}

const KIND_LABEL: Record<AbsenceJustificationKind, string> = {
  ALLOWANCE: 'abono',
  MEDICAL_CERTIFICATE: 'atestado',
};

function formatDate(date: Date): string {
  const [year, month, day] = databaseDateToBusinessDate(date).split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Only absences can be justified: a day without any punch, or a day with missing hours
 * (e.g. worked in the morning and left with an atestado). Returns why a day is refused.
 */
export function absenceJustificationBlocker(summary: DailyAttendanceSummary): string | null {
  if (summary.punchCount === 0 || summary.status === 'MISSING_HOURS') return null;
  const day = formatBusinessDate(summary.businessDate);
  if (!summary.isFinalized && summary.chronology.hasOpenInterval) {
    return `O colaborador ainda está trabalhando em ${day}. Justifique depois que ele registrar a saída.`;
  }
  if (summary.status === 'INCOMPLETE' || summary.chronology.isIncomplete) {
    return `O ponto de ${day} está incompleto. Corrija as batidas antes de justificar a falta.`;
  }
  return `Não há falta para justificar em ${day}: o colaborador bateu ponto e não tem horas faltando.`;
}

function formatBusinessDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

@Injectable()
export class AbsenceJustificationsService {
  public constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(JustificationAttachmentStorageService)
    private readonly attachments: JustificationAttachmentStorageService,
    @Inject(ATTENDANCE_SUMMARY_RESOLVER)
    private readonly attendance: AttendanceSummaryResolver,
  ) {}

  public async addAttachment(
    actor: AuthenticatedUser,
    justificationId: string,
    input: UploadJustificationAttachmentDto,
    context: ClientContext,
  ): Promise<AbsenceJustificationViewDto> {
    const contents = decodeAttachmentBase64(input.dataBase64);
    if (contents === null || contents.length === 0) {
      throw new BadRequestException({
        code: 'INVALID_ATTACHMENT',
        message: 'Não foi possível ler o arquivo enviado.',
      });
    }
    if (contents.length > MAX_ATTACHMENT_BYTES) {
      throw new BadRequestException({
        code: 'ATTACHMENT_TOO_LARGE',
        message: 'O arquivo pode ter no máximo 7 MB.',
      });
    }
    const mimeType = detectAttachmentMimeType(contents);
    if (mimeType === null) {
      throw new BadRequestException({
        code: 'UNSUPPORTED_ATTACHMENT_TYPE',
        message: 'Envie uma foto (JPG, PNG ou WebP) ou um PDF.',
      });
    }

    const justification = await this.prisma.absenceJustification.findUnique({
      where: { id: justificationId },
      select: { id: true, kind: true, revokedAt: true, employeeId: true },
    });
    if (justification === null) {
      throw new NotFoundException({
        code: 'JUSTIFICATION_NOT_FOUND',
        message: 'Justificativa não encontrada.',
      });
    }
    if (justification.kind !== AbsenceJustificationKind.MEDICAL_CERTIFICATE) {
      throw new BadRequestException({
        code: 'ATTACHMENT_ONLY_FOR_CERTIFICATES',
        message: 'Arquivos podem ser anexados apenas a atestados médicos.',
      });
    }
    if (justification.revokedAt !== null) {
      throw new ConflictException({
        code: 'JUSTIFICATION_ALREADY_REVOKED',
        message: 'Este atestado foi cancelado; não é possível anexar arquivos.',
      });
    }

    const fileName = sanitizeAttachmentFileName(input.fileName, mimeType);
    const stored = await this.attachments.save(contents, new Date());
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const count = await tx.absenceJustificationAttachment.count({
            where: { justificationId },
          });
          if (count >= MAX_ATTACHMENTS_PER_JUSTIFICATION) {
            throw new ConflictException({
              code: 'TOO_MANY_ATTACHMENTS',
              message: `Cada atestado aceita até ${MAX_ATTACHMENTS_PER_JUSTIFICATION} arquivos.`,
            });
          }
          await tx.absenceJustificationAttachment.create({
            data: {
              id: stored.id,
              justificationId,
              fileName,
              mimeType,
              byteSize: stored.byteSize,
              checksumSha256: stored.checksumSha256,
              storagePath: stored.storagePath,
              uploadedById: actor.id,
            },
          });
          await this.audit.record(
            {
              actorId: actor.id,
              action: AuditAction.ABSENCE_JUSTIFICATION_ATTACHMENT_ADDED,
              targetType: AuditTargetType.ABSENCE_JUSTIFICATION,
              targetId: justificationId,
              ...context,
              afterState: {
                employeeId: justification.employeeId,
                attachmentId: stored.id,
                fileName,
                mimeType,
                byteSize: stored.byteSize,
              },
            },
            tx,
          );
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      await this.attachments.discard(stored.storagePath);
      throw error;
    }

    const updated = await this.prisma.absenceJustification.findUniqueOrThrow({
      where: { id: justificationId },
      include: ABSENCE_JUSTIFICATION_INCLUDE,
    });
    return toAbsenceJustificationView(updated);
  }

  public async readAttachment(
    justificationId: string,
    attachmentId: string,
  ): Promise<{ contents: Buffer; mimeType: string; fileName: string }> {
    const attachment = await this.prisma.absenceJustificationAttachment.findFirst({
      where: { id: attachmentId, justificationId },
      select: { id: true, storagePath: true, checksumSha256: true, mimeType: true, fileName: true },
    });
    if (attachment === null) {
      throw new NotFoundException({
        code: 'ATTACHMENT_NOT_FOUND',
        message: 'Arquivo não encontrado.',
      });
    }
    const contents = await this.attachments.read(attachment);
    return { contents, mimeType: attachment.mimeType, fileName: attachment.fileName };
  }

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

        const evaluationInstant = new Date();
        for (const businessDate of enumerateBusinessDates(
          input.startDate,
          input.endDate,
          MAX_JUSTIFIED_DAYS,
        )) {
          const summary = await this.attendance.resolveDaily({
            employeeId: input.employeeId,
            businessDate,
            evaluationInstant,
            transaction: tx,
          });
          const blocker = absenceJustificationBlocker(summary);
          if (blocker !== null) {
            throw new BadRequestException({ code: 'DAY_NOT_ABSENT', message: blocker });
          }
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
