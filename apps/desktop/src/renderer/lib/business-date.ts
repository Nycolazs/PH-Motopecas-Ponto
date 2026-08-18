import { BUSINESS_TIME_ZONE, DISPLAY_LOCALE } from '@ph-ponto/shared';

export type HistoryPreset = 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'PREVIOUS_MONTH' | 'CUSTOM';

export interface DateRange {
  from: string;
  to: string;
}

const businessDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const displayDateFormatter = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
  timeZone: 'UTC',
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export function businessDateFromInstant(instant = new Date()): string {
  const parts = Object.fromEntries(
    businessDateFormatter
      .formatToParts(instant)
      .filter(({ type }) => type === 'year' || type === 'month' || type === 'day')
      .map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function parseBusinessDate(value: string): [year: number, month: number, day: number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) throw new RangeError('Invalid business date.');
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function addBusinessDays(value: string, amount: number): string {
  const [year, month, day] = parseBusinessDate(value);
  const result = new Date(Date.UTC(year, month - 1, day + amount, 12));
  return result.toISOString().slice(0, 10);
}

export function formatBusinessDate(value: string): string {
  const [year, month, day] = parseBusinessDate(value);
  return displayDateFormatter.format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export function formatBusinessDateNumeric(value: string): string {
  const [year, month, day] = parseBusinessDate(value);
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

export function currentBusinessMonth(instant = new Date()): string {
  return businessDateFromInstant(instant).slice(0, 7);
}

export function resolveHistoryRange(
  preset: Exclude<HistoryPreset, 'CUSTOM'>,
  instant = new Date(),
): DateRange {
  const today = businessDateFromInstant(instant);
  const [year, month, day] = parseBusinessDate(today);

  if (preset === 'TODAY') return { from: today, to: today };
  if (preset === 'THIS_MONTH') return { from: `${today.slice(0, 7)}-01`, to: today };
  if (preset === 'PREVIOUS_MONTH') {
    const firstThisMonth = new Date(Date.UTC(year, month - 1, 1, 12));
    const lastPreviousMonth = new Date(firstThisMonth.getTime() - 86_400_000);
    const previousYear = lastPreviousMonth.getUTCFullYear();
    const previousMonth = String(lastPreviousMonth.getUTCMonth() + 1).padStart(2, '0');
    return {
      from: `${previousYear}-${previousMonth}-01`,
      to: lastPreviousMonth.toISOString().slice(0, 10),
    };
  }

  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  return { from: addBusinessDays(today, mondayOffset), to: today };
}
