import { BadRequestException } from '@nestjs/common';

import { Weekday } from '../generated/prisma/client.js';
import { isBusinessDate } from './business-date.js';
import { validateBusinessHours, type BusinessHours } from './business-hours.js';

const ALL_WEEKDAYS = Object.freeze(Object.values(Weekday));
const WEEKDAY_LABELS: Record<Weekday, string> = {
  [Weekday.MONDAY]: 'segunda-feira',
  [Weekday.TUESDAY]: 'terça-feira',
  [Weekday.WEDNESDAY]: 'quarta-feira',
  [Weekday.THURSDAY]: 'quinta-feira',
  [Weekday.FRIDAY]: 'sexta-feira',
  [Weekday.SATURDAY]: 'sábado',
  [Weekday.SUNDAY]: 'domingo',
};

export interface ScheduleDayInput extends BusinessHours {
  weekday: Weekday;
}

function invalidSchedule(message: string): BadRequestException {
  return new BadRequestException({ code: 'INVALID_SCHEDULE', message });
}

export function assertBusinessDate(value: string): void {
  if (!isBusinessDate(value)) {
    throw new BadRequestException({
      code: 'INVALID_BUSINESS_DATE',
      message: 'Informe uma data válida no formato AAAA-MM-DD.',
    });
  }
}

export function assertValidScheduleDays(days: ScheduleDayInput[]): void {
  if (days.length !== ALL_WEEKDAYS.length) {
    throw invalidSchedule('O horário deve informar exatamente os sete dias da semana.');
  }

  const weekdays = new Set(days.map((day) => day.weekday));
  if (weekdays.size !== ALL_WEEKDAYS.length || ALL_WEEKDAYS.some((day) => !weekdays.has(day))) {
    throw invalidSchedule('Cada dia da semana deve ser informado uma única vez.');
  }

  for (const day of days) {
    if (validateBusinessHours(day) !== null) {
      throw invalidSchedule(`Os horários de ${WEEKDAY_LABELS[day.weekday]} são inválidos.`);
    }
  }
}
