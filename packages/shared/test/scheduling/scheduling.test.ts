import { describe, expect, it } from 'vitest';

import {
  checkCompliance,
  coverageFor,
  effectiveLimits,
  patternWeeksFor,
  planRange,
  regimeForDate,
  shift,
  simulateSwap,
  suggestRestDays,
  type PatternWeek,
  type Shift,
  type Weekday,
  type WorkPattern,
} from '../../src/index.js';

// PH Motopeças today: Mon–Fri 08–17 with lunch, Saturday 08–12, closed on Sunday.
const WEEKDAY_44 = shift('08:00', '17:48', '12:00', '13:00'); // 8h48 (Saturday compensation)
const WEEKDAY_8H = shift('08:00', '17:00', '12:00', '13:00');
const WEEKDAY_8H24 = shift('08:00', '17:24', '12:00', '13:00');
const SATURDAY = shift('08:00', '12:00');

function week(days: Partial<Record<Weekday, Shift | null>>): PatternWeek {
  return {
    MONDAY: null,
    TUESDAY: null,
    WEDNESDAY: null,
    THURSDAY: null,
    FRIDAY: null,
    SATURDAY: null,
    SUNDAY: null,
    ...days,
  };
}

const ANCHOR = '2026-12-14'; // a Monday
const NO_AGREEMENT = { hasCollectiveAgreement: false, sundayRestEveryWeeks: 3 };
const WITH_AGREEMENT = { hasCollectiveAgreement: true, sundayRestEveryWeeks: 3 };

describe('legal regimes (EC 141)', () => {
  it('moves from 44 h to 42 h and then 40 h', () => {
    expect(regimeForDate('2026-12-14').id).toBe('CLT_44H');
    expect(regimeForDate('2026-12-15').id).toBe('EC141_42H');
    expect(regimeForDate('2027-12-15').id).toBe('EC141_40H');
  });

  it('only reaches 42 h with a collective agreement', () => {
    expect(effectiveLimits('2027-01-10', { hasCollectiveAgreement: false })).toMatchObject({
      dailyLimitMinutes: 480,
      weeklyLimitMinutes: 40 * 60,
      minRestDaysPerWeek: 2,
    });
    expect(effectiveLimits('2027-01-10', { hasCollectiveAgreement: true })).toMatchObject({
      dailyLimitMinutes: 504,
      weeklyLimitMinutes: 42 * 60,
    });
    expect(effectiveLimits('2028-01-10', { hasCollectiveAgreement: true }).weeklyLimitMinutes).toBe(
      2400,
    );
  });
});

describe('employee schedules', () => {
  it('repeats a rotating cycle from its anchor week', () => {
    const pattern: WorkPattern = {
      cycleAnchorDate: ANCHOR,
      weeks: [
        week({
          MONDAY: WEEKDAY_8H,
          TUESDAY: WEEKDAY_8H,
          WEDNESDAY: WEEKDAY_8H,
          THURSDAY: WEEKDAY_8H,
          FRIDAY: WEEKDAY_8H,
        }),
        week({
          TUESDAY: WEEKDAY_8H,
          WEDNESDAY: WEEKDAY_8H,
          THURSDAY: WEEKDAY_8H,
          FRIDAY: WEEKDAY_8H,
          SATURDAY: SATURDAY,
        }),
      ],
    };
    const days = planRange(pattern, [], '2026-12-14', '2026-12-27');
    expect(days.filter((day) => day.shift).map((day) => day.businessDate)).toEqual([
      '2026-12-14',
      '2026-12-15',
      '2026-12-16',
      '2026-12-17',
      '2026-12-18',
      '2026-12-22',
      '2026-12-23',
      '2026-12-24',
      '2026-12-25',
      '2026-12-26',
    ]);
    expect(days[7]).toMatchObject({ businessDate: '2026-12-21', cycleWeek: 1, shift: null });
    expect(planRange(pattern, [], '2027-01-04', '2027-01-04')[0]?.cycleWeek).toBe(1);
  });

  it('applies a one-day override over the pattern', () => {
    const pattern: WorkPattern = { cycleAnchorDate: ANCHOR, weeks: [week({ MONDAY: WEEKDAY_8H })] };
    const [day] = planRange(
      pattern,
      [{ businessDate: '2026-12-14', shift: null, reason: 'ADJUSTMENT' }],
      '2026-12-14',
      '2026-12-14',
    );
    expect(day).toMatchObject({ shift: null, source: 'OVERRIDE', plannedMinutes: 0 });
  });
});

