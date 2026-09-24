import type { AttendancePunch } from '@ph-ponto/shared';

/** Derive effective directions without overwriting the original recorded direction. */
export function effectiveChronology(punches: readonly AttendancePunch[]): AttendancePunch[] {
  const effectiveTime = (punch: AttendancePunch): number => {
    const latest = [...(punch.adjustments ?? [])].sort((a, b) => b.sequence - a.sequence)[0];
    return new Date(latest?.correctedOccurredAt ?? punch.occurredAt).getTime();
  };
  return [...punches]
    .sort(
      (left, right) =>
        effectiveTime(left) - effectiveTime(right) || left.id.localeCompare(right.id),
    )
    .map((punch, index) => ({ ...punch, kind: index % 2 === 0 ? 'CLOCK_IN' : 'CLOCK_OUT' }));
}
