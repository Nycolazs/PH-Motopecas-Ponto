const BUSINESS_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function utcDateParts(businessDate: string): { year: number; month: number; day: number } {
  const match = BUSINESS_DATE_PATTERN.exec(businessDate);
  if (match === null) {
    throw new RangeError('Business dates must use the YYYY-MM-DD format.');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const instant = new Date(0);
  instant.setUTCHours(0, 0, 0, 0);
  instant.setUTCFullYear(year, month - 1, day);

  if (
    instant.getUTCFullYear() !== year ||
    instant.getUTCMonth() !== month - 1 ||
    instant.getUTCDate() !== day
  ) {
    throw new RangeError('Business date does not exist in the Gregorian calendar.');
  }

  return { year, month, day };
}

export function isBusinessDate(value: string): boolean {
  try {
    utcDateParts(value);
    return true;
  } catch {
    return false;
  }
}

export function compareBusinessDates(first: string, second: string): number {
  utcDateParts(first);
  utcDateParts(second);
  return first.localeCompare(second);
}

export function addBusinessDateDays(businessDate: string, days: number): string {
  if (!Number.isSafeInteger(days)) {
    throw new RangeError('Business-date day offsets must be safe integers.');
  }

  const { year, month, day } = utcDateParts(businessDate);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day + days);
  const resultingYear = date.getUTCFullYear();
  if (resultingYear < 1 || resultingYear > 9_999) {
    throw new RangeError('Business-date arithmetic must remain between years 0001 and 9999.');
  }

  return `${String(resultingYear).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function enumerateBusinessDates(from: string, to: string, maximumDays: number): string[] {
  if (!Number.isSafeInteger(maximumDays) || maximumDays < 1) {
    throw new RangeError('The maximum business-date range must be a positive safe integer.');
  }

  if (compareBusinessDates(from, to) > 0) {
    throw new RangeError('The first business date must not be after the last business date.');
  }

  const dates: string[] = [];
  let current = from;
  while (compareBusinessDates(current, to) <= 0) {
    if (dates.length >= maximumDays) {
      throw new RangeError('The requested business-date range is too large.');
    }

    dates.push(current);
    if (current === to) {
      break;
    }
    current = addBusinessDateDays(current, 1);
  }

  return dates;
}

export function monthBusinessDateRange(month: string): { from: string; to: string } {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (match === null) {
    throw new RangeError('Months must use the YYYY-MM format.');
  }

  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (monthNumber < 1 || monthNumber > 12) {
    throw new RangeError('Month does not exist in the Gregorian calendar.');
  }

  const from = `${match[1]}-${match[2]}-01`;
  if (year === 9_999 && monthNumber === 12) {
    return { from, to: '9999-12-31' };
  }

  const nextMonth =
    monthNumber === 12
      ? `${String(year + 1).padStart(4, '0')}-01-01`
      : `${match[1]}-${String(monthNumber + 1).padStart(2, '0')}-01`;
  return { from, to: addBusinessDateDays(nextMonth, -1) };
}
