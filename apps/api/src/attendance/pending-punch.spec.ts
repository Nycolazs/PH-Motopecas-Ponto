import type { DailyAttendanceSummary, ResolvedExpectation } from '@ph-ponto/shared';
import { describe, expect, it } from 'vitest';

import { isPendingPunch } from './attendance.service.js';

const expectation = { isOpen: true, closingMinute: 17 * 60 } as ResolvedExpectation;

function day(overrides: {
  isFinalized?: boolean;
  status?: DailyAttendanceSummary['status'];
  hasOpenInterval?: boolean;
  isIncomplete?: boolean;
  integrityIssues?: number;
}): DailyAttendanceSummary {
  return {
    isFinalized: overrides.isFinalized ?? false,
    status: overrides.status ?? null,
    chronology: {
      hasOpenInterval: overrides.hasOpenInterval ?? false,
      isIncomplete: overrides.isIncomplete ?? false,
      integrityIssues: Array.from({ length: overrides.integrityIssues ?? 0 }, () => ({})),
    },
  } as unknown as DailyAttendanceSummary;
}

// 2026-11-06 in São Paulo (UTC-3).
const at = (time: string) => new Date(`2026-11-06T${time}:00-03:00`);

describe('isPendingPunch', () => {
  it('does not count someone still at work during the day', () => {
    expect(
      isPendingPunch(day({ hasOpenInterval: true, isIncomplete: true }), expectation, at('15:00')),
    ).toBe(false);
    expect(isPendingPunch(day({ hasOpenInterval: true }), expectation, at('18:00'))).toBe(false);
  });

  it('counts an open day well after the scheduled end', () => {
    expect(isPendingPunch(day({ hasOpenInterval: true }), expectation, at('18:01'))).toBe(true);
  });

  it('counts finished incomplete days and broken sequences', () => {
    expect(
      isPendingPunch(day({ isFinalized: true, status: 'INCOMPLETE' }), expectation, at('10:00')),
    ).toBe(true);
    expect(isPendingPunch(day({ integrityIssues: 1 }), expectation, at('10:00'))).toBe(true);
    expect(
      isPendingPunch(day({ isFinalized: true, status: 'NORMAL' }), expectation, at('10:00')),
    ).toBe(false);
  });

  it('ignores open days without a scheduled end (day off)', () => {
    const off = { isOpen: false, closingMinute: null } as ResolvedExpectation;
    expect(isPendingPunch(day({ hasOpenInterval: true }), off, at('23:00'))).toBe(false);
  });
});
