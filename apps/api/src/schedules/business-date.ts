import { Weekday } from '../generated/prisma/client.js';

export const BUSINESS_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const WEEKDAYS_BY_UTC_DAY = Object.freeze([
  Weekday.SUNDAY,
  Weekday.MONDAY,
  Weekday.TUESDAY,
  Weekday.WEDNESDAY,
  Weekday.THURSDAY,
  Weekday.FRIDAY,
  Weekday.SATURDAY,
]);

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return days[month - 1] ?? 0;
}

export function isBusinessDate(value: string): boolean {
  if (!BUSINESS_DATE_PATTERN.test(value)) {
    return false;
  }

  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

export function businessDateToDatabaseDate(value: string): Date {
  if (!isBusinessDate(value)) {
    throw new RangeError('Invalid business date');
  }

  const [yearText, monthText, dayText] = value.split('-');
  const date = new Date(0);
  date.setUTCFullYear(Number(yearText), Number(monthText) - 1, Number(dayText));
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export function databaseDateToBusinessDate(value: Date): string {
  const year = String(value.getUTCFullYear()).padStart(4, '0');
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function weekdayForBusinessDate(value: string): Weekday {
  const weekday = WEEKDAYS_BY_UTC_DAY[businessDateToDatabaseDate(value).getUTCDay()];
  if (weekday === undefined) {
    throw new RangeError('Invalid weekday');
  }

  return weekday;
}
