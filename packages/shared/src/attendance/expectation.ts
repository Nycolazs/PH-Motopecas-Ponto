import { AttendanceConfigurationError } from './errors.js';
import { assertBusinessDate, compareBusinessDates, weekdayForBusinessDate } from './dates.js';
import {
  WEEKDAYS,
  type CalendarExceptionRevision,
  type LocalWorkHours,
  type ResolvedExpectation,
  type ScheduleDay,
  type ScheduleVersion,
} from './types.js';

function isMinute(value: number | null, maximum: number): value is number {
  return value !== null && Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}

function invalidWorkHours(message: string): never {
  throw new AttendanceConfigurationError('INVALID_WORK_HOURS', message);
}

export function expectedMinutesForWorkHours(hours: LocalWorkHours): number {
  if (!hours.isOpen) {
    if (
      hours.openingMinute !== null ||
      hours.closingMinute !== null ||
      hours.lunchEnabled ||
      hours.lunchStartMinute !== null ||
      hours.lunchEndMinute !== null
    ) {
      invalidWorkHours('Closed work hours cannot contain opening, closing, or lunch times.');
    }

    return 0;
  }

  if (
    !isMinute(hours.openingMinute, 1_439) ||
    !isMinute(hours.closingMinute, 1_440) ||
    hours.openingMinute >= hours.closingMinute
  ) {
    invalidWorkHours('Open work hours require an opening before closing.');
  }

  const grossMinutes = hours.closingMinute - hours.openingMinute;

  if (!hours.lunchEnabled) {
    if (hours.lunchStartMinute !== null || hours.lunchEndMinute !== null) {
      invalidWorkHours('Lunch-disabled work hours cannot contain lunch times.');
    }

    return grossMinutes;
  }

  if (
    !isMinute(hours.lunchStartMinute, 1_439) ||
    !isMinute(hours.lunchEndMinute, 1_440) ||
    hours.lunchStartMinute < hours.openingMinute ||
    hours.lunchStartMinute >= hours.lunchEndMinute ||
    hours.lunchEndMinute > hours.closingMinute
  ) {
    invalidWorkHours('Lunch must be a positive interval contained within operating hours.');
  }

  return grossMinutes - (hours.lunchEndMinute - hours.lunchStartMinute);
}

function validateScheduleDays(days: readonly ScheduleDay[]): void {
  if (days.length !== WEEKDAYS.length) {
    throw new AttendanceConfigurationError(
      'INVALID_SCHEDULE_DAYS',
      'A schedule version must contain exactly seven weekdays.',
    );
  }

  const weekdays = new Set(days.map((day) => day.weekday));
  if (weekdays.size !== WEEKDAYS.length || WEEKDAYS.some((weekday) => !weekdays.has(weekday))) {
    throw new AttendanceConfigurationError(
      'INVALID_SCHEDULE_DAYS',
      'A schedule version must contain each weekday exactly once.',
    );
  }

  for (const day of days) {
    expectedMinutesForWorkHours(day);
  }
}

export function selectScheduleVersion(
  scheduleVersions: readonly ScheduleVersion[],
  businessDate: string,
): ScheduleVersion {
  assertBusinessDate(businessDate);
  const effectiveDates = new Set<string>();
  let selected: ScheduleVersion | null = null;

  for (const version of scheduleVersions) {
    assertBusinessDate(version.effectiveDate);

    if (effectiveDates.has(version.effectiveDate)) {
      throw new AttendanceConfigurationError(
        'DUPLICATE_SCHEDULE_EFFECTIVE_DATE',
        `More than one schedule is effective on ${version.effectiveDate}.`,
      );
    }

    effectiveDates.add(version.effectiveDate);

    if (
      compareBusinessDates(version.effectiveDate, businessDate) <= 0 &&
      (selected === null || compareBusinessDates(version.effectiveDate, selected.effectiveDate) > 0)
    ) {
      selected = version;
    }
  }

  if (selected === null) {
    throw new AttendanceConfigurationError(
      'MISSING_SCHEDULE_VERSION',
      `No schedule version is effective for ${businessDate}.`,
    );
  }

  validateScheduleDays(selected.days);
  return selected;
}

