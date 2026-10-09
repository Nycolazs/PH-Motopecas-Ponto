import { BUSINESS_TIME_ZONE, type LocalWorkHours } from '@ph-ponto/shared';

export const DEFAULT_LATE_TOLERANCE_MINUTES = 5;
export const MIN_LATE_TOLERANCE_MINUTES = 0;
export const MAX_LATE_TOLERANCE_MINUTES = 120;

export interface LateArrival {
  scheduledMinute: number;
  clockInMinute: number;
  minutesLate: number;
}

const minuteFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: BUSINESS_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Minute of the business day (0-1439) for an instant, in the business time zone. */
export function businessMinuteOfDay(instant: Date): number {
  const parts = minuteFormatter.formatToParts(instant);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

/**
 * A first clock-in is late when it happens more than `toleranceMinutes` after the
 * scheduled opening of an open business day (weekly schedule or special hours).
 */
export function evaluateLateArrival(input: {
  expectation: Pick<LocalWorkHours, 'isOpen' | 'openingMinute'>;
  clockInAt: Date;
  toleranceMinutes: number;
}): LateArrival | null {
  const { expectation, clockInAt, toleranceMinutes } = input;
  if (!expectation.isOpen || expectation.openingMinute === null) return null;
  const clockInMinute = businessMinuteOfDay(clockInAt);
  const minutesLate = clockInMinute - expectation.openingMinute;
  if (minutesLate <= toleranceMinutes) return null;
  return { scheduledMinute: expectation.openingMinute, clockInMinute, minutesLate };
}

export function formatMinuteOfDay(minute: number): string {
  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function formatLateDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}min`;
}

function formatBusinessDate(businessDate: string): string {
  const [year, month, day] = businessDate.split('-');
  return `${day}/${month}/${year}`;
}

export function displayName(rawName: string): string {
  const lowerWords = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
  return rawName
    .trim()
    .toLocaleLowerCase('pt-BR')
    .split(/\s+/)
    .map((word, index) =>
      index > 0 && lowerWords.has(word)
        ? word
        : word.charAt(0).toLocaleUpperCase('pt-BR') + word.slice(1),
    )
    .join(' ');
}

export function buildLateArrivalMessage(input: {
  employeeName: string;
  businessDate: string;
  lateArrival: LateArrival;
}): string {
  const { lateArrival } = input;
  return [
    '⏰ *PH-Ponto — Entrada com atraso*',
    '',
    `*Colaborador:* ${displayName(input.employeeName)}`,
    `*Entrada:* ${formatMinuteOfDay(lateArrival.clockInMinute)} (previsto ${formatMinuteOfDay(lateArrival.scheduledMinute)})`,
    `*Atraso:* ${formatLateDuration(lateArrival.minutesLate)}`,
    `*Data:* ${formatBusinessDate(input.businessDate)}`,
  ].join('\n');
}

/** Normalizes a Brazilian or international phone to digits with country code. */
export function normalizeWhatsappPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.length >= 12 && digits.length <= 15) return digits;
  return null;
}
