import { describe, expect, it } from 'vitest';

import {
  calculateDailyAttendance,
  resolveExpectation,
  type AttendancePunch,
  type ResolvedExpectation,
} from '../../src/index.js';
import { exceptionRevision, punch, punchesForTimes, scheduleVersion } from './fixtures.js';

const baseline = scheduleVersion();

function expectationFor(
  businessDate = '2026-08-17',
  exceptionRevisions: Parameters<typeof resolveExpectation>[0]['exceptionRevisions'] = [],
): ResolvedExpectation {
  return resolveExpectation({
    businessDate,
    scheduleVersions: [baseline],
    exceptionRevisions,
  });
}

function finalizedSummary(
  times: readonly string[],
  businessDate = '2026-08-17',
  expectation = expectationFor(businessDate),
) {
  return calculateDailyAttendance({
    businessDate,
    expectation,
    punches: punchesForTimes(times, businessDate),
    isFinalized: true,
  });
}

describe('daily attendance calculation', () => {
  it('calculates a normal weekday', () => {
    const summary = finalizedSummary(['08:00', '12:00', '13:00', '17:00']);

    expect(summary).toMatchObject({
      expectedMinutes: 480,
      workedMinutes: 480,
      balanceMinutes: 0,
      status: 'NORMAL',
      completedIntervalCount: 2,
    });
  });

  it('calculates weekday overtime', () => {
    const summary = finalizedSummary(['08:00', '12:00', '13:00', '18:00']);

    expect(summary.workedMinutes).toBe(540);
    expect(summary.balanceMinutes).toBe(60);
    expect(summary.status).toBe('OVERTIME');
  });

  it('calculates missing weekday hours', () => {
    const summary = finalizedSummary(['08:00', '12:00', '13:00', '16:00']);

    expect(summary.workedMinutes).toBe(420);
    expect(summary.balanceMinutes).toBe(-60);
    expect(summary.status).toBe('MISSING_HOURS');
  });

  it('calculates a normal four-hour Saturday', () => {
    const summary = finalizedSummary(['08:00', '12:00'], '2026-08-22');

    expect(summary.expectedMinutes).toBe(240);
    expect(summary.workedMinutes).toBe(240);
    expect(summary.balanceMinutes).toBe(0);
    expect(summary.status).toBe('NORMAL');
  });

  it('keeps a closed Sunday at zero without missing hours', () => {
    const summary = finalizedSummary([], '2026-08-23');

    expect(summary.expectedMinutes).toBe(0);
    expect(summary.workedMinutes).toBe(0);
    expect(summary.balanceMinutes).toBe(0);
    expect(summary.status).toBe('DAY_OFF');
  });

  it('keeps a closed holiday at zero without missing hours', () => {
    const holiday = expectationFor('2026-08-17', [exceptionRevision()]);
    const summary = finalizedSummary([], '2026-08-17', holiday);

    expect(summary.expectedMinutes).toBe(0);
    expect(summary.balanceMinutes).toBe(0);
    expect(summary.status).toBe('HOLIDAY');
  });

  it('calculates four special operating hours', () => {
    const specialHours = expectationFor('2026-08-17', [
      exceptionRevision({
        kind: 'SPECIAL_HOURS',
        name: 'Horário especial',
        openingMinute: 480,
        closingMinute: 720,
      }),
    ]);
    const summary = finalizedSummary(['08:00', '12:00'], '2026-08-17', specialHours);

    expect(summary.expectedMinutes).toBe(240);
    expect(summary.workedMinutes).toBe(240);
    expect(summary.balanceMinutes).toBe(0);
    expect(summary.status).toBe('NORMAL');
  });

  it('marks an odd finalized sequence incomplete without inventing an exit', () => {
    const summary = finalizedSummary(['08:00', '12:00', '13:00']);

    expect(summary.status).toBe('INCOMPLETE');
    expect(summary.workedMinutes).toBe(240);
    expect(summary.balanceMinutes).toBeNull();
    expect(summary.chronology.hasOpenInterval).toBe(true);
  });

  it('marks zero punches on a finalized open day as missing hours', () => {
    const summary = finalizedSummary([]);

    expect(summary.workedMinutes).toBe(0);
    expect(summary.balanceMinutes).toBe(-480);
    expect(summary.status).toBe('MISSING_HOURS');
  });

  it('does not show provisional missing hours before an employee starts', () => {
    const summary = calculateDailyAttendance({
      businessDate: '2026-08-17',
      expectation: expectationFor(),
      punches: [],
      isFinalized: false,
    });

    expect(summary.workState).toBe('NOT_STARTED');
    expect(summary.balanceMinutes).toBeNull();
    expect(summary.status).toBeNull();
  });

  it('supports any number of completed work intervals', () => {
    const summary = finalizedSummary(['08:00', '10:00', '10:15', '12:00', '13:00', '17:00']);

    expect(summary.completedIntervalCount).toBe(3);
    expect(summary.workedMinutes).toBe(465);
    expect(summary.balanceMinutes).toBe(-15);
  });

  it('flags invalid punch chronology instead of silently repairing it', () => {
    const punches: AttendancePunch[] = [
      punch('one', 'CLOCK_IN', '08:00'),
      punch('two', 'CLOCK_IN', '12:00'),
      punch('three', 'CLOCK_OUT', '17:00'),
    ];
    const summary = calculateDailyAttendance({
      businessDate: '2026-08-17',
      expectation: expectationFor(),
      punches,
      isFinalized: true,
    });

    expect(summary.status).toBe('INCOMPLETE');
    expect(summary.balanceMinutes).toBeNull();
    expect(summary.chronology.integrityIssues.map((entry) => entry.code)).toContain(
      'REPEATED_KIND',
    );
  });

  it('uses the latest valid correction while preserving the original instant', () => {
    const punches: AttendancePunch[] = [
      punch('clock-in', 'CLOCK_IN', '08:00'),
      {
        ...punch('clock-out', 'CLOCK_OUT', '15:00'),
        adjustments: [
          {
            id: 'adjustment-1',
            sequence: 1,
            previousOccurredAt: '2026-08-17T15:00:00-03:00',
            correctedOccurredAt: '2026-08-17T16:00:00-03:00',
          },
          {
            id: 'adjustment-2',
            sequence: 2,
            previousOccurredAt: '2026-08-17T16:00:00-03:00',
            correctedOccurredAt: '2026-08-17T17:00:00-03:00',
          },
        ],
      },
    ];
    const summary = calculateDailyAttendance({
      businessDate: '2026-08-17',
      expectation: expectationFor(),
      punches,
      isFinalized: true,
    });

    expect(summary.workedMinutes).toBe(540);
    expect(summary.balanceMinutes).toBe(60);
    expect(summary.correctionCount).toBe(2);
    expect(summary.chronology.punches[1]).toMatchObject({
      originalOccurredAt: '2026-08-17T18:00:00.000Z',
      effectiveOccurredAt: '2026-08-17T20:00:00.000Z',
    });
  });

  it('floors exact elapsed milliseconds once after aggregating every interval', () => {
    const punches: AttendancePunch[] = [
      { id: 'one', kind: 'CLOCK_IN', occurredAt: '2026-08-17T08:00:00.000-03:00' },
      { id: 'two', kind: 'CLOCK_OUT', occurredAt: '2026-08-17T08:00:30.500-03:00' },
      { id: 'three', kind: 'CLOCK_IN', occurredAt: '2026-08-17T08:01:00.000-03:00' },
      { id: 'four', kind: 'CLOCK_OUT', occurredAt: '2026-08-17T08:01:30.500-03:00' },
    ];
    const summary = calculateDailyAttendance({
      businessDate: '2026-08-17',
      expectation: expectationFor(),
      punches,
      isFinalized: true,
    });

    expect(summary.chronology.workedMilliseconds).toBe(61_000);
    expect(summary.workedMinutes).toBe(1);
  });

  it('treats an odd current-day sequence as actively working', () => {
    const summary = calculateDailyAttendance({
      businessDate: '2026-08-17',
      expectation: expectationFor(),
      punches: punchesForTimes(['08:00', '12:00', '13:00']),
      isFinalized: false,
    });

    expect(summary.workState).toBe('WORKING');
    expect(summary.status).toBeNull();
    expect(summary.workedMinutes).toBe(240);
    expect(summary.balanceMinutes).toBeNull();
  });

  it('exposes a clearly provisional balance after an even current-day sequence', () => {
    const summary = calculateDailyAttendance({
      businessDate: '2026-08-17',
      expectation: expectationFor(),
      punches: punchesForTimes(['08:00', '12:00']),
      isFinalized: false,
    });

    expect(summary.workState).toBe('OFF_DUTY');
    expect(summary.status).toBe('MISSING_HOURS');
    expect(summary.balanceMinutes).toBe(-240);
    expect(summary.isFinalized).toBe(false);
  });

  it('retains the holiday label when complete punches exist on a closed holiday', () => {
    const holiday = expectationFor('2026-08-17', [exceptionRevision()]);
    const summary = finalizedSummary(['08:00', '12:00'], '2026-08-17', holiday);

    expect(summary.workedMinutes).toBe(240);
    expect(summary.balanceMinutes).toBe(240);
    expect(summary.status).toBe('HOLIDAY');
  });

  it('flags a correction that crosses a neighboring punch and avoids overlapping totals', () => {
    const punches: AttendancePunch[] = [
      punch('clock-in-1', 'CLOCK_IN', '08:00'),
      {
        ...punch('clock-out-1', 'CLOCK_OUT', '12:00'),
        adjustments: [
          {
            sequence: 1,
            previousOccurredAt: '2026-08-17T12:00:00-03:00',
            correctedOccurredAt: '2026-08-17T14:00:00-03:00',
          },
        ],
      },
      punch('clock-in-2', 'CLOCK_IN', '13:00'),
      punch('clock-out-2', 'CLOCK_OUT', '17:00'),
    ];
    const summary = calculateDailyAttendance({
      businessDate: '2026-08-17',
      expectation: expectationFor(),
      punches,
      isFinalized: true,
    });

    expect(summary.status).toBe('INCOMPLETE');
    expect(summary.balanceMinutes).toBeNull();
    expect(summary.workedMinutes).toBe(0);
    expect(summary.chronology.integrityIssues.map((entry) => entry.code)).toContain(
      'NON_INCREASING_INSTANT',
    );
  });
});
