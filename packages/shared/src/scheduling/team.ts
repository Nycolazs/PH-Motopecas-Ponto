import type { Weekday } from '../attendance/types.js';
import { WEEKDAYS } from '../attendance/types.js';
import { checkCompliance, type ComplianceIssue, type ComplianceOptions } from './compliance.js';
import {
  planRange,
  type PatternWeek,
  type PlannedDay,
  type ScheduleOverride,
  type Shift,
  type WorkPattern,
} from './patterns.js';

/** When the store is open on a date (opening hours, not anybody's shift). */
export interface StoreHours {
  openMinute: number;
  closeMinute: number;
}

export interface TeamMemberPlan {
  employeeId: string;
  days: readonly PlannedDay[];
}

export interface CoverageGap {
  businessDate: string;
  startMinute: number;
  endMinute: number;
  present: number;
  required: number;
}

export interface DayCoverage {
  businessDate: string;
  /** Employees with a shift that day. */
  working: string[];
  /** Employees resting that day. */
  resting: string[];
  /** Fewest people present at any moment while the store is open. */
  minimumPresent: number;
  gaps: CoverageGap[];
}

const SLOT = 30;

function presentAt(shift: Shift, minute: number): boolean {
  if (minute < shift.startMinute || minute >= shift.endMinute) return false;
  return !(
    shift.breakStartMinute !== null &&
    shift.breakEndMinute !== null &&
    minute >= shift.breakStartMinute &&
    minute < shift.breakEndMinute
  );
}

/**
 * Who is in the store during opening hours, in 30-minute slots. Gaps are periods with fewer
 * people than `minimumStaff` (lunch breaks included, so staggered lunches show up).
 */
export function coverageFor(
  team: readonly TeamMemberPlan[],
  storeHours: ReadonlyMap<string, StoreHours | null>,
  minimumStaff: number,
): DayCoverage[] {
  const dates = [
    ...new Set(team.flatMap((member) => member.days.map((day) => day.businessDate))),
  ].sort();
  return dates.map((businessDate) => {
    const dayOf = (member: TeamMemberPlan) =>
      member.days.find((day) => day.businessDate === businessDate);
    const working = team
      .filter((member) => dayOf(member)?.shift)
      .map((member) => member.employeeId);
    const resting = team
      .filter((member) => !dayOf(member)?.shift)
      .map((member) => member.employeeId);
    const hours = storeHours.get(businessDate) ?? null;
    if (hours === null) return { businessDate, working, resting, minimumPresent: 0, gaps: [] };

    const gaps: CoverageGap[] = [];
    let minimumPresent = Number.POSITIVE_INFINITY;
    for (let minute = hours.openMinute; minute < hours.closeMinute; minute += SLOT) {
      const present = team.filter((member) => {
        const shift = dayOf(member)?.shift;
        return shift ? presentAt(shift, minute) : false;
      }).length;
      minimumPresent = Math.min(minimumPresent, present);
      if (present < minimumStaff) {
        const end = Math.min(minute + SLOT, hours.closeMinute);
        const last = gaps.at(-1);
        if (last && last.endMinute === minute && last.present === present) last.endMinute = end;
        else
          gaps.push({
            businessDate,
            startMinute: minute,
            endMinute: end,
            present,
            required: minimumStaff,
          });
      }
    }
    return {
      businessDate,
      working,
      resting,
      minimumPresent: Number.isFinite(minimumPresent) ? minimumPresent : 0,
      gaps,
    };
  });
}

export interface RestDaySuggestionInput {
  employeeIds: readonly string[];
  /** Days the store opens; the second day off is chosen among them. */
  openWeekdays: readonly Weekday[];
  /** Days everybody already rests (e.g. Sunday when the store is closed). */
  sharedRestWeekdays: readonly Weekday[];
  /** People needed in the store on each open day. */
  minimumStaff: number;
  /** Rotate the extra day off every week so nobody always gets the same day. */
  rotate: boolean;
}

export interface RestDaySuggestion {
  employeeId: string;
  /** Extra day off per cycle week (length 1 when not rotating). */
  extraRestDays: Weekday[];
}

/**
 * Spreads each employee's second day off over the open days so the store stays covered.
 * Balanced: each open day gets at most ceil(n / openDays) people off, never leaving fewer
 * than `minimumStaff` working. With `rotate`, everyone walks through all open days.
 */
