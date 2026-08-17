import { describe, expect, it } from 'vitest';

import {
  addBusinessDateDays,
  compareBusinessDates,
  enumerateBusinessDates,
  isBusinessDate,
  monthBusinessDateRange,
} from './business-date.js';

describe('business-date utilities', () => {
  it.each([
    ['2026-08-14', true],
    ['0001-01-01', true],
    ['0099-12-31', true],
    ['9999-12-31', true],
    ['2024-02-29', true],
    ['2026-02-29', false],
    ['2026-13-01', false],
    ['14/08/2026', false],
    ['2026-8-4', false],
  ])('validates %s', (value, expected) => {
    expect(isBusinessDate(value)).toBe(expected);
  });

  it('performs calendar arithmetic without using a host local timezone', () => {
    expect(addBusinessDateDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addBusinessDateDays('2024-02-29', 1)).toBe('2024-03-01');
    expect(addBusinessDateDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('compares and enumerates inclusive ranges with a hard bound', () => {
    expect(compareBusinessDates('2026-08-01', '2026-08-02')).toBeLessThan(0);
    expect(enumerateBusinessDates('2026-08-30', '2026-09-02', 4)).toEqual([
      '2026-08-30',
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
    ]);
    expect(() => enumerateBusinessDates('2026-08-30', '2026-09-02', 3)).toThrow('too large');
    expect(() => enumerateBusinessDates('2026-09-02', '2026-08-30', 4)).toThrow(
      'must not be after',
    );
  });

  it('resolves leap-year and year-end month ranges', () => {
    expect(monthBusinessDateRange('2024-02')).toEqual({
      from: '2024-02-01',
      to: '2024-02-29',
    });
    expect(monthBusinessDateRange('2026-12')).toEqual({
      from: '2026-12-01',
      to: '2026-12-31',
    });
    expect(monthBusinessDateRange('9999-12')).toEqual({
      from: '9999-12-01',
      to: '9999-12-31',
    });
    expect(enumerateBusinessDates('9999-12-31', '9999-12-31', 1)).toEqual(['9999-12-31']);
    expect(() => monthBusinessDateRange('2026-00')).toThrow('does not exist');
  });
});
