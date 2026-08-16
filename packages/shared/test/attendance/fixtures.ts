import type {
  AttendancePunch,
  CalendarExceptionRevision,
  ScheduleDay,
  ScheduleVersion,
  Weekday,
} from '../../src/index.js';

const WEEKDAYS: readonly Weekday[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];

const workday = (weekday: Weekday, closingMinute = 1_020): ScheduleDay => ({
  weekday,
  isOpen: true,
  openingMinute: 480,
  closingMinute,
  lunchEnabled: true,
  lunchStartMinute: 720,
  lunchEndMinute: 780,
});

export function scheduleVersion(
  id = 'schedule-baseline',
  effectiveDate = '1970-01-01',
  weekdayClosingMinute = 1_020,
): ScheduleVersion {
  return {
    id,
    effectiveDate,
    days: [
      ...WEEKDAYS.map((weekday) => workday(weekday, weekdayClosingMinute)),
      {
        weekday: 'SATURDAY',
        isOpen: true,
        openingMinute: 480,
        closingMinute: 720,
        lunchEnabled: false,
        lunchStartMinute: null,
        lunchEndMinute: null,
      },
      {
        weekday: 'SUNDAY',
        isOpen: false,
        openingMinute: null,
        closingMinute: null,
        lunchEnabled: false,
        lunchStartMinute: null,
        lunchEndMinute: null,
      },
    ],
  };
}

export function exceptionRevision(
  overrides: Partial<CalendarExceptionRevision> = {},
): CalendarExceptionRevision {
  return {
    id: 'exception-revision-1',
    businessDate: '2026-08-17',
    sequence: 1,
    operation: 'UPSERT',
    kind: 'HOLIDAY',
    name: 'Feriado de teste',
    openingMinute: null,
    closingMinute: null,
    lunchEnabled: false,
    lunchStartMinute: null,
    lunchEndMinute: null,
    ...overrides,
  };
}

export function punch(
  id: string,
  kind: AttendancePunch['kind'],
  localTime: string,
  businessDate = '2026-08-17',
): AttendancePunch {
  return {
    id,
    kind,
    occurredAt: `${businessDate}T${localTime}:00-03:00`,
  };
}

export function punchesForTimes(
  times: readonly string[],
  businessDate = '2026-08-17',
): AttendancePunch[] {
  return times.map((time, index) =>
    punch(
      `punch-${String(index + 1)}`,
      index % 2 === 0 ? 'CLOCK_IN' : 'CLOCK_OUT',
      time,
      businessDate,
    ),
  );
}