export function suggestRestDays(input: RestDaySuggestionInput): RestDaySuggestion[] {
  const open = input.openWeekdays.filter((day) => !input.sharedRestWeekdays.includes(day));
  if (open.length === 0) throw new Error('A loja precisa abrir em pelo menos um dia.');
  const team = input.employeeIds.length;
  const maxOffPerDay = Math.max(0, team - input.minimumStaff);
  if (maxOffPerDay * open.length < team) {
    throw new Error(
      `Com ${team} colaborador(es) e mínimo de ${input.minimumStaff} por dia não há como dar a segunda folga a todos.`,
    );
  }
  const slots = open.map((day) => ({ day, count: 0 }));
  return input.employeeIds.map((employeeId) => {
    const slot = slots
      .filter((item) => item.count < maxOffPerDay)
      .sort(
        (left, right) =>
          left.count - right.count || open.indexOf(left.day) - open.indexOf(right.day),
      )[0]!;
    slot.count += 1;
    if (!input.rotate) return { employeeId, extraRestDays: [slot.day] };
    const start = open.indexOf(slot.day);
    return {
      employeeId,
      extraRestDays: open.map((_, week) => open[(start + week) % open.length]!),
    };
  });
}

/** Builds the pattern weeks for a suggestion from the shifts of each weekday. */
export function patternWeeksFor(
  shifts: Readonly<Record<Weekday, Shift | null>>,
  sharedRestWeekdays: readonly Weekday[],
  extraRestDays: readonly Weekday[],
): PatternWeek[] {
  return extraRestDays.map((extra) => {
    const week = {} as Record<Weekday, Shift | null>;
    for (const weekday of WEEKDAYS) {
      week[weekday] =
        sharedRestWeekdays.includes(weekday) || weekday === extra ? null : shifts[weekday];
    }
    return week;
  });
}

export interface SwapProposal {
  /** Dates on which the two employees exchange what they had planned. */
  dates: readonly string[];
  swapId: string;
}

export interface SwapResult {
  overridesA: ScheduleOverride[];
  overridesB: ScheduleOverride[];
  issuesA: ComplianceIssue[];
  issuesB: ComplianceIssue[];
  /** True when neither employee ends up with an error. */
  allowed: boolean;
}

/**
 * Troca de folga: on each date A takes B's planned day and B takes A's, so the store keeps
 * the same coverage. A day off is usually swapped together with a workday so both keep two
 * rest days that week. Both schedules are re-checked before the swap is accepted.
 */
export function simulateSwap(
  employeeA: { pattern: WorkPattern; overrides: readonly ScheduleOverride[] },
  employeeB: { pattern: WorkPattern; overrides: readonly ScheduleOverride[] },
  proposal: SwapProposal,
  checkWindow: { from: string; to: string },
  options: ComplianceOptions,
): SwapResult {
  const planA = planRange(employeeA.pattern, employeeA.overrides, checkWindow.from, checkWindow.to);
  const planB = planRange(employeeB.pattern, employeeB.overrides, checkWindow.from, checkWindow.to);
  const dayOn = (plan: PlannedDay[], date: string) => {
    const day = plan.find((item) => item.businessDate === date);
    if (day === undefined) throw new Error(`A data ${date} está fora do período verificado.`);
    return day;
  };
  const overridesA: ScheduleOverride[] = [];
  const overridesB: ScheduleOverride[] = [];
  for (const date of proposal.dates) {
    const a = dayOn(planA, date);
    const b = dayOn(planB, date);
    overridesA.push({
      businessDate: date,
      shift: b.shift,
      reason: 'SWAP',
      swapId: proposal.swapId,
    });
    overridesB.push({
      businessDate: date,
      shift: a.shift,
      reason: 'SWAP',
      swapId: proposal.swapId,
    });
  }
  const merge = (base: readonly ScheduleOverride[], extra: ScheduleOverride[]) => [
    ...base.filter((item) => !proposal.dates.includes(item.businessDate)),
    ...extra,
  ];
  const nextA = planRange(
    employeeA.pattern,
    merge(employeeA.overrides, overridesA),
    checkWindow.from,
    checkWindow.to,
  );
  const nextB = planRange(
    employeeB.pattern,
    merge(employeeB.overrides, overridesB),
    checkWindow.from,
    checkWindow.to,
  );
  const issuesA = checkCompliance(nextA, options);
  const issuesB = checkCompliance(nextB, options);
  const hasError = (issues: ComplianceIssue[]) =>
    issues.some((issue) => issue.severity === 'ERROR');
  return {
    overridesA,
    overridesB,
    issuesA,
    issuesB,
    allowed: !hasError(issuesA) && !hasError(issuesB),
  };
}
