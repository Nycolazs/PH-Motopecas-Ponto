import { describe, expect, it } from 'vitest';

import type { ResolvedExpectation, Weekday } from '../../src/attendance/types.js';
import {
  applyEmployeeScheduleLayer,
  planEmployeeDay,
  type EmployeeScheduleDayInput,
  type EmployeeScheduleOverrideInput,
  type EmployeeScheduleVersionInput,
} from '../../src/scheduling/employee-layer.js';

const WORK = { startMinute: 480, endMinute: 1020, breakStartMinute: 720, breakEndMinute: 780 };

function week(cycleWeek: number, offDays: Weekday[]): EmployeeScheduleDayInput[] {
  const all: Weekday[] = [
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
    'SUNDAY',
  ];
  return all.map((weekday) =>
    offDays.includes(weekday)
      ? {
          cycleWeek,
          weekday,
          isWorkday: false,
          startMinute: null,
          endMinute: null,
          breakStartMinute: null,
          breakEndMinute: null,
        }
      : { cycleWeek, weekday, isWorkday: true, ...WORK },
  );
}

function version(
  id: string,
  effectiveDate: string,
  days: EmployeeScheduleDayInput[],
  cycleWeeks = 1,
  usesCompanySchedule = false,
): EmployeeScheduleVersionInput {
  return {
    id,
    effectiveDate,
    usesCompanySchedule,
    cycleWeeks,
    cycleAnchorDate: '2026-12-14',
    days,
  };
}

function company(overrides: Partial<ResolvedExpectation> = {}): ResolvedExpectation {
  return {
    businessDate: '2026-12-16',
    source: 'WEEKLY_SCHEDULE',
    calendarStatus: null,
    expectedMinutes: 480,
    isOpen: true,
    openingMinute: 480,
    closingMinute: 1020,
    lunchEnabled: true,
    lunchStartMinute: 720,
    lunchEndMinute: 780,
    scheduleVersionId: 'company-v1',
    scheduleEffectiveDate: '2026-01-01',
    exceptionRevisionId: null,
    exceptionName: null,
    ...overrides,
  };
}

describe('planEmployeeDay', () => {
  const fixed = version('v1', '2026-12-14', week(0, ['WEDNESDAY', 'SUNDAY']));

  it('returns null (company schedule) before the first version', () => {
    expect(planEmployeeDay([fixed], [], '2026-12-13')).toBeNull();
  });

  it('plans a rest day and a workday from a fixed weekly pattern', () => {
    expect(planEmployeeDay([fixed], [], '2026-12-16')?.shift).toBeNull(); // Wednesday
    const thursday = planEmployeeDay([fixed], [], '2026-12-17');
    expect(thursday?.plannedMinutes).toBe(480);
    expect(thursday?.source).toBe('EMPLOYEE_SCHEDULE');
  });

  it('rotates a two-week cycle from the anchor Monday', () => {
    const rotating = version(
      'v2',
      '2026-12-14',
      [...week(0, ['SATURDAY', 'SUNDAY']), ...week(1, ['MONDAY', 'SUNDAY'])],
      2,
    );
    expect(planEmployeeDay([rotating], [], '2026-12-19')?.shift).toBeNull(); // Sat week 0
    expect(planEmployeeDay([rotating], [], '2026-12-21')?.shift).toBeNull(); // Mon week 1
    expect(planEmployeeDay([rotating], [], '2026-12-26')?.plannedMinutes).toBe(480); // Sat week 1
    expect(planEmployeeDay([rotating], [], '2026-12-28')?.plannedMinutes).toBe(480); // Mon week 0
  });

  it('uses the newest version effective on the date and can return to the company schedule', () => {
    const back = version('v3', '2027-01-04', [], 1, true);
    expect(planEmployeeDay([fixed, back], [], '2026-12-30')?.shift).toBeNull();
    expect(planEmployeeDay([fixed, back], [], '2027-01-06')).toBeNull();
  });

  it('lets a one-day override win, even without an escala', () => {
    const swap: EmployeeScheduleOverrideInput = {
      id: 'o1',
      businessDate: '2026-12-16',
      isWorkday: true,
      ...WORK,
      reason: 'SWAP',
      note: null,
    };
    const plan = planEmployeeDay([fixed], [swap], '2026-12-16');
    expect(plan?.source).toBe('SCHEDULE_OVERRIDE');
    expect(plan?.plannedMinutes).toBe(480);
    expect(plan?.label).toBe('Troca de folga');
    expect(planEmployeeDay([], [{ ...swap, isWorkday: false }], '2026-12-16')?.shift).toBeNull();
  });
});

describe('applyEmployeeScheduleLayer', () => {
  const restPlan = {
    businessDate: '2026-12-16',
    shift: null,
    plannedMinutes: 0,
    source: 'EMPLOYEE_SCHEDULE' as const,
    versionId: 'v1',
    overrideId: null,
    label: null,
  };
  const shortPlan = {
    ...restPlan,
    shift: { startMinute: 600, endMinute: 900, breakStartMinute: null, breakEndMinute: null },
    plannedMinutes: 300,
  };

  it('keeps the company expectation without a plan', () => {
    expect(applyEmployeeScheduleLayer(company(), null)).toEqual(company());
  });

  it('turns a planned rest day into a day off with zero expected minutes', () => {
    const result = applyEmployeeScheduleLayer(company(), restPlan);
    expect(result).toMatchObject({
      source: 'EMPLOYEE_SCHEDULE',
      calendarStatus: 'DAY_OFF',
      expectedMinutes: 0,
      isOpen: false,
      exceptionName: 'Folga',
    });
  });

  it('uses the person shift on a regular day', () => {
    const result = applyEmployeeScheduleLayer(company(), shortPlan);
    expect(result).toMatchObject({
      expectedMinutes: 300,
      openingMinute: 600,
      closingMinute: 900,
      lunchEnabled: false,
      lunchStartMinute: null,
    });
  });

  it('never overrides a holiday, a closure or a vacation', () => {
    for (const source of ['HOLIDAY', 'CLOSED', 'VACATION'] as const) {
      const base = company({ source, expectedMinutes: 0, isOpen: false });
      expect(applyEmployeeScheduleLayer(base, shortPlan)).toEqual(base);
    }
  });

  it('keeps special store hours for people who work, and the folga for who does not', () => {
    const special = company({ source: 'SPECIAL_HOURS', expectedMinutes: 240, closingMinute: 720 });
    expect(applyEmployeeScheduleLayer(special, shortPlan)).toEqual(special);
    expect(applyEmployeeScheduleLayer(special, restPlan).expectedMinutes).toBe(0);
  });
});