function latestExceptionRevision(
  exceptionRevisions: readonly CalendarExceptionRevision[],
  businessDate: string,
): CalendarExceptionRevision | null {
  for (const revision of exceptionRevisions) {
    assertBusinessDate(revision.businessDate);
  }

  const matching = exceptionRevisions.filter((revision) => revision.businessDate === businessDate);
  const sequences = new Set<number>();
  let latest: CalendarExceptionRevision | null = null;

  for (const revision of matching) {
    if (!Number.isSafeInteger(revision.sequence) || revision.sequence <= 0) {
      throw new AttendanceConfigurationError(
        'INVALID_EXCEPTION_REVISIONS',
        'Calendar exception revision sequences must be positive safe integers.',
      );
    }

    if (sequences.has(revision.sequence)) {
      throw new AttendanceConfigurationError(
        'INVALID_EXCEPTION_REVISIONS',
        `Calendar exception sequence ${revision.sequence} is duplicated.`,
      );
    }

    sequences.add(revision.sequence);
    if (latest === null || revision.sequence > latest.sequence) {
      latest = revision;
    }
  }

  const orderedSequences = [...sequences].sort((left, right) => left - right);
  if (orderedSequences.some((sequence, index) => sequence !== index + 1)) {
    throw new AttendanceConfigurationError(
      'INVALID_EXCEPTION_REVISIONS',
      'Calendar exception revision sequences must be contiguous from one.',
    );
  }

  if (latest === null) {
    return null;
  }

  if (latest.operation === 'RETRACT') {
    if (
      latest.kind !== null ||
      latest.name !== null ||
      latest.openingMinute !== null ||
      latest.closingMinute !== null ||
      latest.lunchEnabled ||
      latest.lunchStartMinute !== null ||
      latest.lunchEndMinute !== null
    ) {
      throw new AttendanceConfigurationError(
        'INVALID_EXCEPTION_REVISIONS',
        'A retraction cannot contain an active exception payload.',
      );
    }

    return null;
  }

  if (latest.kind === null || latest.name === null || latest.name.trim().length === 0) {
    throw new AttendanceConfigurationError(
      'INVALID_EXCEPTION_REVISIONS',
      'An active calendar exception requires a kind and name.',
    );
  }

  return latest;
}

function scheduleExpectation(
  businessDate: string,
  version: ScheduleVersion,
  day: ScheduleDay,
): ResolvedExpectation {
  const expectedMinutes = expectedMinutesForWorkHours(day);

  return {
    businessDate,
    source: 'WEEKLY_SCHEDULE',
    calendarStatus: day.isOpen ? null : 'DAY_OFF',
    expectedMinutes,
    isOpen: day.isOpen,
    openingMinute: day.openingMinute,
    closingMinute: day.closingMinute,
    lunchEnabled: day.lunchEnabled,
    lunchStartMinute: day.lunchStartMinute,
    lunchEndMinute: day.lunchEndMinute,
    scheduleVersionId: version.id,
    scheduleEffectiveDate: version.effectiveDate,
    exceptionRevisionId: null,
    exceptionName: null,
  };
}

export interface ResolveExpectationInput {
  businessDate: string;
  scheduleVersions: readonly ScheduleVersion[];
  exceptionRevisions?: readonly CalendarExceptionRevision[];
  vacation?: {
    id: string;
    startDate: string;
    endDate: string;
    note?: string | null;
  } | null;
}

export function resolveExpectation({
  businessDate,
  scheduleVersions,
  exceptionRevisions = [],
  vacation,
}: ResolveExpectationInput): ResolvedExpectation {
  const scheduleVersion = selectScheduleVersion(scheduleVersions, businessDate);
  const weekday = weekdayForBusinessDate(businessDate);
  const scheduleDay = scheduleVersion.days.find((day) => day.weekday === weekday);

  if (scheduleDay === undefined) {
    throw new AttendanceConfigurationError(
      'INVALID_SCHEDULE_DAYS',
      `Schedule ${scheduleVersion.id} does not define ${weekday}.`,
    );
  }

  const weeklyExpectation = scheduleExpectation(businessDate, scheduleVersion, scheduleDay);

  if (vacation) {
    if (
      compareBusinessDates(vacation.startDate, businessDate) <= 0 &&
      compareBusinessDates(businessDate, vacation.endDate) <= 0
    ) {
      return {
        ...weeklyExpectation,
        source: 'VACATION',
        calendarStatus: 'VACATION',
        expectedMinutes: 0,
        isOpen: false,
        openingMinute: null,
        closingMinute: null,
        lunchEnabled: false,
        lunchStartMinute: null,
        lunchEndMinute: null,
        exceptionRevisionId: null,
        exceptionName: vacation.note?.trim() || 'Férias',
      };
    }
  }

  const exception = latestExceptionRevision(exceptionRevisions, businessDate);

  if (exception === null) {
    return weeklyExpectation;
  }

  if (exception.kind === 'HOLIDAY' || exception.kind === 'CLOSED') {
    expectedMinutesForWorkHours({ ...exception, isOpen: false });

    return {
      ...weeklyExpectation,
      source: exception.kind,
      calendarStatus: exception.kind,
      expectedMinutes: 0,
      isOpen: false,
      openingMinute: null,
      closingMinute: null,
      lunchEnabled: false,
      lunchStartMinute: null,
      lunchEndMinute: null,
      exceptionRevisionId: exception.id,
      exceptionName: exception.name,
    };
  }

  if (exception.kind !== 'SPECIAL_HOURS') {
    throw new AttendanceConfigurationError(
      'INVALID_EXCEPTION_REVISIONS',
      'The active calendar exception kind is invalid.',
    );
  }

  const expectedMinutes = expectedMinutesForWorkHours({ ...exception, isOpen: true });
  return {
    ...weeklyExpectation,
    source: 'SPECIAL_HOURS',
    calendarStatus: null,
    expectedMinutes,
    isOpen: true,
    openingMinute: exception.openingMinute,
    closingMinute: exception.closingMinute,
    lunchEnabled: exception.lunchEnabled,
    lunchStartMinute: exception.lunchStartMinute,
    lunchEndMinute: exception.lunchEndMinute,
    exceptionRevisionId: exception.id,
    exceptionName: exception.name,
  };
}
