import { describe, expect, it } from 'vitest';

import {
  AttendanceInputError,
  aggregateAttendancePeriod,
  aggregateMonthlyAttendance,
  calculateDailyAttendance,
  resolveExpectation,
} from '../../src/index.js';
import { punchesForTimes, scheduleVersion } from './fixtures.js';

const baseline = scheduleVersion();

function summary(businessDate: string, times: readonly string[], isFinalized = true) {
  return calculateDailyAttendance({
    businessDate,
    expectation: resolveExpectation({ businessDate, scheduleVersions: [baseline] }),
    punches: punchesForTimes(times, businessDate),
    isFinalized,
  });
}

describe('attendance period aggregation', () => {
  const normal = summary('2026-08-17', ['08:00', '12:00', '13:00', '17:00']);
  const overtime = summary('2026-08-18', ['08:00', '12:00', '13:00', '18:00']);
  const incomplete = summary('2026-08-19', ['08:00', '12:00', '13:00']);
  const provisional = summary('2026-08-20', [], false);

  it('excludes incomplete and provisional days from authoritative totals', () => {
    const period = aggregateAttendancePeriod([provisional, incomplete, overtime, normal]);

    expect(period).toMatchObject({
      startDate: '2026-08-17',
      endDate: '2026-08-20',
      finalizedDayCount: 3,
      completeDayCount: 2,
      incompleteDayCount: 1,
      provisionalDayCount: 1,
      expectedMinutes: 960,
      workedMinutes: 1_020,
      balanceMinutes: 60,
      overtimeMinutes: 60,
      missingMinutes: 0,
      knownPartialWorkedMinutes: 240,
      statusCounts: {
        normal: 1,
        overtime: 1,
        missingHours: 0,
        incomplete: 1,
        holiday: 0,
        dayOff: 0,
        closed: 0,
      },
    });
  });

  it('produces monthly totals with an explicit year and month', () => {
    const monthly = aggregateMonthlyAttendance({
      year: 2026,
      month: 8,
      summaries: [normal, overtime, incomplete, provisional],
    });

    expect(monthly.year).toBe(2026);
    expect(monthly.month).toBe(8);
    expect(monthly.completeDayCount).toBe(2);
  });

  it('rejects summaries from another month', () => {
    expect(() =>
      aggregateMonthlyAttendance({
        year: 2026,
        month: 7,
        summaries: [normal],
      }),
    ).toThrow(AttendanceInputError);
  });
});
