import { assertBusinessDate, weekdayForBusinessDate } from '../attendance/dates.js';
import { WEEKDAYS, type Weekday } from '../attendance/types.js';

/** One worked period of a day, in minutes after local midnight. */
export interface Shift {
  startMinute: number;
  endMinute: number;
  /** Lunch/rest interval inside the shift; not paid, not counted as worked. */
  breakStartMinute: number | null;
  breakEndMinute: number | null;
}

/** A week of the pattern: a shift, or `null` for a rest day (folga). */
export type PatternWeek = Readonly<Record<Weekday, Shift | null>>;

/**
 * An employee's schedule (escala). `weeks` repeats as a cycle: one week for a fixed day off,
 * two or more weeks for a rotating day off (e.g. Saturday off every other week).
 */
export interface WorkPattern {
  weeks: readonly PatternWeek[];
  /** A Monday on which cycle week 0 starts; any Monday of that week works as an anchor. */
  cycleAnchorDate: string;
}

export type OverrideReason = 'SWAP' | 'ADJUSTMENT';

/** A change for one date only: a swap with a colleague or a one-off adjustment. */
export interface ScheduleOverride {
  businessDate: string;
  shift: Shift | null;
  reason: OverrideReason;
  /** Groups both sides of a swap. */
  swapId?: string;
}

export interface PlannedDay {
  businessDate: string;
  weekday: Weekday;
  shift: Shift | null;
  /** Worked minutes (shift minus break). */
  plannedMinutes: number;
  source: 'PATTERN' | 'OVERRIDE';
  cycleWeek: number;
  override: ScheduleOverride | null;
}

export const MAX_CYCLE_WEEKS = 4;

export function shiftMinutes(shift: Shift | null): number {
  if (shift === null) return 0;
  const total = shift.endMinute - shift.startMinute;
  const pause =
    shift.breakStartMinute !== null && shift.breakEndMinute !== null
      ? shift.breakEndMinute - shift.breakStartMinute
      : 0;
  return total - pause;
}

export function breakMinutes(shift: Shift): number {
  return shift.breakStartMinute !== null && shift.breakEndMinute !== null
    ? shift.breakEndMinute - shift.breakStartMinute
    : 0;
}

/** Throws when a shift is impossible (outside the day, inverted, break outside the shift). */
export function assertValidShift(shift: Shift): void {
  const { startMinute, endMinute, breakStartMinute, breakEndMinute } = shift;
  const inDay = (minute: number) => Number.isInteger(minute) && minute >= 0 && minute <= 1440;
  if (!inDay(startMinute) || !inDay(endMinute) || startMinute >= endMinute) {
    throw new Error('Shift start must be before its end, within the day.');
  }
  if ((breakStartMinute === null) !== (breakEndMinute === null)) {
    throw new Error('A break needs both start and end.');
  }
  if (breakStartMinute !== null && breakEndMinute !== null) {
    if (
      breakStartMinute <= startMinute ||
      breakEndMinute >= endMinute ||
      breakStartMinute >= breakEndMinute
    ) {
      throw new Error('The break must be inside the shift.');
    }
  }
}

export function assertValidPattern(pattern: WorkPattern): void {
  assertBusinessDate(pattern.cycleAnchorDate);
  if (pattern.weeks.length < 1 || pattern.weeks.length > MAX_CYCLE_WEEKS) {
    throw new Error(`A schedule cycle has 1 to ${MAX_CYCLE_WEEKS} weeks.`);
  }
  for (const week of pattern.weeks) {
    for (const weekday of WEEKDAYS) {
      const shift = week[weekday];
      if (shift !== null) assertValidShift(shift);
    }
  }
}

const DAY_MS = 86_400_000;

function toUtcMs(date: string): number {
  assertBusinessDate(date);
  return Date.parse(`${date}T00:00:00Z`);
}

export function addDays(date: string, days: number): string {
  return new Date(toUtcMs(date) + days * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}

/** Monday of the week containing `date` (weeks run Monday–Sunday). */
export function mondayOf(date: string): string {
  const index = WEEKDAYS.indexOf(weekdayForBusinessDate(date));
  return addDays(date, -index);
}

export function enumerateDates(from: string, to: string): string[] {
  const count = daysBetween(from, to);
  if (count < 0) throw new Error('The end date is before the start date.');
  return Array.from({ length: count + 1 }, (_, index) => addDays(from, index));
}

/** Cycle week (0-based) that a date falls into. */
export function cycleWeekFor(pattern: WorkPattern, date: string): number {
  const weeks = Math.floor(daysBetween(mondayOf(pattern.cycleAnchorDate), mondayOf(date)) / 7);
  const length = pattern.weeks.length;
  return ((weeks % length) + length) % length;
}

/** The planned day for one date: an override wins over the pattern. */
export function planDay(
  pattern: WorkPattern,
  overrides: readonly ScheduleOverride[],
  businessDate: string,
): PlannedDay {
  const weekday = weekdayForBusinessDate(businessDate);
  const cycleWeek = cycleWeekFor(pattern, businessDate);
  const override = overrides.find((item) => item.businessDate === businessDate) ?? null;
  const shift = override !== null ? override.shift : (pattern.weeks[cycleWeek]?.[weekday] ?? null);
  return {
    businessDate,
    weekday,
    shift,
    plannedMinutes: shiftMinutes(shift),
    source: override !== null ? 'OVERRIDE' : 'PATTERN',
    cycleWeek,
    override,
  };
}

export function planRange(
  pattern: WorkPattern,
  overrides: readonly ScheduleOverride[],
  from: string,
  to: string,
): PlannedDay[] {
  assertValidPattern(pattern);
  return enumerateDates(from, to).map((date) => planDay(pattern, overrides, date));
}

/** Convenience: "HH:MM" → minutes. */
export function timeToMinute(value: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (match === null) throw new Error(`Invalid time "${value}".`);
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Convenience to build shifts in tests and presets: shift('08:00', '17:00', '12:00', '13:00'). */
export function shift(start: string, end: string, breakStart?: string, breakEnd?: string): Shift {
  return {
    startMinute: timeToMinute(start),
    endMinute: timeToMinute(end),
    breakStartMinute: breakStart === undefined ? null : timeToMinute(breakStart),
    breakEndMinute: breakEnd === undefined ? null : timeToMinute(breakEnd),
  };
}
