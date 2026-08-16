import { AttendanceInputError } from './errors.js';
import { assertBusinessDate, businessDateFromInstant, instantToDate } from './dates.js';
import type {
  AttendanceIntegrityIssue,
  AttendancePunch,
  EffectivePunch,
  EffectivePunchResolution,
  PunchChronology,
  WorkedInterval,
} from './types.js';

function issue(
  code: AttendanceIntegrityIssue['code'],
  punchId: string,
  message: string,
  adjustmentId?: string,
): AttendanceIntegrityIssue {
  return adjustmentId === undefined
    ? { code, punchId, message }
    : { code, punchId, adjustmentId, message };
}

function adjustmentIdentity(adjustment: { id?: string; sequence: number }): string | undefined {
  return adjustment.id ?? `sequence:${String(adjustment.sequence)}`;
}

export interface ResolveEffectivePunchesInput {
  businessDate: string;
  punches: readonly AttendancePunch[];
}

export function resolveEffectivePunches({
  businessDate,
  punches,
}: ResolveEffectivePunchesInput): EffectivePunchResolution {
  assertBusinessDate(businessDate);
  const integrityIssues: AttendanceIntegrityIssue[] = [];

  const parsedPunches = punches
    .map((punch) => ({
      punch,
      originalDate: instantToDate(punch.occurredAt),
    }))
    .sort((left, right) => {
      const instantComparison = left.originalDate.getTime() - right.originalDate.getTime();
      return instantComparison === 0
        ? left.punch.id.localeCompare(right.punch.id)
        : instantComparison;
    });

  const effectivePunches: EffectivePunch[] = parsedPunches.map(({ punch, originalDate }) => {
    let effectiveDate = originalDate;
    let expectedSequence = 1;
    let appliedAdjustmentCount = 0;

    if (businessDateFromInstant(originalDate) !== businessDate) {
      integrityIssues.push(
        issue(
          'PUNCH_OUTSIDE_BUSINESS_DATE',
          punch.id,
          'The original punch is outside the requested business date.',
        ),
      );
    }

    const adjustments = [...(punch.adjustments ?? [])].sort((left, right) => {
      if (left.sequence !== right.sequence) {
        return left.sequence - right.sequence;
      }

      return (left.id ?? '').localeCompare(right.id ?? '');
    });

    for (const adjustment of adjustments) {
      const adjustmentId = adjustmentIdentity(adjustment);
      if (!Number.isSafeInteger(adjustment.sequence) || adjustment.sequence !== expectedSequence) {
        integrityIssues.push(
          issue(
            'ADJUSTMENT_SEQUENCE_GAP',
            punch.id,
            'Adjustment sequences must be unique and contiguous from one.',
            adjustmentId,
          ),
        );
        break;
      }

      const previousDate = instantToDate(adjustment.previousOccurredAt);
      const correctedDate = instantToDate(adjustment.correctedOccurredAt);

      if (previousDate.getTime() !== effectiveDate.getTime()) {
        integrityIssues.push(
          issue(
            'ADJUSTMENT_LINEAGE_MISMATCH',
            punch.id,
            'An adjustment does not continue from the latest effective instant.',
            adjustmentId,
          ),
        );
        break;
      }

      if (correctedDate.getTime() === previousDate.getTime()) {
        integrityIssues.push(
          issue(
            'ADJUSTMENT_NO_CHANGE',
            punch.id,
            'An adjustment must change the effective instant.',
            adjustmentId,
          ),
        );
        break;
      }

      if (businessDateFromInstant(correctedDate) !== businessDate) {
        integrityIssues.push(
          issue(
            'ADJUSTMENT_CROSSES_BUSINESS_DATE',
            punch.id,
            'An adjustment cannot move a punch to another business date.',
            adjustmentId,
          ),
        );
        break;
      }

      effectiveDate = correctedDate;
      appliedAdjustmentCount += 1;
      expectedSequence += 1;
    }

    return {
      id: punch.id,
      kind: punch.kind,
      originalOccurredAt: originalDate.toISOString(),
      effectiveOccurredAt: effectiveDate.toISOString(),
      appliedAdjustmentCount,
    };
  });

  return { punches: effectivePunches, integrityIssues };
}

export function buildPunchChronology(resolution: EffectivePunchResolution): PunchChronology {
  const punches = [...resolution.punches];
  const integrityIssues = [...resolution.integrityIssues];

  for (let index = 0; index < punches.length; index += 1) {
    const punch = punches[index];
    if (punch === undefined) {
      continue;
    }

    const previous = punches[index - 1];
    if (
      previous !== undefined &&
      instantToDate(punch.effectiveOccurredAt).getTime() <=
        instantToDate(previous.effectiveOccurredAt).getTime()
    ) {
      integrityIssues.push(
        issue(
          'NON_INCREASING_INSTANT',
          punch.id,
          'Effective punch instants must remain strictly increasing.',
        ),
      );
    }

    const expectedKind = index % 2 === 0 ? 'CLOCK_IN' : 'CLOCK_OUT';
    if (punch.kind !== expectedKind) {
      integrityIssues.push(
        issue(
          index === 0 ? 'WRONG_FIRST_KIND' : 'REPEATED_KIND',
          punch.id,
          index === 0
            ? 'A punch sequence must start with CLOCK_IN.'
            : 'Punch kinds must alternate between CLOCK_IN and CLOCK_OUT.',
        ),
      );
    }
  }

  const intervals: WorkedInterval[] = [];
  let workedMilliseconds = 0;
  const hasNonIncreasingInstant = integrityIssues.some(
    (entry) => entry.code === 'NON_INCREASING_INSTANT',
  );

  for (let index = 0; !hasNonIncreasingInstant && index + 1 < punches.length; index += 2) {
    const clockIn = punches[index];
    const clockOut = punches[index + 1];

    if (clockIn?.kind !== 'CLOCK_IN' || clockOut?.kind !== 'CLOCK_OUT') {
      continue;
    }

    const startMilliseconds = instantToDate(clockIn.effectiveOccurredAt).getTime();
    const endMilliseconds = instantToDate(clockOut.effectiveOccurredAt).getTime();
    const elapsedMilliseconds = endMilliseconds - startMilliseconds;

    if (elapsedMilliseconds <= 0) {
      continue;
    }

    workedMilliseconds += elapsedMilliseconds;
    if (!Number.isSafeInteger(workedMilliseconds)) {
      throw new AttendanceInputError(
        'UNSAFE_DURATION',
        'The accumulated attendance duration is outside the safe integer range.',
      );
    }

    intervals.push({
      clockInPunchId: clockIn.id,
      clockOutPunchId: clockOut.id,
      clockInAt: clockIn.effectiveOccurredAt,
      clockOutAt: clockOut.effectiveOccurredAt,
      elapsedMilliseconds,
    });
  }

  const kindOrOrderIssue = integrityIssues.some((entry) =>
    ['NON_INCREASING_INSTANT', 'WRONG_FIRST_KIND', 'REPEATED_KIND'].includes(entry.code),
  );
  const hasOpenInterval =
    !kindOrOrderIssue && punches.length % 2 === 1 && punches.at(-1)?.kind === 'CLOCK_IN';

  return {
    punches,
    integrityIssues,
    intervals,
    punchCount: punches.length,
    completedIntervalCount: intervals.length,
    hasOpenInterval,
    isIncomplete: punches.length % 2 === 1 || integrityIssues.length > 0,
    workedMilliseconds,
    workedMinutes: Math.floor(workedMilliseconds / 60_000),
  };
}
