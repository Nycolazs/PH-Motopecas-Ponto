import { describe, expect, it } from 'vitest';

import { canJustifyDay } from './presentation.js';

const workday = { calendarStatus: null, expectedMinutes: 480 };

describe('canJustifyDay', () => {
  it('allows absences: no punch at all or missing hours', () => {
    expect(canJustifyDay({ ...workday, punchCount: 0, status: 'MISSING_HOURS' })).toBe(true);
    expect(canJustifyDay({ ...workday, punchCount: 0, status: null })).toBe(true);
    expect(canJustifyDay({ ...workday, punchCount: 2, status: 'MISSING_HOURS' })).toBe(true);
  });

  it('refuses worked, incomplete, off and already justified days', () => {
    expect(canJustifyDay({ ...workday, punchCount: 4, status: 'NORMAL' })).toBe(false);
    expect(canJustifyDay({ ...workday, punchCount: 4, status: 'OVERTIME' })).toBe(false);
    expect(canJustifyDay({ ...workday, punchCount: 1, status: 'INCOMPLETE' })).toBe(false);
    expect(canJustifyDay({ ...workday, punchCount: 1, status: null })).toBe(false);
    expect(
      canJustifyDay({
        calendarStatus: 'DAY_OFF',
        expectedMinutes: 0,
        punchCount: 0,
        status: 'DAY_OFF',
      }),
    ).toBe(false);
    expect(
      canJustifyDay({
        calendarStatus: 'MEDICAL_LEAVE',
        expectedMinutes: 0,
        punchCount: 0,
        status: 'MEDICAL_LEAVE',
      }),
    ).toBe(false);
  });
});
