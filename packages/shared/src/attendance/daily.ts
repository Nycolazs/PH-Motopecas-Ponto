import { AttendanceConfigurationError, AttendanceInputError } from './errors.js';
import { buildPunchChronology, resolveEffectivePunches } from './punches.js';
import type {
  AttendancePunch,
  AttendanceStatus,
  DailyAttendanceSummary,
  ProvisionalWorkState,
  ResolvedExpectation,
} from './types.js';

function balanceStatus(balanceMinutes: number): AttendanceStatus {
  if (balanceMinutes > 0) {
    return 'OVERTIME';
  }

  if (balanceMinutes < 0) {
    return 'MISSING_HOURS';
  }

  return 'NORMAL';
}

export interface CalculateDailyAttendanceInput {
  businessDate: string;
  expectation: ResolvedExpectation;
  punches: readonly AttendancePunch[];
  isFinalized: boolean;
}

export function calculateDailyAttendance({
  businessDate,
  expectation,
  punches,
  isFinalized,
}: CalculateDailyAttendanceInput): DailyAttendanceSummary {
  if (expectation.businessDate !== businessDate) {
    throw new AttendanceConfigurationError(
      'EXPECTATION_DATE_MISMATCH',
      'The resolved expectation belongs to a different business date.',
    );
  }

  if (!Number.isSafeInteger(expectation.expectedMinutes) || expectation.expectedMinutes < 0) {
    throw new AttendanceInputError(
      'UNSAFE_DURATION',
      'Expected attendance minutes must be a nonnegative safe integer.',
    );
  }

  const resolution = resolveEffectivePunches({ businessDate, punches });
  const chronology = buildPunchChronology(resolution);
  const correctionCount = chronology.punches.reduce(
    (total, punch) => total + punch.appliedAdjustmentCount,
    0,
  );

  let status: AttendanceStatus | null;
  let workState: ProvisionalWorkState | null;
  let balanceMinutes: number | null;

  if (isFinalized) {
    workState = null;

    if (chronology.isIncomplete) {
      status = 'INCOMPLETE';
      balanceMinutes = null;
    } else {
      balanceMinutes = chronology.workedMinutes - expectation.expectedMinutes;
      status = expectation.calendarStatus ?? balanceStatus(balanceMinutes);
    }
  } else {
    const isMiddayLunch =
      expectation.isOpen &&
      expectation.lunchEnabled &&
      !chronology.hasOpenInterval &&
      chronology.punchCount === 2;

    workState =
      chronology.punchCount === 0
        ? 'NOT_STARTED'
        : chronology.hasOpenInterval
          ? 'WORKING'
          : isMiddayLunch
            ? 'LUNCH'
            : 'OFF_DUTY';

    if (chronology.integrityIssues.length > 0) {
      status = 'INCOMPLETE';
      balanceMinutes = null;
    } else if (chronology.punchCount === 0 || chronology.hasOpenInterval || isMiddayLunch) {
      status = expectation.calendarStatus;
      balanceMinutes = null;
    } else {
      balanceMinutes = chronology.workedMinutes - expectation.expectedMinutes;
      status = expectation.calendarStatus ?? balanceStatus(balanceMinutes);
    }
  }

  return {
    businessDate,
    isFinalized,
    status,
    workState,
    expectedMinutes: expectation.expectedMinutes,
    workedMinutes: chronology.workedMinutes,
    balanceMinutes,
    punchCount: chronology.punchCount,
    completedIntervalCount: chronology.completedIntervalCount,
    correctionCount,
    expectation,
    chronology,
  };
}
