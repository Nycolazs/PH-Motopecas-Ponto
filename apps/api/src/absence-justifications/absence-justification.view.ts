import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { AbsenceJustificationKind } from '../generated/prisma/client.js';
import { databaseDateToBusinessDate } from '../schedules/business-date.js';

export class AbsenceJustificationPersonViewDto {
  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiProperty()
  public name!: string;

  @ApiProperty()
  public login!: string;
}

export class AbsenceJustificationAttachmentViewDto {
  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiProperty({ example: 'atestado.jpg' })
  public fileName!: string;

  @ApiProperty({ enum: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] })
  public mimeType!: string;

  @ApiProperty({ example: 845_120 })
  public byteSize!: number;

  @ApiProperty({ format: 'date-time' })
  public createdAt!: string;

  @ApiProperty({ type: AbsenceJustificationPersonViewDto })
  public uploadedBy!: AbsenceJustificationPersonViewDto;
}

export class AbsenceJustificationViewDto {
  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiProperty({ type: AbsenceJustificationPersonViewDto })
  public employee!: AbsenceJustificationPersonViewDto;

  @ApiProperty({ enum: AbsenceJustificationKind })
  public kind!: AbsenceJustificationKind;

  @ApiProperty({ example: '2026-10-28' })
  public startDate!: string;

  @ApiProperty({ example: '2026-10-29' })
  public endDate!: string;

  @ApiProperty({ example: 2 })
  public daysCount!: number;

  @ApiProperty()
  public reason!: string;

  @ApiProperty({ type: AbsenceJustificationPersonViewDto })
  public createdBy!: AbsenceJustificationPersonViewDto;

  @ApiProperty({ format: 'date-time' })
  public createdAt!: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  public revokedAt!: string | null;

  @ApiPropertyOptional({ type: AbsenceJustificationPersonViewDto, nullable: true })
  public revokedBy!: AbsenceJustificationPersonViewDto | null;

  @ApiPropertyOptional({ nullable: true })
  public revokeReason!: string | null;

  @ApiProperty({ type: [AbsenceJustificationAttachmentViewDto] })
  public attachments!: AbsenceJustificationAttachmentViewDto[];
}

export class AbsenceJustificationListViewDto {
  @ApiProperty({ type: [AbsenceJustificationViewDto] })
  public items!: AbsenceJustificationViewDto[];
}

interface Person {
  id: string;
  name: string;
  login: string;
}

export interface AbsenceJustificationEntity {
  id: string;
  kind: AbsenceJustificationKind;
  startDate: Date;
  endDate: Date;
  reason: string;
  createdAt: Date;
  revokedAt: Date | null;
  revokeReason: string | null;
  employee: Person;
  createdBy: Person;
  revokedBy: Person | null;
  attachments: {
    id: string;
    fileName: string;
    mimeType: string;
    byteSize: number;
    createdAt: Date;
    uploadedBy: Person;
  }[];
}

export const ABSENCE_JUSTIFICATION_INCLUDE = {
  employee: { select: { id: true, name: true, login: true } },
  createdBy: { select: { id: true, name: true, login: true } },
  revokedBy: { select: { id: true, name: true, login: true } },
  attachments: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      byteSize: true,
      createdAt: true,
      uploadedBy: { select: { id: true, name: true, login: true } },
    },
  },
} as const;

export function countDays(startDate: string, endDate: string): number {
  return (
    Math.round(
      (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000,
    ) + 1
  );
}

export function toAbsenceJustificationView(
  entity: AbsenceJustificationEntity,
): AbsenceJustificationViewDto {
  const startDate = databaseDateToBusinessDate(entity.startDate);
  const endDate = databaseDateToBusinessDate(entity.endDate);
  return {
    id: entity.id,
    employee: entity.employee,
    kind: entity.kind,
    startDate,
    endDate,
    daysCount: countDays(startDate, endDate),
    reason: entity.reason,
    createdBy: entity.createdBy,
    createdAt: entity.createdAt.toISOString(),
    revokedAt: entity.revokedAt?.toISOString() ?? null,
    revokedBy: entity.revokedBy,
    revokeReason: entity.revokeReason,
    attachments: entity.attachments.map((attachment) => ({
      ...attachment,
      createdAt: attachment.createdAt.toISOString(),
    })),
  };
}
