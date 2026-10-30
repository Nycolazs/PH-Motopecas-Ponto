import { AttendanceConfigurationError, AttendanceInputError } from './errors.js';
import { buildPunchChronology, resolveEffectivePunches } from './punches.js';
import type {
  AbsenceJustificationInfo,
  AttendancePunch,
  CalendarStatus,
  AttendanceStatus,
  DailyAttendanceSummary,
  ProvisionalWorkState,
  ResolvedExpectation,
} from './types.js';

/** Calendar statuses of a working day whose absence was justified (abono or atestado). */
export function isJustifiedAbsence(calendarStatus: CalendarStatus | null): boolean {
  return calendarStatus === 'ALLOWANCE' || calendarStatus === 'MEDICAL_LEAVE';
}

/**
 * Marks a working day as justified. Only regular working days are affected: days off,
 * holidays, closures and vacations already expect no work.
 */
export function applyAbsenceJustification(
  expectation: ResolvedExpectation,
  justification: AbsenceJustificationInfo | null,
): ResolvedExpectation {
  if (
    justification === null ||
    expectation.expectedMinutes === 0 ||
    expectation.calendarStatus !== null
  ) {
    return expectation;
  }
  const label = justification.kind === 'ALLOWANCE' ? 'Abono' : 'Atestado médico';
  const reason = justification.reason?.trim();
  return {
    ...expectation,
    calendarStatus: justification.kind === 'ALLOWANCE' ? 'ALLOWANCE' : 'MEDICAL_LEAVE',
    // Nobody is expected at the store: no late-arrival alert, not counted as missing today.
    isOpen: false,
    exceptionName: reason ? `${label}: ${reason}` : label,
  };
}

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
  // On a justified day the absent time is forgiven: only the hours actually worked are
  // expected, so the balance never goes negative while overtime still counts.
  const expectedMinutes = isJustifiedAbsence(expectation.calendarStatus)
    ? Math.min(expectation.expectedMinutes, chronology.workedMinutes)
    : expectation.expectedMinutes;

  if (isFinalized) {
    workState = null;

    if (chronology.isIncomplete) {
      status = 'INCOMPLETE';
      balanceMinutes = null;
    } else {
      balanceMinutes = chronology.workedMinutes - expectedMinutes;
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
      balanceMinutes = chronology.workedMinutes - expectedMinutes;
      status = expectation.calendarStatus ?? balanceStatus(balanceMinutes);
    }
  }

  return {
    businessDate,
    isFinalized,
    status,
    workState,
    expectedMinutes,
    workedMinutes: chronology.workedMinutes,
    balanceMinutes,
    punchCount: chronology.punchCount,
    completedIntervalCount: chronology.completedIntervalCount,
    correctionCount,
    expectation,
    chronology,
  };
}
