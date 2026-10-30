import { effectiveLimits, type RegimeOptions } from './regimes.js';
import { addDays, breakMinutes, mondayOf, type PlannedDay } from './patterns.js';

/**
 * Labour-law checks on a planned schedule. Each issue carries a pt-BR message ready for the
 * screen; codes stay stable for filtering and tests.
 *
 * Rules (CLT and EC 141):
 *   - weekly hours and daily hours within the regime in force (see regimes.ts);
 *   - rest days per week (DSR): 1 under 44 h, 2 under EC 141; holidays don't count as DSR;
 *   - at most 6 consecutive workdays (a rest day at least every 7 days);
 *   - 11 h between the end of a day and the start of the next (CLT art. 66);
 *   - break of 1–2 h for more than 6 h worked, 15 min for 4–6 h (CLT art. 71);
 *   - Sunday rest at least once every N weeks when the employee works Sundays
 *     (commerce: 3 weeks, Lei 10.101/2000 art. 6º; 2 weeks is the conservative choice for
 *     women, CLT art. 386).
 */

export type ComplianceCode =
  | 'WEEKLY_HOURS_EXCEEDED'
  | 'DAILY_HOURS_EXCEEDED'
  | 'NOT_ENOUGH_REST_DAYS'
  | 'TOO_MANY_CONSECUTIVE_WORKDAYS'
  | 'INTERSHIFT_REST_TOO_SHORT'
  | 'BREAK_TOO_SHORT'
  | 'BREAK_TOO_LONG'
  | 'NO_SUNDAY_REST';

export interface ComplianceIssue {
  code: ComplianceCode;
  severity: 'ERROR' | 'WARNING';
  /** First date the issue concerns (the Monday for weekly issues). */
  businessDate: string;
  message: string;
}

export interface ComplianceOptions extends RegimeOptions {
  /** Weeks within which at least one Sunday must be a rest day (3 = commerce rule). */
  sundayRestEveryWeeks: number;
  /** Dates that are holidays for this employee (they are not weekly rest days). */
  holidays?: ReadonlySet<string>;
}

const MIN_INTERSHIFT_REST = 11 * 60;
const MAX_CONSECUTIVE_WORKDAYS = 6;

function hours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

