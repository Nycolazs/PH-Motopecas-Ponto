import { describe, expect, it } from 'vitest';

import {
  aggregateAttendancePeriod,
  applyAbsenceJustification,
  calculateDailyAttendance,
  resolveExpectation,
  type AbsenceJustificationInfo,
} from '../../src/index.js';
import { exceptionRevision, punchesForTimes, scheduleVersion } from './fixtures.js';

const baseline = scheduleVersion();
const MEDICAL: AbsenceJustificationInfo = { kind: 'MEDICAL_CERTIFICATE', reason: 'Gripe' };
const ALLOWANCE: AbsenceJustificationInfo = { kind: 'ALLOWANCE', reason: null };

function justifiedDay(
  times: readonly string[],
  justification: AbsenceJustificationInfo | null,
  businessDate = '2026-08-17',
  isFinalized = true,
) {
  const expectation = applyAbsenceJustification(
    resolveExpectation({ businessDate, scheduleVersions: [baseline] }),
    justification,
  );
  return calculateDailyAttendance({
    businessDate,
    expectation,
    punches: punchesForTimes(times, businessDate),
    isFinalized,
  });
}

describe('justified absences (abono e atestado)', () => {
  it('forgives a whole missed working day', () => {
    const summary = justifiedDay([], MEDICAL);
    expect(summary).toMatchObject({
      status: 'MEDICAL_LEAVE',
      expectedMinutes: 0,
      workedMinutes: 0,
      balanceMinutes: 0,
    });
    expect(summary.expectation.exceptionName).toBe('Atestado médico: Gripe');
    expect(summary.expectation.isOpen).toBe(false);

    const unjustified = justifiedDay([], null);
    expect(unjustified.balanceMinutes).toBe(-480);
  });

  it('forgives only the missing part when the employee worked some hours', () => {
    const summary = justifiedDay(['08:00', '10:00'], ALLOWANCE);
    expect(summary).toMatchObject({
      status: 'ALLOWANCE',
      expectedMinutes: 120,
      workedMinutes: 120,
      balanceMinutes: 0,
    });
    expect(summary.expectation.exceptionName).toBe('Abono');
  });

  it('keeps overtime worked on a justified day', () => {
    const summary = justifiedDay(['08:00', '12:00', '13:00', '18:00'], ALLOWANCE);
    expect(summary.expectedMinutes).toBe(480);
    expect(summary.balanceMinutes).toBe(60);
  });

  it('still requires a missing punch to be fixed', () => {
    const summary = justifiedDay(['08:00'], MEDICAL);
    expect(summary.status).toBe('INCOMPLETE');
    expect(summary.balanceMinutes).toBeNull();
  });

  it('shows today as justified before anyone punches', () => {
    const summary = justifiedDay([], MEDICAL, '2026-08-17', false);
    expect(summary.status).toBe('MEDICAL_LEAVE');
    expect(summary.balanceMinutes).toBeNull();
  });

  it('does not change days that already expect no work', () => {
    const sunday = justifiedDay([], MEDICAL, '2026-08-16');
    expect(sunday.status).toBe('DAY_OFF');
    const holiday = applyAbsenceJustification(
      resolveExpectation({
        businessDate: '2026-08-17',
        scheduleVersions: [baseline],
        exceptionRevisions: [exceptionRevision({ businessDate: '2026-08-17', kind: 'HOLIDAY' })],
      }),
      ALLOWANCE,
    );
    expect(holiday.calendarStatus).toBe('HOLIDAY');
  });

  it('leaves the month without missing hours for justified days', () => {
    const totals = aggregateAttendancePeriod([
      justifiedDay(['08:00', '12:00', '13:00', '17:00'], null, '2026-08-17'),
      justifiedDay([], MEDICAL, '2026-08-18'),
      justifiedDay(['08:00', '10:00'], ALLOWANCE, '2026-08-19'),
    ]);
    expect(totals).toMatchObject({
      expectedMinutes: 600,
      workedMinutes: 600,
      balanceMinutes: 0,
      missingMinutes: 0,
      completeDayCount: 3,
    });
  });
});
