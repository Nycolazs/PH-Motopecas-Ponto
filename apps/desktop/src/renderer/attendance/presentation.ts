import type { DailyAttendance } from '../api/contracts.js';

export const attendanceStatusLabels = {
  NORMAL: 'Normal',
  OVERTIME: 'Hora extra',
  MISSING_HOURS: 'Horas faltantes',
  INCOMPLETE: 'Ponto incompleto',
  HOLIDAY: 'Feriado',
  DAY_OFF: 'Folga',
  CLOSED: 'Fechado',
  VACATION: 'Férias',
  ALLOWANCE: 'Abonado',
  MEDICAL_LEAVE: 'Atestado',
} as const;

/** Days whose absence an administrator excused with an abono or an atestado. */
export function isJustifiedStatus(status: string | null | undefined): boolean {
  return status === 'ALLOWANCE' || status === 'MEDICAL_LEAVE';
}

/**
 * Same rule as the API: only absences can be justified — a working day without any
 * punch, or a day with missing hours (worked part of it and left).
 */
export function canJustifyDay(day: {
  calendarStatus: string | null;
  expectedMinutes: number;
  punchCount: number;
  status: string | null;
}): boolean {
  return (
    day.calendarStatus === null &&
    day.expectedMinutes > 0 &&
    (day.punchCount === 0 || day.status === 'MISSING_HOURS')
  );
}

export const workStateLabels = {
  NOT_STARTED: 'Ainda não iniciou',
  WORKING: 'Trabalhando',
  LUNCH: 'Em almoço',
  OFF_DUTY: 'Fora do expediente',
} as const;

export function dailyStateLabel(day: DailyAttendance): string {
  if (
    isJustifiedStatus(day.status) &&
    (day.workState === null || day.workState === 'NOT_STARTED')
  ) {
    return attendanceStatusLabels[day.status!];
  }
  if (day.workState !== null) return workStateLabels[day.workState];
  if (day.status !== null) return attendanceStatusLabels[day.status];
  return 'Em andamento';
}

export function dailyStateTone(day: DailyAttendance): string {
  if (day.workState === 'WORKING' || day.status === 'NORMAL') return 'success';
  if (day.workState === 'LUNCH') return 'warning';
  if (day.status === 'OVERTIME') return 'info';
  if (day.status === 'MISSING_HOURS' || day.status === 'INCOMPLETE') return 'danger';
  return 'neutral';
}
