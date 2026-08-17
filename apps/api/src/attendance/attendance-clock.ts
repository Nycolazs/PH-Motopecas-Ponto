import type { Provider } from '@nestjs/common';

export const ATTENDANCE_CLOCK = Symbol('ATTENDANCE_CLOCK');
export type AttendanceClock = () => Date;

export const attendanceClockProvider: Provider<AttendanceClock> = {
  provide: ATTENDANCE_CLOCK,
  useValue: (): Date => new Date(),
};