function dateBR(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Checks complete weeks (Monday–Sunday) of one employee. `days` must be consecutive dates;
 * partial weeks at the edges are only checked for daily rules.
 */
export function checkCompliance(
  days: readonly PlannedDay[],
  options: ComplianceOptions,
): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];
  const holidays = options.holidays ?? new Set<string>();
  const worked = (day: PlannedDay) => day.shift !== null && day.plannedMinutes > 0;

  // Daily rules.
  for (const [index, day] of days.entries()) {
    if (!worked(day) || day.shift === null) continue;
    const limits = effectiveLimits(day.businessDate, options);
    if (day.plannedMinutes > limits.dailyLimitMinutes) {
      issues.push({
        code: 'DAILY_HOURS_EXCEEDED',
        severity: 'ERROR',
        businessDate: day.businessDate,
        message: `${dateBR(day.businessDate)}: ${hours(day.plannedMinutes)} de trabalho, acima do limite de ${hours(limits.dailyLimitMinutes)} por dia${options.hasCollectiveAgreement ? '' : ' (sem acordo coletivo)'}.`,
      });
    }
    const pause = breakMinutes(day.shift);
    if (day.plannedMinutes > 6 * 60 && pause < 60) {
      issues.push({
        code: 'BREAK_TOO_SHORT',
        severity: 'ERROR',
        businessDate: day.businessDate,
        message: `${dateBR(day.businessDate)}: jornada acima de 6h precisa de pelo menos 1h de intervalo.`,
      });
    } else if (day.plannedMinutes > 4 * 60 && day.plannedMinutes <= 6 * 60 && pause < 15) {
      issues.push({
        code: 'BREAK_TOO_SHORT',
        severity: 'ERROR',
        businessDate: day.businessDate,
        message: `${dateBR(day.businessDate)}: jornada de 4h a 6h precisa de 15 min de intervalo.`,
      });
    }
    if (pause > 120) {
      issues.push({
        code: 'BREAK_TOO_LONG',
        severity: 'WARNING',
        businessDate: day.businessDate,
        message: `${dateBR(day.businessDate)}: intervalo de ${hours(pause)}; acima de 2h só com acordo.`,
      });
    }
    const next = days[index + 1];
    if (next?.shift && worked(next)) {
      const rest = 1440 - day.shift.endMinute + next.shift.startMinute;
      if (rest < MIN_INTERSHIFT_REST) {
        issues.push({
          code: 'INTERSHIFT_REST_TOO_SHORT',
          severity: 'ERROR',
          businessDate: next.businessDate,
          message: `${dateBR(next.businessDate)}: só ${hours(rest)} de descanso desde o fim do dia anterior (mínimo 11h).`,
        });
      }
    }
  }

  // Consecutive workdays.
  let streak = 0;
  for (const day of days) {
    streak = worked(day) ? streak + 1 : 0;
    if (streak === MAX_CONSECUTIVE_WORKDAYS + 1) {
      issues.push({
        code: 'TOO_MANY_CONSECUTIVE_WORKDAYS',
        severity: 'ERROR',
        businessDate: day.businessDate,
        message: `${dateBR(day.businessDate)}: 7º dia seguido de trabalho; é preciso uma folga a cada 7 dias.`,
      });
    }
  }

  // Weekly rules on complete weeks.
  const byDate = new Map(days.map((day) => [day.businessDate, day]));
  const mondays = [...new Set(days.map((day) => mondayOf(day.businessDate)))];
  const completeWeeks = mondays.filter((monday) =>
    Array.from({ length: 7 }, (_, offset) => addDays(monday, offset)).every((date) =>
      byDate.has(date),
    ),
  );
  for (const monday of completeWeeks) {
    const week = Array.from({ length: 7 }, (_, offset) => byDate.get(addDays(monday, offset))!);
    const limits = effectiveLimits(monday, options);
    const total = week.reduce((sum, day) => sum + day.plannedMinutes, 0);
    if (total > limits.weeklyLimitMinutes) {
      issues.push({
        code: 'WEEKLY_HOURS_EXCEEDED',
        severity: 'ERROR',
        businessDate: monday,
        message: `Semana de ${dateBR(monday)}: ${hours(total)} planejadas, acima do limite de ${hours(limits.weeklyLimitMinutes)} (${limits.regime.label}).`,
      });
    }
    const restDays = week.filter((day) => !worked(day) && !holidays.has(day.businessDate)).length;
    if (restDays < limits.minRestDaysPerWeek) {
      issues.push({
        code: 'NOT_ENOUGH_REST_DAYS',
        severity: 'ERROR',
        businessDate: monday,
        message: `Semana de ${dateBR(monday)}: ${restDays} folga(s); são necessárias ${limits.minRestDaysPerWeek} (feriado não conta como folga).`,
      });
    }
  }

  // Sunday rest frequency, checked on windows of complete weeks.
  const window = Math.max(1, options.sundayRestEveryWeeks);
  for (let start = 0; start + window <= completeWeeks.length; start += 1) {
    const sundays = completeWeeks
      .slice(start, start + window)
      .map((monday) => byDate.get(addDays(monday, 6))!);
    if (sundays.every((sunday) => worked(sunday))) {
      issues.push({
        code: 'NO_SUNDAY_REST',
        severity: 'WARNING',
        businessDate: sundays[0]!.businessDate,
        message: `Sem folga em domingo por ${window} semanas a partir de ${dateBR(sundays[0]!.businessDate)}.`,
      });
    }
  }

  return issues.sort(
    (left, right) =>
      left.businessDate.localeCompare(right.businessDate) || left.code.localeCompare(right.code),
  );
}
