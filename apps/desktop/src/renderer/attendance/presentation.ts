import type { DailyAttendance } from '../api/contracts.js';

export const attendanceStatusLabels = {
  NORMAL: 'Normal',
  OVERTIME: 'Hora extra',
  MISSING_HOURS: 'Horas faltantes',
  INCOMPLETE: 'Ponto incompleto',
  HOLIDAY: 'Feriado',
  DAY_OFF: 'Folga',
  CLOSED: 'Fechado',
} as const;

export const workStateLabels = {
  NOT_STARTED: 'Ainda não iniciou',
  WORKING: 'Trabalhando',
  OFF_DUTY: 'Fora do expediente',
} as const;

export function dailyStateLabel(day: DailyAttendance): string {
  if (day.workState !== null) return workStateLabels[day.workState];
  if (day.status !== null) return attendanceStatusLabels[day.status];
  return 'Em andamento';
}

export function dailyStateTone(day: DailyAttendance): string {
  if (day.workState === 'WORKING' || day.status === 'NORMAL') return 'success';
  if (day.status === 'OVERTIME') return 'info';
  if (day.status === 'MISSING_HOURS' || day.status === 'INCOMPLETE') return 'danger';
  return 'neutral';
}