describe('compliance checks', () => {
  const sixByOne: WorkPattern = {
    cycleAnchorDate: ANCHOR,
    weeks: [
      week({
        MONDAY: WEEKDAY_44,
        TUESDAY: WEEKDAY_44,
        WEDNESDAY: WEEKDAY_44,
        THURSDAY: WEEKDAY_44,
        FRIDAY: WEEKDAY_44,
      }),
    ],
  };
  const today6x1: WorkPattern = {
    cycleAnchorDate: ANCHOR,
    weeks: [
      week({
        MONDAY: WEEKDAY_8H,
        TUESDAY: WEEKDAY_8H,
        WEDNESDAY: WEEKDAY_8H,
        THURSDAY: WEEKDAY_8H,
        FRIDAY: WEEKDAY_8H,
        SATURDAY: SATURDAY,
      }),
    ],
  };

  it('accepts the current 6x1 until the transition and flags it afterwards', () => {
    expect(
      checkCompliance(planRange(today6x1, [], '2026-11-30', '2026-12-13'), NO_AGREEMENT),
    ).toEqual([]);
    const after = checkCompliance(
      planRange(today6x1, [], '2026-12-21', '2026-12-27'),
      NO_AGREEMENT,
    );
    // 5 x 8 h + 4 h Saturday = 44 h: one rest day short and above 40 h without an agreement.
    expect(after.map((issue) => issue.code)).toEqual([
      'NOT_ENOUGH_REST_DAYS',
      'WEEKLY_HOURS_EXCEEDED',
    ]);
    expect(after[0]?.message).toBe(
      'Semana de 21/12/2026: 1 folga(s); são necessárias 2 (feriado não conta como folga).',
    );
  });

  it('allows 8h24 days only with a collective agreement', () => {
    const fiveLong: WorkPattern = {
      cycleAnchorDate: ANCHOR,
      weeks: [
        week({
          MONDAY: WEEKDAY_8H24,
          TUESDAY: WEEKDAY_8H24,
          WEDNESDAY: WEEKDAY_8H24,
          THURSDAY: WEEKDAY_8H24,
          FRIDAY: WEEKDAY_8H24,
        }),
      ],
    };
    const days = planRange(fiveLong, [], '2026-12-21', '2026-12-27');
    expect(checkCompliance(days, WITH_AGREEMENT)).toEqual([]);
    const codes = checkCompliance(days, NO_AGREEMENT).map((issue) => issue.code);
    expect(codes.filter((code) => code === 'DAILY_HOURS_EXCEEDED')).toHaveLength(5);
    expect(codes).toContain('WEEKLY_HOURS_EXCEEDED');
    // 8h48 days that compensated Saturday no longer fit after the transition.
    expect(
      checkCompliance(planRange(sixByOne, [], '2026-12-21', '2026-12-27'), WITH_AGREEMENT).map(
        (i) => i.code,
      ),
    ).toContain('WEEKLY_HOURS_EXCEEDED');
  });

  it('checks breaks, rest between days and consecutive workdays', () => {
    const bad: WorkPattern = {
      cycleAnchorDate: ANCHOR,
      weeks: [
        week({
          MONDAY: shift('14:00', '23:00', '18:00', '18:30'),
          TUESDAY: shift('07:00', '12:00'),
          WEDNESDAY: WEEKDAY_8H,
          THURSDAY: WEEKDAY_8H,
          FRIDAY: WEEKDAY_8H,
          SATURDAY: SATURDAY,
          SUNDAY: SATURDAY,
        }),
      ],
    };
    const codes = checkCompliance(planRange(bad, [], '2026-11-30', '2026-12-13'), NO_AGREEMENT).map(
      (i) => i.code,
    );
    expect(codes).toEqual(
      expect.arrayContaining([
        'BREAK_TOO_SHORT',
        'INTERSHIFT_REST_TOO_SHORT',
        'TOO_MANY_CONSECUTIVE_WORKDAYS',
        'NOT_ENOUGH_REST_DAYS',
      ]),
    );
  });

  it('warns when Sundays are worked for too long', () => {
    const sundays: WorkPattern = {
      cycleAnchorDate: ANCHOR,
      weeks: [
        week({
          TUESDAY: WEEKDAY_8H,
          WEDNESDAY: WEEKDAY_8H,
          THURSDAY: WEEKDAY_8H,
          FRIDAY: WEEKDAY_8H,
          SUNDAY: WEEKDAY_8H,
        }),
      ],
    };
    const issues = checkCompliance(
      planRange(sundays, [], '2026-12-14', '2027-01-03'),
      NO_AGREEMENT,
    );
    expect(issues.map((issue) => issue.code)).toEqual(['NO_SUNDAY_REST']);
    expect(
      checkCompliance(planRange(sundays, [], '2026-12-14', '2027-01-03'), {
        ...NO_AGREEMENT,
        sundayRestEveryWeeks: 4,
      }),
    ).toEqual([]);
  });

  it('does not count a holiday as a weekly rest day', () => {
    const pattern: WorkPattern = {
      cycleAnchorDate: ANCHOR,
      weeks: [
        week({
          MONDAY: WEEKDAY_8H,
          TUESDAY: WEEKDAY_8H,
          WEDNESDAY: WEEKDAY_8H,
          THURSDAY: WEEKDAY_8H,
          FRIDAY: WEEKDAY_8H,
        }),
      ],
    };
    // Christmas (Friday 25/12/2026) closes the store: that day has no shift, but it is not a folga.
    const days = planRange(
      pattern,
      [{ businessDate: '2026-12-25', shift: null, reason: 'ADJUSTMENT' }],
      '2026-12-21',
      '2026-12-27',
    );
    expect(checkCompliance(days, { ...NO_AGREEMENT, holidays: new Set(['2026-12-25']) })).toEqual(
      [],
    );
  });
});

