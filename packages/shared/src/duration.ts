/**
 * Formats an integer minute duration for compact pt-BR display.
 *
 * Attendance calculations remain responsible for producing authoritative integer
 * minutes; this helper only formats an already calculated duration.
 */
export function formatDurationMinutes(totalMinutes: number): string {
  if (!Number.isSafeInteger(totalMinutes)) {
    throw new RangeError('totalMinutes must be a safe integer');
  }

  if (totalMinutes === 0) {
    return '0min';
  }

  const sign = totalMinutes < 0 ? '-' : '';
  const absoluteMinutes = Math.abs(totalMinutes);
  const hours = Math.floor(absoluteMinutes / 60);
  const minutes = absoluteMinutes % 60;
  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }

  if (minutes > 0) {
    parts.push(`${minutes}min`);
  }

  return `${sign}${parts.join(' ')}`;
}

export const formatMinutesDuration = formatDurationMinutes;
