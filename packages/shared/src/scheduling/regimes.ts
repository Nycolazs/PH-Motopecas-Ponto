/**
 * Legal working-hour regimes and when each applies.
 *
 * Emenda Constitucional 141 (promulgated 2026-10-16, end of the 6x1 schedule):
 *   - 60 days after publication: two paid weekly rest days (5x2) and at most 42 h/week.
 *     During this transition a collective agreement (acordo/convenção coletiva) may extend
 *     the daily workday so the 42 h fit in five days (e.g. 8h24); without one the 8 h daily
 *     cap keeps five days at 40 h.
 *   - One year later: at most 40 h/week and 8 h/day.
 *   - No salary reduction; one of the rest days preferably on Sunday.
 *
 * Sources disagree on the first effective day (15 or 16 December 2026), so the dates are
 * data, not hard-coded logic: confirm them against the Diário Oficial before go-live and
 * the company can still override them in the settings.
 */

export type WorkHoursRegimeId = 'CLT_44H' | 'EC141_42H' | 'EC141_40H';

export interface WorkHoursRegime {
  id: WorkHoursRegimeId;
  /** pt-BR label shown to administrators. */
  label: string;
  /** First business date the regime applies (inclusive); `null` = since always. */
  effectiveFrom: string | null;
  weeklyLimitMinutes: number;
  /** Daily cap without a collective agreement (CF art. 7º, XIII / CLT art. 58). */
  dailyLimitMinutes: number;
  /** Daily cap allowed by a collective agreement, when the regime allows extending it. */
  agreementDailyLimitMinutes: number | null;
  /** Paid weekly rest days required (DSR). */
  minRestDaysPerWeek: number;
}

export const EC141_TRANSITION_START = '2026-12-15';
export const EC141_FINAL_START = '2027-12-15';

export const DEFAULT_WORK_HOURS_REGIMES: readonly WorkHoursRegime[] = [
  {
    id: 'CLT_44H',
    label: 'CLT atual: 44 horas semanais, 1 folga',
    effectiveFrom: null,
    weeklyLimitMinutes: 44 * 60,
    dailyLimitMinutes: 8 * 60,
    // Saturday compensation (e.g. 8h48 Mon–Fri) has long been allowed by agreement.
    agreementDailyLimitMinutes: 10 * 60,
    minRestDaysPerWeek: 1,
  },
  {
    id: 'EC141_42H',
    label: 'Transição EC 141: 42 horas semanais, 2 folgas',
    effectiveFrom: EC141_TRANSITION_START,
    weeklyLimitMinutes: 42 * 60,
    dailyLimitMinutes: 8 * 60,
    agreementDailyLimitMinutes: 8 * 60 + 24,
    minRestDaysPerWeek: 2,
  },
  {
    id: 'EC141_40H',
    label: 'EC 141: 40 horas semanais, 2 folgas',
    effectiveFrom: EC141_FINAL_START,
    weeklyLimitMinutes: 40 * 60,
    dailyLimitMinutes: 8 * 60,
    agreementDailyLimitMinutes: null,
    minRestDaysPerWeek: 2,
  },
];

export interface RegimeOptions {
  /** The company has a collective agreement extending the daily workday. */
  hasCollectiveAgreement: boolean;
  regimes?: readonly WorkHoursRegime[];
}

/** Regime in force on a business date (the latest whose start is on or before it). */
export function regimeForDate(
  businessDate: string,
  regimes: readonly WorkHoursRegime[] = DEFAULT_WORK_HOURS_REGIMES,
): WorkHoursRegime {
  let current: WorkHoursRegime | undefined;
  for (const regime of regimes) {
    if (regime.effectiveFrom === null || regime.effectiveFrom <= businessDate) {
      if (current === undefined || (regime.effectiveFrom ?? '') >= (current.effectiveFrom ?? '')) {
        current = regime;
      }
    }
  }
  if (current === undefined) throw new Error(`No working-hour regime for ${businessDate}.`);
  return current;
}

export interface EffectiveLimits {
  regime: WorkHoursRegime;
  dailyLimitMinutes: number;
  /** Weekly hours actually reachable: the legal cap or five capped days, whichever is lower. */
  weeklyLimitMinutes: number;
  minRestDaysPerWeek: number;
}

/**
 * Limits that apply on a date. Without a collective agreement the 42 h transition is, in
 * practice, 40 h: two rest days leave five workdays of at most 8 h.
 */
export function effectiveLimits(businessDate: string, options: RegimeOptions): EffectiveLimits {
  const regime = regimeForDate(businessDate, options.regimes);
  const dailyLimitMinutes =
    options.hasCollectiveAgreement && regime.agreementDailyLimitMinutes !== null
      ? regime.agreementDailyLimitMinutes
      : regime.dailyLimitMinutes;
  const workdays = 7 - regime.minRestDaysPerWeek;
  return {
    regime,
    dailyLimitMinutes,
    weeklyLimitMinutes: Math.min(regime.weeklyLimitMinutes, dailyLimitMinutes * workdays),
    minRestDaysPerWeek: regime.minRestDaysPerWeek,
  };
}
