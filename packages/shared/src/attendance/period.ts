import { AttendanceInputError } from './errors.js';
import { assertBusinessDate } from './dates.js';
import type {
  AttendancePeriodSummary,
  AttendanceStatus,
  AttendanceStatusCounts,
  DailyAttendanceSummary,
  MonthlyAttendanceSummary,
} from './types.js';

function emptyStatusCounts(): AttendanceStatusCounts {
  return {
    normal: 0,
    overtime: 0,
    missingHours: 0,
    incomplete: 0,
    holiday: 0,
    dayOff: 0,
    closed: 0,
  };
}

function incrementStatus(counts: AttendanceStatusCounts, status: AttendanceStatus | null): void {
  switch (status) {
    case 'NORMAL':
      counts.normal += 1;
      break;
    case 'OVERTIME':
      counts.overtime += 1;
      break;
    case 'MISSING_HOURS':
      counts.missingHours += 1;
      break;
    case 'INCOMPLETE':
      counts.incomplete += 1;
      break;
    case 'HOLIDAY':
      counts.holiday += 1;
      break;
    case 'DAY_OFF':
      counts.dayOff += 1;
      break;
    case 'CLOSED':
      counts.closed += 1;
      break;
    case null:
      break;
  }
}

export function aggregateAttendancePeriod(
  summaries: readonly DailyAttendanceSummary[],
): AttendancePeriodSummary {
  const ordered = [...summaries].sort((left, right) =>
    left.businessDate.localeCompare(right.businessDate),
  );
  const statusCounts = emptyStatusCounts();
  let finalizedDayCount = 0;
  let completeDayCount = 0;
  let incompleteDayCount = 0;
  let provisionalDayCount = 0;
  let expectedMinutes = 0;
  let workedMinutes = 0;
  let balanceMinutes = 0;
  let overtimeMinutes = 0;
  let missingMinutes = 0;
  let knownPartialWorkedMinutes = 0;
  let punchCount = 0;
  let correctionCount = 0;

  for (const summary of ordered) {
    assertBusinessDate(summary.businessDate);
    punchCount += summary.punchCount;
    correctionCount += summary.correctionCount;

    if (!summary.isFinalized) {
      provisionalDayCount += 1;
      continue;
    }

    finalizedDayCount += 1;
    incrementStatus(statusCounts, summary.status);

    if (summary.status === 'INCOMPLETE' || summary.balanceMinutes === null) {
      incompleteDayCount += 1;
      knownPartialWorkedMinutes += summary.workedMinutes;
      continue;
    }

    completeDayCount += 1;
    expectedMinutes += summary.expectedMinutes;
    workedMinutes += summary.workedMinutes;
    balanceMinutes += summary.balanceMinutes;

    if (summary.balanceMinutes > 0) {
      overtimeMinutes += summary.balanceMinutes;
    } else if (summary.balanceMinutes < 0) {
      missingMinutes += Math.abs(summary.balanceMinutes);
    }
  }

  return {
    startDate: ordered.at(0)?.businessDate ?? null,
    endDate: ordered.at(-1)?.businessDate ?? null,
    finalizedDayCount,
    completeDayCount,
    incompleteDayCount,
    provisionalDayCount,
    expectedMinutes,
    workedMinutes,
    balanceMinutes,
    overtimeMinutes,
    missingMinutes,
    knownPartialWorkedMinutes,
    punchCount,
    correctionCount,
    statusCounts,
  };
}

export interface AggregateMonthlyAttendanceInput {
  year: number;
  month: number;
  summaries: readonly DailyAttendanceSummary[];
}

export function aggregateMonthlyAttendance({
  year,
  month,
  summaries,
}: AggregateMonthlyAttendanceInput): MonthlyAttendanceSummary {
  if (!Number.isSafeInteger(year) || year < 1 || year > 9_999) {
    throw new AttendanceInputError('INVALID_MONTH', 'Attendance year must be between 1 and 9999.');
  }

  if (!Number.isSafeInteger(month) || month < 1 || month > 12) {
    throw new AttendanceInputError('INVALID_MONTH', 'Attendance month must be between 1 and 12.');
  }

  const monthPrefix = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-`;
  if (summaries.some((summary) => !summary.businessDate.startsWith(monthPrefix))) {
    throw new AttendanceInputError(
      'MONTH_DATE_MISMATCH',
      'Every daily summary must belong to the requested month.',
    );
  }

  return {
    year,
    month,
    ...aggregateAttendancePeriod(summaries),
  };
}
