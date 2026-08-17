import { BUSINESS_TIME_ZONE } from '@ph-ponto/shared';

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function businessDateFromInstant(instant: Date): string {
  if (!Number.isFinite(instant.getTime())) {
    throw new RangeError('A valid instant is required.');
  }

  const parts = Object.fromEntries(
    dateFormatter
      .formatToParts(instant)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year!}-${parts.month!}-${parts.day!}`;
}
