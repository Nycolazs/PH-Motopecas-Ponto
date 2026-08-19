import { BUSINESS_TIME_ZONE } from '../constants.js';
import { AttendanceConfigurationError, AttendanceInputError } from './errors.js';
import type { BusinessDateClassification, InstantInput, Weekday } from './types.js';

const BUSINESS_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const EXPLICIT_OFFSET_PATTERN = /(?:[zZ]|[+-]\d{2}:\d{2})$/;
const WEEKDAY_BY_UTC_DAY = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
] as const satisfies readonly Weekday[];

const businessDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

interface BusinessDateParts {
  year: number;
  month: number;
  day: number;
}

function parseBusinessDateParts(businessDate: string): BusinessDateParts {
  const match = BUSINESS_DATE_PATTERN.exec(businessDate);

  if (match === null) {
    throw new AttendanceConfigurationError(
      'INVALID_BUSINESS_DATE',
      `Invalid business date: ${businessDate}`,
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(0);
  candidate.setUTCHours(0, 0, 0, 0);
  candidate.setUTCFullYear(year, month - 1, day);

  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    throw new AttendanceConfigurationError(
      'INVALID_BUSINESS_DATE',
      `Invalid business date: ${businessDate}`,
    );
  }

  return { year, month, day };
}

function businessDateFromParts({ year, month, day }: BusinessDateParts): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function nextBusinessDate(businessDate: string): string {
  const { year, month, day } = parseBusinessDateParts(businessDate);
  const candidate = new Date(0);
  candidate.setUTCHours(0, 0, 0, 0);
  candidate.setUTCFullYear(year, month - 1, day + 1);

  return businessDateFromParts({
    year: candidate.getUTCFullYear(),
    month: candidate.getUTCMonth() + 1,
    day: candidate.getUTCDate(),
  });
}

function firstInstantOfBusinessDate(businessDate: string): Date {
  const parts = parseBusinessDateParts(businessDate);
  const guessUtc = Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0);
  let before = guessUtc - 36 * 60 * 60 * 1_000;
  let atOrAfter = guessUtc;

  while (atOrAfter - before > 1) {
    const candidate = before + Math.floor((atOrAfter - before) / 2);
    const candidateBusinessDate = businessDateFormatter.format(new Date(candidate));

    if (candidateBusinessDate < businessDate) {
      before = candidate;
    } else {
      atOrAfter = candidate;
    }
  }

  return new Date(atOrAfter);
}

export function assertBusinessDate(businessDate: string): void {
  parseBusinessDateParts(businessDate);
}

export function instantToDate(instant: InstantInput): Date {
  if (typeof instant === 'string' && !EXPLICIT_OFFSET_PATTERN.test(instant)) {
    throw new AttendanceInputError(
      'INVALID_INSTANT',
      'String instants must include an explicit UTC or numeric offset.',
    );
  }

  const parsed = instant instanceof Date ? new Date(instant.getTime()) : new Date(instant);

  if (!Number.isFinite(parsed.getTime())) {
    throw new AttendanceInputError('INVALID_INSTANT', 'The attendance instant is invalid.');
  }

  return parsed;
}

export function businessDateFromInstant(instant: InstantInput): string {
  return businessDateFormatter.format(instantToDate(instant));
}

export function instantRangeForBusinessDate(businessDate: string): {
  start: Date;
  endExclusive: Date;
} {
  assertBusinessDate(businessDate);
  const followingDate = nextBusinessDate(businessDate);

  return {
    start: firstInstantOfBusinessDate(businessDate),
    endExclusive: firstInstantOfBusinessDate(followingDate),
  };
}

export function classifyBusinessDate(
  businessDate: string,
  evaluationInstant: InstantInput,
): BusinessDateClassification {
  assertBusinessDate(businessDate);
  const evaluationDate = businessDateFromInstant(evaluationInstant);

  if (businessDate < evaluationDate) {
    return 'FINALIZED';
  }

  if (businessDate > evaluationDate) {
    return 'FUTURE';
  }

  return 'CURRENT';
}

export function weekdayForBusinessDate(businessDate: string): Weekday {
  const { year, month, day } = parseBusinessDateParts(businessDate);
  const candidate = new Date(0);
  candidate.setUTCHours(0, 0, 0, 0);
  candidate.setUTCFullYear(year, month - 1, day);

  const weekday = WEEKDAY_BY_UTC_DAY[candidate.getUTCDay()];
  if (weekday === undefined) {
    throw new AttendanceConfigurationError(
      'INVALID_BUSINESS_DATE',
      `Could not resolve weekday for ${businessDate}`,
    );
  }

  return weekday;
}

export function compareBusinessDates(left: string, right: string): number {
  assertBusinessDate(left);
  assertBusinessDate(right);
  return left.localeCompare(right);
}
