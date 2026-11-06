import { compareBusinessDates } from '../attendance/dates.js';
import type { ResolvedExpectation, Weekday } from '../attendance/types.js';
import {
  planDay,
  shiftMinutes,
  type PatternWeek,
  type Shift,
  type WorkPattern,
} from './patterns.js';

/**
 * The employee layer of the expectation (escala do colaborador), applied on top of the
 * company schedule and its calendar exceptions:
 *
 *   company schedule → employee escala (version effective on the date) → one-day override
 *     → holiday/closed (zero for everybody) → special hours (only if the person works)
 *     → vacation → abono/atestado
 *
 * Employees without an escala keep the company schedule, so the feature can be switched on
 * one person at a time. A version flagged `usesCompanySchedule` returns the person to the
 * company schedule from its effective date on.
 */

export interface EmployeeScheduleDayInput {
  cycleWeek: number;
  weekday: Weekday;
  isWorkday: boolean;
  startMinute: number | null;
  endMinute: number | null;
  breakStartMinute: number | null;
  breakEndMinute: number | null;
}

export interface EmployeeScheduleVersionInput {
  id: string;
  effectiveDate: string;
  usesCompanySchedule: boolean;
  cycleWeeks: number;
  cycleAnchorDate: string;
  days: readonly EmployeeScheduleDayInput[];
}

export interface EmployeeScheduleOverrideInput {
  id: string;
  businessDate: string;
  isWorkday: boolean;
  startMinute: number | null;
  endMinute: number | null;
  breakStartMinute: number | null;
  breakEndMinute: number | null;
  reason: 'SWAP' | 'ADJUSTMENT';
  note: string | null;
}

export interface EmployeeDayPlan {
  businessDate: string;
  shift: Shift | null;
  plannedMinutes: number;
  source: 'EMPLOYEE_SCHEDULE' | 'SCHEDULE_OVERRIDE';
  versionId: string | null;
  overrideId: string | null;
  label: string | null;
}

function dayShift(day: {
  isWorkday: boolean;
  startMinute: number | null;
  endMinute: number | null;
  breakStartMinute: number | null;
  breakEndMinute: number | null;
}): Shift | null {
  if (!day.isWorkday || day.startMinute === null || day.endMinute === null) return null;
  return {
    startMinute: day.startMinute,
    endMinute: day.endMinute,
    breakStartMinute: day.breakStartMinute,
    breakEndMinute: day.breakEndMinute,
  };
}

/** Converts stored rows into the engine's pattern (missing rows are rest days). */
export function versionToPattern(version: EmployeeScheduleVersionInput): WorkPattern {
  const weeks: PatternWeek[] = [];
  for (let week = 0; week < version.cycleWeeks; week += 1) {
    const entry: Record<Weekday, Shift | null> = {
      MONDAY: null,
      TUESDAY: null,
      WEDNESDAY: null,
      THURSDAY: null,
      FRIDAY: null,
      SATURDAY: null,
      SUNDAY: null,
    };
    for (const day of version.days) {
      if (day.cycleWeek === week) entry[day.weekday] = dayShift(day);
    }
    weeks.push(entry);
  }
  return { weeks, cycleAnchorDate: version.cycleAnchorDate };
}

/** Latest version whose effective date is on or before the date. */
export function selectEmployeeScheduleVersion(
  versions: readonly EmployeeScheduleVersionInput[],
  businessDate: string,
): EmployeeScheduleVersionInput | null {
  let selected: EmployeeScheduleVersionInput | null = null;
  for (const version of versions) {
    if (
      compareBusinessDates(version.effectiveDate, businessDate) <= 0 &&
      (selected === null || compareBusinessDates(version.effectiveDate, selected.effectiveDate) > 0)
    ) {
      selected = version;
    }
  }
  return selected;
}

/**
 * The employee's own plan for a date, or `null` when the company schedule applies.
 * An active override for the date always wins (also for people without an escala).
 */
export function planEmployeeDay(
  versions: readonly EmployeeScheduleVersionInput[],
  overrides: readonly EmployeeScheduleOverrideInput[],
  businessDate: string,
): EmployeeDayPlan | null {
  const override = overrides.find((item) => item.businessDate === businessDate);
  const version = selectEmployeeScheduleVersion(versions, businessDate);

  if (override !== undefined) {
    const shift = dayShift(override);
    return {
      businessDate,
      shift,
      plannedMinutes: shiftMinutes(shift),
      source: 'SCHEDULE_OVERRIDE',
      versionId: version?.id ?? null,
      overrideId: override.id,
      label: override.reason === 'SWAP' ? 'Troca de folga' : 'Ajuste de escala',
    };
  }

  if (version === null || version.usesCompanySchedule) return null;

  const planned = planDay(versionToPattern(version), [], businessDate);
  return {
    businessDate,
    shift: planned.shift,
    plannedMinutes: planned.plannedMinutes,
    source: 'EMPLOYEE_SCHEDULE',
    versionId: version.id,
    overrideId: null,
    label: null,
  };
}

/**
 * Applies the employee plan to an expectation already resolved for the company (weekly
 * schedule + calendar exception + vacation). Holidays, closures and vacations keep priority;
 * special store hours apply only when the person is scheduled to work that day.
 */
export function applyEmployeeScheduleLayer(
  expectation: ResolvedExpectation,
  plan: EmployeeDayPlan | null,
): ResolvedExpectation {
  if (plan === null) return expectation;
  if (
    expectation.source === 'HOLIDAY' ||
    expectation.source === 'CLOSED' ||
    expectation.source === 'VACATION'
  ) {
    return expectation;
  }

  const { shift } = plan;
  if (shift === null) {
    return {
      ...expectation,
      source: plan.source,
      calendarStatus: 'DAY_OFF',
      expectedMinutes: 0,
      isOpen: false,
      openingMinute: null,
      closingMinute: null,
      lunchEnabled: false,
      lunchStartMinute: null,
      lunchEndMinute: null,
      exceptionName: plan.label ?? 'Folga',
    };
  }

  if (expectation.source === 'SPECIAL_HOURS') {
    // The store runs special hours that day and the person works: keep the store's hours.
    return expectation;
  }

  const hasBreak = shift.breakStartMinute !== null && shift.breakEndMinute !== null;
  return {
    ...expectation,
    source: plan.source,
    calendarStatus: null,
    expectedMinutes: plan.plannedMinutes,
    isOpen: true,
    openingMinute: shift.startMinute,
    closingMinute: shift.endMinute,
    lunchEnabled: hasBreak,
    lunchStartMinute: hasBreak ? shift.breakStartMinute : null,
    lunchEndMinute: hasBreak ? shift.breakEndMinute : null,
    exceptionName: plan.label,
  };
}
