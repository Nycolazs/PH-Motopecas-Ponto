export interface BusinessHours {
  isOpen: boolean;
  openingMinute: number | null;
  closingMinute: number | null;
  lunchEnabled: boolean;
  lunchStartMinute: number | null;
  lunchEndMinute: number | null;
}

export type BusinessHoursValidationError =
  | 'CLOSED_DAY_HAS_HOURS'
  | 'OPEN_DAY_MISSING_HOURS'
  | 'INVALID_OPEN_INTERVAL'
  | 'LUNCH_DISABLED_HAS_HOURS'
  | 'LUNCH_MISSING_HOURS'
  | 'INVALID_LUNCH_INTERVAL';

function isMinute(value: number | null, allowEndOfDay: boolean): value is number {
  return (
    value !== null &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= (allowEndOfDay ? 1_440 : 1_439)
  );
}

export function validateBusinessHours(hours: BusinessHours): BusinessHoursValidationError | null {
  if (typeof hours.isOpen !== 'boolean' || typeof hours.lunchEnabled !== 'boolean') {
    return 'OPEN_DAY_MISSING_HOURS';
  }

  if (!hours.isOpen) {
    return hours.openingMinute !== null ||
      hours.closingMinute !== null ||
      hours.lunchEnabled ||
      hours.lunchStartMinute !== null ||
      hours.lunchEndMinute !== null
      ? 'CLOSED_DAY_HAS_HOURS'
      : null;
  }

  if (hours.openingMinute === null || hours.closingMinute === null) {
    return 'OPEN_DAY_MISSING_HOURS';
  }

  if (
    !isMinute(hours.openingMinute, false) ||
    !isMinute(hours.closingMinute, true) ||
    hours.openingMinute >= hours.closingMinute
  ) {
    return 'INVALID_OPEN_INTERVAL';
  }

  if (!hours.lunchEnabled) {
    return hours.lunchStartMinute !== null || hours.lunchEndMinute !== null
      ? 'LUNCH_DISABLED_HAS_HOURS'
      : null;
  }

  if (hours.lunchStartMinute === null || hours.lunchEndMinute === null) {
    return 'LUNCH_MISSING_HOURS';
  }

  if (
    !isMinute(hours.lunchStartMinute, false) ||
    !isMinute(hours.lunchEndMinute, true) ||
    hours.lunchStartMinute < hours.openingMinute ||
    hours.lunchStartMinute >= hours.lunchEndMinute ||
    hours.lunchEndMinute > hours.closingMinute
  ) {
    return 'INVALID_LUNCH_INTERVAL';
  }

  return null;
}

export function calculateExpectedMinutes(hours: BusinessHours): number {
  if (!hours.isOpen) {
    return 0;
  }

  const validationError = validateBusinessHours(hours);
  if (validationError !== null || hours.openingMinute === null || hours.closingMinute === null) {
    throw new RangeError(`Invalid business hours: ${validationError ?? 'UNKNOWN'}`);
  }

  const lunchMinutes =
    hours.lunchEnabled && hours.lunchStartMinute !== null && hours.lunchEndMinute !== null
      ? hours.lunchEndMinute - hours.lunchStartMinute
      : 0;
  return hours.closingMinute - hours.openingMinute - lunchMinutes;
}
