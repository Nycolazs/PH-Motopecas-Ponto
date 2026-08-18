import { describe, expect, it } from 'vitest';

import {
  businessDateFromInstant,
  formatBusinessDate,
  resolveHistoryRange,
} from './business-date.js';

describe('renderer business dates', () => {
  it('uses Fortaleza rather than the workstation timezone', () => {
    expect(businessDateFromInstant(new Date('2026-08-15T01:30:00.000Z'))).toBe('2026-08-14');
    expect(businessDateFromInstant(new Date('2026-08-15T03:00:00.000Z'))).toBe('2026-08-15');
  });

  it('resolves Monday-based current-week ranges', () => {
    expect(resolveHistoryRange('THIS_WEEK', new Date('2026-08-14T15:00:00.000Z'))).toEqual({
      from: '2026-08-10',
      to: '2026-08-14',
    });
  });

  it('resolves the complete previous month across a year boundary', () => {
    expect(resolveHistoryRange('PREVIOUS_MONTH', new Date('2027-01-12T15:00:00.000Z'))).toEqual({
      from: '2026-12-01',
      to: '2026-12-31',
    });
  });

  it('formats business dates naturally in pt-BR', () => {
    expect(formatBusinessDate('2026-08-14')).toMatch(/14 de ago/i);
  });
});
