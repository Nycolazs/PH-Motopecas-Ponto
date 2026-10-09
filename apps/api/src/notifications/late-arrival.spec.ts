import { describe, expect, it } from 'vitest';

import {
  buildLateArrivalMessage,
  businessMinuteOfDay,
  evaluateLateArrival,
  normalizeWhatsappPhone,
} from './late-arrival.js';

const open = { isOpen: true, openingMinute: 8 * 60 };

describe('evaluateLateArrival', () => {
  it('uses the business time zone (UTC-3) to read the clock-in minute', () => {
    expect(businessMinuteOfDay(new Date('2026-10-09T11:12:40.000Z'))).toBe(8 * 60 + 12);
  });

  it('does not alert within the tolerance, including exactly at the limit', () => {
    expect(
      evaluateLateArrival({
        expectation: open,
        clockInAt: new Date('2026-10-09T11:05:59.000Z'),
        toleranceMinutes: 5,
      }),
    ).toBeNull();
    expect(
      evaluateLateArrival({
        expectation: open,
        clockInAt: new Date('2026-10-09T10:50:00.000Z'),
        toleranceMinutes: 5,
      }),
    ).toBeNull();
  });

  it('alerts when the first clock-in is more than the tolerance after opening', () => {
    expect(
      evaluateLateArrival({
        expectation: open,
        clockInAt: new Date('2026-10-09T11:06:00.000Z'),
        toleranceMinutes: 5,
      }),
    ).toEqual({ scheduledMinute: 480, clockInMinute: 486, minutesLate: 6 });
  });

  it('never alerts on closed days, holidays or vacations', () => {
    expect(
      evaluateLateArrival({
        expectation: { isOpen: false, openingMinute: null },
        clockInAt: new Date('2026-10-09T14:00:00.000Z'),
        toleranceMinutes: 5,
      }),
    ).toBeNull();
  });
});

describe('buildLateArrivalMessage', () => {
  it('writes a short pt-BR message with name, clock-in time and delay', () => {
    const message = buildLateArrivalMessage({
      employeeName: 'DIEGO PEREIRA DANTAS',
      businessDate: '2026-10-09',
      lateArrival: { scheduledMinute: 480, clockInMinute: 552, minutesLate: 72 },
    });
    expect(message).toContain('*Colaborador:* Diego Pereira Dantas');
    expect(message).toContain('*Entrada:* 09:12 (previsto 08:00)');
    expect(message).toContain('*Atraso:* 1h 12min');
    expect(message).toContain('*Data:* 09/10/2026');
  });
});

describe('normalizeWhatsappPhone', () => {
  it('adds the Brazilian country code to local numbers and rejects invalid ones', () => {
    expect(normalizeWhatsappPhone('(85) 99999-0000')).toBe('5585999990000');
    expect(normalizeWhatsappPhone('+55 85 99999-0000')).toBe('5585999990000');
    expect(normalizeWhatsappPhone('1234')).toBeNull();
  });
});
