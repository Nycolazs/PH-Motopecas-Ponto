import { describe, expect, it } from 'vitest';

import {
  AttendanceConfigurationError,
  AttendanceInputError,
  businessDateFromInstant,
  classifyBusinessDate,
  instantRangeForBusinessDate,
  weekdayForBusinessDate,
} from '../../src/index.js';

describe('attendance business dates', () => {
  it('interprets UTC instants in America/Fortaleza at the local midnight boundary', () => {
    expect(businessDateFromInstant('2026-08-15T02:59:59.999Z')).toBe('2026-08-14');
    expect(businessDateFromInstant('2026-08-15T03:00:00.000Z')).toBe('2026-08-15');
  });

  it('requires string instants to contain an explicit offset', () => {
    expect(() => businessDateFromInstant('2026-08-15T08:00:00')).toThrow(
      new AttendanceInputError(
        'INVALID_INSTANT',
        'String instants must include an explicit UTC or numeric offset.',
      ),
    );
  });

  it('builds a normal 24-hour bounded query range', () => {
    const range = instantRangeForBusinessDate('2026-08-17');

    expect(range.start.toISOString()).toBe('2026-08-17T03:00:00.000Z');
    expect(range.endExclusive.toISOString()).toBe('2026-08-18T03:00:00.000Z');
    expect(range.endExclusive.getTime() - range.start.getTime()).toBe(24 * 60 * 60 * 1_000);
  });

  it('classifies finalized, current, and future dates from the server evaluation instant', () => {
    const evaluationInstant = '2026-08-17T15:00:00.000Z';

    expect(classifyBusinessDate('2026-08-16', evaluationInstant)).toBe('FINALIZED');
    expect(classifyBusinessDate('2026-08-17', evaluationInstant)).toBe('CURRENT');
    expect(classifyBusinessDate('2026-08-18', evaluationInstant)).toBe('FUTURE');
  });

  it('resolves weekdays without depending on the host timezone', () => {
    expect(weekdayForBusinessDate('2026-08-17')).toBe('MONDAY');
    expect(weekdayForBusinessDate('2026-08-22')).toBe('SATURDAY');
    expect(weekdayForBusinessDate('2026-08-23')).toBe('SUNDAY');
  });

  it('rejects impossible calendar dates', () => {
    expect(() => weekdayForBusinessDate('2026-02-30')).toThrow(AttendanceConfigurationError);
  });
});
