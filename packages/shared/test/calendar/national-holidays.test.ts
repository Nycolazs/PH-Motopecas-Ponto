import { describe, expect, it } from 'vitest';

import {
  brazilianNationalHolidays,
  easterSunday,
  nationalHolidaysBetween,
} from '../../src/calendar/index.js';

describe('easterSunday', () => {
  it.each([
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2028, '2028-04-16'],
  ])('%i → %s', (year, expected) => {
    expect(easterSunday(year)).toBe(expected);
  });
});

describe('brazilianNationalHolidays', () => {
  it('lists the ten national holidays in date order', () => {
    const holidays = brazilianNationalHolidays(2026);
    expect(holidays.map((holiday) => holiday.businessDate)).toEqual([
      '2026-01-01',
      '2026-04-03',
      '2026-04-21',
      '2026-05-01',
      '2026-09-07',
      '2026-10-12',
      '2026-11-02',
      '2026-11-15',
      '2026-11-20',
      '2026-12-25',
    ]);
    expect(holidays.find((holiday) => holiday.businessDate === '2026-12-25')?.name).toBe('Natal');
  });
});

describe('nationalHolidaysBetween', () => {
  it('crosses years and keeps both ends', () => {
    expect(
      nationalHolidaysBetween('2026-12-25', '2027-01-01').map((holiday) => holiday.businessDate),
    ).toEqual(['2026-12-25', '2027-01-01']);
  });

  it('returns nothing for an empty window', () => {
    expect(nationalHolidaysBetween('2026-12-26', '2026-12-31')).toEqual([]);
  });
});
