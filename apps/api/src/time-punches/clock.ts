import type { Provider } from '@nestjs/common';

export const TIME_PUNCH_CLOCK = Symbol('TIME_PUNCH_CLOCK');
export type TimePunchClock = () => Date;

export const timePunchClockProvider: Provider<TimePunchClock> = {
  provide: TIME_PUNCH_CLOCK,
  useValue: (): Date => new Date(),
};