describe('team planning', () => {
  const SHIFTS: Record<Weekday, Shift | null> = {
    MONDAY: WEEKDAY_8H,
    TUESDAY: WEEKDAY_8H,
    WEDNESDAY: WEEKDAY_8H,
    THURSDAY: WEEKDAY_8H,
    FRIDAY: WEEKDAY_8H,
    SATURDAY: shift('08:00', '16:00', '12:00', '13:00'),
    SUNDAY: null,
  };
  const OPEN: Weekday[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const team = ['ana', 'bruno', 'carla', 'diego', 'eva'];

  it('spreads the second day off and keeps the store covered', () => {
    const suggestion = suggestRestDays({
      employeeIds: team,
      openWeekdays: OPEN,
      sharedRestWeekdays: ['SUNDAY'],
      minimumStaff: 3,
      rotate: false,
    });
    expect(suggestion.map((item) => item.extraRestDays[0])).toEqual([
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
    ]);
    const plans = suggestion.map((item) => {
      const pattern: WorkPattern = {
        cycleAnchorDate: ANCHOR,
        weeks: patternWeeksFor(SHIFTS, ['SUNDAY'], item.extraRestDays),
      };
      const days = planRange(pattern, [], '2026-12-21', '2026-12-27');
      expect(checkCompliance(days, NO_AGREEMENT)).toEqual([]);
      return { employeeId: item.employeeId, days };
    });
    const storeHours = new Map(
      plans[0]!.days.map((day) => [
        day.businessDate,
        day.weekday === 'SUNDAY'
          ? null
          : { openMinute: 480, closeMinute: day.weekday === 'SATURDAY' ? 960 : 1020 },
      ]),
    );
    const coverage = coverageFor(plans, storeHours, 3);
    const monday = coverage[0]!;
    expect(monday.resting).toEqual(['ana']);
    // Everybody lunches at 12–13, so the store is empty then: the planner shows the gap.
    expect(monday.gaps).toEqual([
      { businessDate: '2026-12-21', startMinute: 720, endMinute: 780, present: 0, required: 3 },
    ]);
  });

  it('rotates the extra day off so everyone gets every weekday', () => {
    const [first] = suggestRestDays({
      employeeIds: team,
      openWeekdays: OPEN,
      sharedRestWeekdays: ['SUNDAY'],
      minimumStaff: 3,
      rotate: true,
    });
    expect(first?.extraRestDays).toEqual(OPEN);
  });

  it('refuses a minimum staff the team cannot meet', () => {
    expect(() =>
      suggestRestDays({
        employeeIds: ['a', 'b'],
        openWeekdays: OPEN,
        sharedRestWeekdays: ['SUNDAY'],
        minimumStaff: 2,
        rotate: false,
      }),
    ).toThrow('não há como dar a segunda folga a todos');
  });

  it('accepts a day-off swap that keeps both schedules legal and refuses one that does not', () => {
    const make = (extra: Weekday): { pattern: WorkPattern; overrides: [] } => ({
      pattern: { cycleAnchorDate: ANCHOR, weeks: patternWeeksFor(SHIFTS, ['SUNDAY'], [extra]) },
      overrides: [],
    });
    const ana = make('MONDAY');
    const bruno = make('WEDNESDAY');
    const window = { from: '2026-12-21', to: '2026-12-27' };

    const fair = simulateSwap(
      ana,
      bruno,
      { dates: ['2026-12-21', '2026-12-23'], swapId: 'troca-1' },
      window,
      NO_AGREEMENT,
    );
    expect(fair.allowed).toBe(true);
    expect(fair.overridesA.map((item) => [item.businessDate, item.shift === null])).toEqual([
      ['2026-12-21', false],
      ['2026-12-23', true],
    ]);

    const unfair = simulateSwap(
      ana,
      bruno,
      { dates: ['2026-12-21'], swapId: 'troca-2' },
      window,
      NO_AGREEMENT,
    );
    expect(unfair.allowed).toBe(false);
    expect(unfair.issuesA.map((issue) => issue.code)).toContain('NOT_ENOUGH_REST_DAYS');
  });
});
