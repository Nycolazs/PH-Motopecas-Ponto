import { BUSINESS_TIME_ZONE, DISPLAY_LOCALE } from '@ph-ponto/shared';

const timeFormatter = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
  timeZone: BUSINESS_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const dateTimeFormatter = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
  timeZone: BUSINESS_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function formatInstantTime(value: string | Date): string {
  return timeFormatter.format(typeof value === 'string' ? new Date(value) : value);
}

export function formatInstantDateTime(value: string | Date): string {
  return dateTimeFormatter.format(typeof value === 'string' ? new Date(value) : value);
}

export function formatDateBR(value: string | Date | null | undefined): string {
  if (!value) return '';
  if (typeof value === 'string') {
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (dateMatch && !value.includes('T')) {
      const parts = value.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return new Intl.DateTimeFormat(DISPLAY_LOCALE, {
        timeZone: BUSINESS_TIME_ZONE,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(date);
    }
  }
  if (value instanceof Date && !isNaN(value.getTime())) {
    return new Intl.DateTimeFormat(DISPLAY_LOCALE, {
      timeZone: BUSINESS_TIME_ZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(value);
  }
  return String(value);
}

export function formatDateTimeBR(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(DISPLAY_LOCALE, {
    timeZone: BUSINESS_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatMinutes(value: number | null, showPositiveSign = false): string {
  if (value === null) return '—';
  const absolute = Math.abs(value);
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;
  const sign = value < 0 ? '−' : showPositiveSign && value > 0 ? '+' : '';
  return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('pt-BR') ?? '')
    .join('');
}

const WEEKDAY_NAMES_SHORT: Record<number, string> = {
  0: 'Dom',
  1: 'Seg',
  2: 'Ter',
  3: 'Qua',
  4: 'Qui',
  5: 'Sex',
  6: 'Sáb',
};

export function getWeekdayShortBR(businessDateStr: string): string {
  const parts = businessDateStr.split('-');
  if (parts.length === 3) {
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return WEEKDAY_NAMES_SHORT[d.getDay()] ?? '';
  }
  return '';
}
