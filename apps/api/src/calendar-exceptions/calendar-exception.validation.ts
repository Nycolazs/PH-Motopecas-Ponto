import { BadRequestException } from '@nestjs/common';

import { CalendarExceptionKind } from '../generated/prisma/client.js';
import { validateBusinessHours } from '../schedules/business-hours.js';
import type { UpsertCalendarExceptionDto } from './calendar-exception.dto.js';

export interface NormalizedCalendarExceptionInput {
  businessDate: string;
  kind: CalendarExceptionKind;
  name: string;
  openingMinute: number | null;
  closingMinute: number | null;
  lunchEnabled: boolean;
  lunchStartMinute: number | null;
  lunchEndMinute: number | null;
}

function invalidException(message: string): BadRequestException {
  return new BadRequestException({ code: 'INVALID_CALENDAR_EXCEPTION', message });
}

export function normalizeAndValidateCalendarException(
  input: UpsertCalendarExceptionDto,
): NormalizedCalendarExceptionInput {
  if (
    typeof input.name !== 'string' ||
    input.name.trim().length < 1 ||
    input.name.trim().length > 120
  ) {
    throw invalidException('Informe um nome válido com até 120 caracteres.');
  }
  if (typeof input.lunchEnabled !== 'boolean') {
    throw invalidException('Informe se o intervalo de almoço está habilitado.');
  }

  const normalized = {
    businessDate: input.businessDate,
    kind: input.kind,
    name: input.name.trim(),
    openingMinute: input.openingMinute ?? null,
    closingMinute: input.closingMinute ?? null,
    lunchEnabled: input.lunchEnabled,
    lunchStartMinute: input.lunchStartMinute ?? null,
    lunchEndMinute: input.lunchEndMinute ?? null,
  };

  if (input.kind === CalendarExceptionKind.HOLIDAY || input.kind === CalendarExceptionKind.CLOSED) {
    if (
      normalized.openingMinute !== null ||
      normalized.closingMinute !== null ||
      normalized.lunchEnabled ||
      normalized.lunchStartMinute !== null ||
      normalized.lunchEndMinute !== null
    ) {
      throw invalidException('Feriados e fechamentos não podem informar horários de trabalho.');
    }
    return normalized;
  }

  if (
    validateBusinessHours({
      ...normalized,
      isOpen: true,
    }) !== null
  ) {
    throw invalidException('Os horários especiais informados são inválidos.');
  }

  return normalized;
}
