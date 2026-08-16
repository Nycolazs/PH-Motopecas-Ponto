export type AttendanceConfigurationErrorCode =
  | 'INVALID_BUSINESS_DATE'
  | 'MISSING_SCHEDULE_VERSION'
  | 'DUPLICATE_SCHEDULE_EFFECTIVE_DATE'
  | 'INVALID_SCHEDULE_DAYS'
  | 'INVALID_WORK_HOURS'
  | 'INVALID_EXCEPTION_REVISIONS'
  | 'EXPECTATION_DATE_MISMATCH';

export class AttendanceConfigurationError extends Error {
  public constructor(
    public readonly code: AttendanceConfigurationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AttendanceConfigurationError';
  }
}

export type AttendanceInputErrorCode =
  'INVALID_INSTANT' | 'UNSAFE_DURATION' | 'INVALID_MONTH' | 'MONTH_DATE_MISMATCH';

export class AttendanceInputError extends Error {
  public constructor(
    public readonly code: AttendanceInputErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AttendanceInputError';
  }
}
