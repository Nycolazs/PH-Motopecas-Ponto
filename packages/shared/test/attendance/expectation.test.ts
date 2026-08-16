import { describe, expect, it } from 'vitest';

import {
  AttendanceConfigurationError,
  expectedMinutesForWorkHours,
  resolveExpectation,
  selectScheduleVersion,
} from '../../src/index.js';
import { exceptionRevision, scheduleVersion } from './fixtures.js';

describe('attendance expectation resolution', () => {
  const baseline = scheduleVersion();

  it('resolves eight expected hours for a normal weekday', () => {
    const expectation = resolveExpectation({
      businessDate: '2026-08-17',
      scheduleVersions: [baseline],
    });

    expect(expectation.expectedMinutes).toBe(480);
    expect(expectation.source).toBe('WEEKLY_SCHEDULE');
    expect(expectation.calendarStatus).toBeNull();
  });

  it('resolves four expected hours for Saturday', () => {
    const expectation = resolveExpectation({
      businessDate: '2026-08-22',
      scheduleVersions: [baseline],
    });

    expect(expectation.expectedMinutes).toBe(240);
    expect(expectation.lunchEnabled).toBe(false);
  });

  it('resolves a closed Sunday as a day off with zero expected minutes', () => {
    const expectation = resolveExpectation({
      businessDate: '2026-08-23',
      scheduleVersions: [baseline],
    });

    expect(expectation.expectedMinutes).toBe(0);
    expect(expectation.calendarStatus).toBe('DAY_OFF');
  });

  it('lets a closed holiday override the weekly schedule', () => {
    const expectation = resolveExpectation({
      businessDate: '2026-08-17',
      scheduleVersions: [baseline],
      exceptionRevisions: [exceptionRevision()],
    });

    expect(expectation.expectedMinutes).toBe(0);
    expect(expectation.source).toBe('HOLIDAY');
    expect(expectation.calendarStatus).toBe('HOLIDAY');
  });

  it('resolves special hours from the exception instead of the weekly schedule', () => {
    const expectation = resolveExpectation({
      businessDate: '2026-08-17',
      scheduleVersions: [baseline],
      exceptionRevisions: [
        exceptionRevision({
          kind: 'SPECIAL_HOURS',
          name: 'Horário especial',
          openingMinute: 480,
          closingMinute: 720,
        }),
      ],
    });

    expect(expectation.expectedMinutes).toBe(240);
    expect(expectation.source).toBe('SPECIAL_HOURS');
    expect(expectation.calendarStatus).toBeNull();
  });

  it('uses a latest retraction to fall back to the weekly schedule', () => {
    const expectation = resolveExpectation({
      businessDate: '2026-08-17',
      scheduleVersions: [baseline],
      exceptionRevisions: [
        exceptionRevision(),
        exceptionRevision({
          id: 'exception-revision-2',
          sequence: 2,
          operation: 'RETRACT',
          kind: null,
          name: null,
        }),
      ],
    });

    expect(expectation.expectedMinutes).toBe(480);
    expect(expectation.source).toBe('WEEKLY_SCHEDULE');
  });

  it('selects immutable schedule history by greatest effective date', () => {
    const augustSchedule = scheduleVersion('august', '2026-08-01', 1_020);
    const septemberSchedule = scheduleVersion('september', '2026-09-01', 1_080);

    expect(selectScheduleVersion([septemberSchedule, augustSchedule], '2026-08-31').id).toBe(
      'august',
    );
    expect(selectScheduleVersion([septemberSchedule, augustSchedule], '2026-09-01').id).toBe(
      'september',
    );
    expect(
      resolveExpectation({
        businessDate: '2026-08-31',
        scheduleVersions: [augustSchedule, septemberSchedule],
      }).expectedMinutes,
    ).toBe(480);
    expect(
      resolveExpectation({
        businessDate: '2026-09-01',
        scheduleVersions: [augustSchedule, septemberSchedule],
      }).expectedMinutes,
    ).toBe(540);
  });

  it('rejects impossible lunch hours', () => {
    expect(() =>
      expectedMinutesForWorkHours({
        isOpen: true,
        openingMinute: 480,
        closingMinute: 1_020,
        lunchEnabled: true,
        lunchStartMinute: 1_080,
        lunchEndMinute: 1_140,
      }),
    ).toThrow(AttendanceConfigurationError);
  });
});
