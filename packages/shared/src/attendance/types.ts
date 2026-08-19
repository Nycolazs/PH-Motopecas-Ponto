export const WEEKDAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export interface LocalWorkHours {
  isOpen: boolean;
  openingMinute: number | null;
  closingMinute: number | null;
  lunchEnabled: boolean;
  lunchStartMinute: number | null;
  lunchEndMinute: number | null;
}

export interface ScheduleDay extends LocalWorkHours {
  weekday: Weekday;
}

export interface ScheduleVersion {
  id: string;
  effectiveDate: string;
  days: readonly ScheduleDay[];
}

export const CALENDAR_EXCEPTION_OPERATIONS = ['UPSERT', 'RETRACT'] as const;
export type CalendarExceptionOperation = (typeof CALENDAR_EXCEPTION_OPERATIONS)[number];

export const CALENDAR_EXCEPTION_KINDS = ['HOLIDAY', 'CLOSED', 'SPECIAL_HOURS'] as const;
export type CalendarExceptionKind = (typeof CALENDAR_EXCEPTION_KINDS)[number];

export interface CalendarExceptionRevision {
  id: string;
  businessDate: string;
  sequence: number;
  operation: CalendarExceptionOperation;
  kind: CalendarExceptionKind | null;
  name: string | null;
  openingMinute: number | null;
  closingMinute: number | null;
  lunchEnabled: boolean;
  lunchStartMinute: number | null;
  lunchEndMinute: number | null;
}

export const EXPECTATION_SOURCES = [
  'WEEKLY_SCHEDULE',
  'HOLIDAY',
  'CLOSED',
  'SPECIAL_HOURS',
  'VACATION',
] as const;
export type ExpectationSource = (typeof EXPECTATION_SOURCES)[number];

export const CALENDAR_STATUSES = ['HOLIDAY', 'DAY_OFF', 'CLOSED', 'VACATION'] as const;
export type CalendarStatus = (typeof CALENDAR_STATUSES)[number];

export interface EmployeeVacationInfo {
  id: string;
  startDate: string;
  endDate: string;
  note?: string | null;
}

export interface ResolvedExpectation extends LocalWorkHours {
  businessDate: string;
  expectedMinutes: number;
  source: ExpectationSource;
  calendarStatus: CalendarStatus | null;
  scheduleVersionId: string;
  scheduleEffectiveDate: string;
  exceptionRevisionId: string | null;
  exceptionName: string | null;
}

export type InstantInput = Date | string;

export const ATTENDANCE_PUNCH_KINDS = ['CLOCK_IN', 'CLOCK_OUT'] as const;
export type AttendancePunchKind = (typeof ATTENDANCE_PUNCH_KINDS)[number];

export interface AttendanceAdjustment {
  id?: string;
  sequence: number;
  previousOccurredAt: InstantInput;
  correctedOccurredAt: InstantInput;
}

export interface AttendancePunch {
  id: string;
  kind: AttendancePunchKind;
  occurredAt: InstantInput;
  adjustments?: readonly AttendanceAdjustment[];
}

export interface EffectivePunch {
  id: string;
  kind: AttendancePunchKind;
  originalOccurredAt: string;
  effectiveOccurredAt: string;
  appliedAdjustmentCount: number;
}

export const ATTENDANCE_INTEGRITY_CODES = [
  'PUNCH_OUTSIDE_BUSINESS_DATE',
  'ADJUSTMENT_SEQUENCE_GAP',
  'ADJUSTMENT_LINEAGE_MISMATCH',
  'ADJUSTMENT_NO_CHANGE',
  'ADJUSTMENT_CROSSES_BUSINESS_DATE',
  'NON_INCREASING_INSTANT',
  'WRONG_FIRST_KIND',
  'REPEATED_KIND',
] as const;
export type AttendanceIntegrityCode = (typeof ATTENDANCE_INTEGRITY_CODES)[number];

export interface AttendanceIntegrityIssue {
  code: AttendanceIntegrityCode;
  punchId: string;
  adjustmentId?: string;
  message: string;
}

export interface EffectivePunchResolution {
  punches: readonly EffectivePunch[];
  integrityIssues: readonly AttendanceIntegrityIssue[];
}

export interface WorkedInterval {
  clockInPunchId: string;
  clockOutPunchId: string;
  clockInAt: string;
  clockOutAt: string;
  elapsedMilliseconds: number;
}

export interface PunchChronology extends EffectivePunchResolution {
  intervals: readonly WorkedInterval[];
  punchCount: number;
  completedIntervalCount: number;
  hasOpenInterval: boolean;
  isIncomplete: boolean;
  workedMilliseconds: number;
  workedMinutes: number;
}

export const ATTENDANCE_STATUSES = [
  'NORMAL',
  'OVERTIME',
  'MISSING_HOURS',
  'INCOMPLETE',
  'HOLIDAY',
  'DAY_OFF',
  'CLOSED',
  'VACATION',
] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const PROVISIONAL_WORK_STATES = ['NOT_STARTED', 'WORKING', 'LUNCH', 'OFF_DUTY'] as const;
export type ProvisionalWorkState = (typeof PROVISIONAL_WORK_STATES)[number];

export interface DailyAttendanceSummary {
  businessDate: string;
  isFinalized: boolean;
  status: AttendanceStatus | null;
  workState: ProvisionalWorkState | null;
  expectedMinutes: number;
  workedMinutes: number;
  balanceMinutes: number | null;
  punchCount: number;
  completedIntervalCount: number;
  correctionCount: number;
  expectation: ResolvedExpectation;
  chronology: PunchChronology;
}

export interface AttendanceStatusCounts {
  normal: number;
  overtime: number;
  missingHours: number;
  incomplete: number;
  holiday: number;
  dayOff: number;
  closed: number;
  vacation: number;
}

export interface AttendancePeriodSummary {
  startDate: string | null;
  endDate: string | null;
  finalizedDayCount: number;
  completeDayCount: number;
  incompleteDayCount: number;
  provisionalDayCount: number;
  expectedMinutes: number;
  workedMinutes: number;
  balanceMinutes: number;
  overtimeMinutes: number;
  missingMinutes: number;
  knownPartialWorkedMinutes: number;
  punchCount: number;
  correctionCount: number;
  statusCounts: AttendanceStatusCounts;
}

export interface MonthlyAttendanceSummary extends AttendancePeriodSummary {
  year: number;
  month: number;
}

export type BusinessDateClassification = 'FINALIZED' | 'CURRENT' | 'FUTURE';
