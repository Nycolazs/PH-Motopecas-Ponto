import { describe, expect, it } from 'vitest';

import { formatDurationMinutes } from '../src/index.js';

describe('formatDurationMinutes', () => {
  it.each([
    [0, '0min'],
    [1, '1min'],
    [59, '59min'],
    [60, '1h'],
    [90, '1h 30min'],
    [150, '2h 30min'],
    [-45, '-45min'],
    [-150, '-2h 30min'],
  ])('formats %i minutes as %s', (minutes, expected) => {
    expect(formatDurationMinutes(minutes)).toBe(expected);
  });

  it.each([1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'rejects the unsafe duration %s',
    (minutes) => {
      expect(() => formatDurationMinutes(minutes)).toThrow(
        new RangeError('totalMinutes must be a safe integer'),
      );
    },
  );
});
