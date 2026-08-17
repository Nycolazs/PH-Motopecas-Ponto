import type { Provider } from '@nestjs/common';

export const SCHEDULE_CLOCK = Symbol('SCHEDULE_CLOCK');
export type ScheduleClock = () => Date;

export const scheduleClockProvider: Provider<ScheduleClock> = {
  provide: SCHEDULE_CLOCK,
  useValue: (): Date => new Date(),
};
