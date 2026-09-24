import { describe, expect, it } from 'vitest';
import { effectiveChronology } from './effective-chronology.js';

describe('effectiveChronology', () => {
  it('re-pairs surviving punches without modifying original records', () => {
    const surviving = [
      { id: 'b', kind: 'CLOCK_OUT' as const, occurredAt: '2026-09-23T12:00:00Z' },
      { id: 'c', kind: 'CLOCK_IN' as const, occurredAt: '2026-09-23T13:00:00Z' },
    ];
    expect(effectiveChronology(surviving).map((punch) => punch.kind)).toEqual([
      'CLOCK_IN',
      'CLOCK_OUT',
    ]);
    expect(surviving[0]?.kind).toBe('CLOCK_OUT');
  });

  it('sorts by the latest correction before deriving effective directions', () => {
    const result = effectiveChronology([
      { id: 'later', kind: 'CLOCK_IN', occurredAt: '2026-09-23T13:00:00Z' },
      {
        id: 'earlier',
        kind: 'CLOCK_OUT',
        occurredAt: '2026-09-23T14:00:00Z',
        adjustments: [
          {
            id: 'adjustment',
            sequence: 1,
            previousOccurredAt: '2026-09-23T14:00:00Z',
            correctedOccurredAt: '2026-09-23T12:00:00Z',
          },
        ],
      },
    ]);
    expect(result.map((punch) => [punch.id, punch.kind])).toEqual([
      ['earlier', 'CLOCK_IN'],
      ['later', 'CLOCK_OUT'],
    ]);
  });
});
