import type {
  CompanyDto,
  DailyAttendance,
  TimesheetReport,
  TimesheetReportEmployee,
} from '../../../api/contracts.js';
import {
  formatDateBR,
  formatDisplayName,
  formatInstantTime,
  formatMinutes,
  getWeekdayShortBR,
} from '../../../lib/format.js';

export type ReportView = 'team' | 'individual';
export type PeriodMode = 'month' | 'custom';

export interface ReportRange {
  from: string;
  to: string;
}

/** Longest period accepted by the attendance API (inclusive day count). */
export const MAX_REPORT_DAYS = 366;

/** Placeholder CNPJ created by the API when the company was never configured. */
export const PLACEHOLDER_CNPJ = '00.000.000/0001-00';

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isBusinessDateString(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function isBusinessMonthString(value: string): boolean {
  return MONTH_PATTERN.test(value);
}

export function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number];
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function formatMonthLabel(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number];
  return `${MONTH_NAMES[monthNumber - 1] ?? month} de ${year}`;
}

function lastDayOfMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number];
  const last = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return `${month}-${String(last).padStart(2, '0')}`;
}

export function countDaysInclusive(from: string, to: string): number {
  const toUtc = (value: string): number => {
    const [year, month, day] = value.split('-').map(Number) as [number, number, number];
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000) + 1;
}

/**
 * Resolves a calendar month to the queryable range. The current month is
 * clamped to today because the API never evaluates future business dates.
 */
export function resolveMonthRange(
  month: string,
  today: string,
): (ReportRange & { isPartial: boolean }) | null {
  if (!isBusinessMonthString(month)) return null;
  const from = `${month}-01`;
  if (from > today) return null;
  const end = lastDayOfMonth(month);
  return end > today ? { from, to: today, isPartial: true } : { from, to: end, isPartial: false };
}

/** Returns a pt-BR validation message, or null when the range can be queried. */
export function validateCustomRange(from: string, to: string, today: string): string | null {
  if (!from || !to) return 'Informe a data inicial e a data final.';
  if (!isBusinessDateString(from) || !isBusinessDateString(to)) {
    return 'Informe datas válidas no formato DD/MM/AAAA.';
  }
  if (from > to) return 'A data inicial deve ser anterior ou igual à data final.';
  if (to > today) return 'O período não pode terminar depois de hoje.';
  if (countDaysInclusive(from, to) > MAX_REPORT_DAYS) {
    return 'O período pode ter no máximo 366 dias.';
  }
  return null;
}

export type DayTone = 'ok' | 'extra' | 'absence' | 'debit' | 'incomplete' | 'off' | 'progress';

export interface DayStatus {
  label: string;
  tone: DayTone;
}

function withName(base: string, rawName: string | null | undefined): string {
  const name = rawName?.trim();
  if (!name || name.toLocaleLowerCase('pt-BR') === base.toLocaleLowerCase('pt-BR')) return base;
  return `${base} · ${name}`;
}

export function describeDay(day: DailyAttendance): DayStatus {
  const name = day.exceptionName;
  if (day.status === 'VACATION' || day.calendarStatus === 'VACATION') {
    return { label: 'Férias', tone: 'off' };
  }
  if (day.status === 'HOLIDAY' || (day.calendarStatus === 'HOLIDAY' && day.punchCount === 0)) {
    return { label: withName('Feriado', name), tone: 'off' };
  }
  if (day.status === 'CLOSED' || (day.calendarStatus === 'CLOSED' && day.punchCount === 0)) {
    return { label: withName('Fechado', name), tone: 'off' };
  }
  if (day.status === 'DAY_OFF') return { label: 'Folga', tone: 'off' };
  if (!day.isFinalized) {
    return day.punchCount === 0
      ? { label: 'Aguardando', tone: 'progress' }
      : { label: 'Em andamento', tone: 'progress' };
  }
  switch (day.status) {
    case 'INCOMPLETE':
      return { label: 'Incompleto', tone: 'incomplete' };
    case 'MISSING_HOURS':
      return day.punchCount === 0
        ? { label: 'Falta', tone: 'absence' }
        : { label: 'Débito de horas', tone: 'debit' };
    case 'OVERTIME':
      return { label: 'Hora extra', tone: 'extra' };
    case 'NORMAL':
      return { label: 'Normal', tone: 'ok' };
    default:
      return day.expectedMinutes === 0
        ? { label: 'Folga', tone: 'off' }
        : { label: 'Sem registro', tone: 'absence' };
  }
}

/** Days that are not part of the consolidated totals until they are finalized or fixed. */
export function isExcludedFromTotals(day: DailyAttendance): boolean {
  return !day.isFinalized || day.status === 'INCOMPLETE' || day.balanceMinutes === null;
}

export interface PunchCell {
  time: string;
  adjusted: boolean;
}

export function punchCells(day: DailyAttendance): PunchCell[] {
  return day.chronology.punches.map((punch) => ({
    time: formatInstantTime(punch.effectiveOccurredAt),
    adjusted: punch.appliedAdjustmentCount > 0,
  }));
}

/** Number of punch columns (always an even number, at least four) for a timesheet table. */
export function punchColumnCount(days: readonly DailyAttendance[]): number {
  const max = days.reduce((highest, day) => Math.max(highest, day.chronology.punches.length), 0);
  return Math.max(4, Math.ceil(max / 2) * 2);
}

export function formatCpf(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 11) return value;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function hasConfiguredCnpj(company: CompanyDto | null | undefined): boolean {
  return Boolean(company?.cnpj && company.cnpj !== PLACEHOLDER_CNPJ);
}

export function formatCompanyAddress(company: CompanyDto | null | undefined): string | null {
  if (!company) return null;
  const street = [company.addressStreet, company.addressNumber].filter(Boolean).join(', ');
  const cityState = [company.addressCity, company.addressState].filter(Boolean).join(' - ');
  const parts = [street, company.addressNeighborhood, cityState].filter((part): part is string =>
    Boolean(part && part.trim()),
  );
  return parts.length > 0 ? parts.join(' • ') : null;
}

export type TeamSortKey = 'name' | 'worked' | 'balance' | 'missing' | 'overtime';
export type SortDirection = 'asc' | 'desc';

export function sortTeamRows(
  rows: readonly TimesheetReportEmployee[],
  key: TeamSortKey,
  direction: SortDirection,
): TimesheetReportEmployee[] {
  const factor = direction === 'asc' ? 1 : -1;
  const value = (row: TimesheetReportEmployee): number => {
    switch (key) {
      case 'worked':
        return row.totals.workedMinutes;
      case 'balance':
        return row.totals.balanceMinutes;
      case 'missing':
        return row.totals.missingMinutes;
      case 'overtime':
        return row.totals.overtimeMinutes;
      default:
        return 0;
    }
  };
  return [...rows].sort((left, right) => {
    if (key !== 'name') {
      const diff = value(left) - value(right);
      if (diff !== 0) return diff * factor;
    }
    return left.name.localeCompare(right.name, 'pt-BR') * (key === 'name' ? factor : 1);
  });
}

export function filterTeamRows(
  rows: readonly TimesheetReportEmployee[],
  search: string,
): TimesheetReportEmployee[] {
  const term = normalizeSearch(search);
  if (!term) return [...rows];
  return rows.filter((row) =>
    [row.name, row.login, row.roleTitle ?? '', row.department ?? '']
      .map(normalizeSearch)
      .some((field) => field.includes(term)),
  );
}

function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR').trim();
}

// ---------------------------------------------------------------------------
// CSV export (semicolon separated with UTF-8 BOM so Excel pt-BR opens it cleanly)
// ---------------------------------------------------------------------------

function csvCell(value: string | number): string {
  // Spreadsheets only recognise the ASCII hyphen as a negative sign.
  const text = String(value).replace(/\u2212/g, '-');
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvLines(rows: ReadonlyArray<ReadonlyArray<string | number>>): string {
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(';')).join('\r\n') + '\r\n';
}

function companyLine(company: CompanyDto | null | undefined): string {
  if (!company) return 'PH Motopeças';
  return hasConfiguredCnpj(company)
    ? `${company.legalName} - CNPJ ${company.cnpj}`
    : company.legalName;
}

export function buildTeamCsv(report: TimesheetReport, company?: CompanyDto | null): string {
  const rows: Array<Array<string | number>> = [
    ['Resumo de ponto da equipe'],
    [companyLine(company)],
    [`Período: ${formatDateBR(report.from)} a ${formatDateBR(report.to)}`],
    [],
    [
      'Colaborador',
      'Login',
      'Cargo',
      'Situação',
      'Dias fechados',
      'Dias pendentes',
      'Previsto',
      'Trabalhado',
      'Saldo',
      'Horas extras',
      'Faltas e atrasos',
    ],
  ];
  for (const employee of report.employees) {
    const totals = employee.totals;
    rows.push([
      formatDisplayName(employee.name),
      employee.login,
      employee.roleTitle ?? '',
      employee.isActive ? 'Ativo' : 'Inativo',
      totals.completeDayCount,
      totals.incompleteDayCount + totals.provisionalDayCount,
      formatMinutes(totals.expectedMinutes),
      formatMinutes(totals.workedMinutes),
      formatMinutes(totals.balanceMinutes, true),
      formatMinutes(totals.overtimeMinutes),
      formatMinutes(totals.missingMinutes),
    ]);
  }
  const totals = report.totals;
  rows.push([
    'Total da equipe',
    '',
    '',
    '',
    totals.completeDayCount,
    totals.incompleteDayCount + totals.provisionalDayCount,
    formatMinutes(totals.expectedMinutes),
    formatMinutes(totals.workedMinutes),
    formatMinutes(totals.balanceMinutes, true),
    formatMinutes(totals.overtimeMinutes),
    formatMinutes(totals.missingMinutes),
  ]);
  return csvLines(rows);
}

export function buildTimesheetCsv(
  report: TimesheetReport,
  employee: TimesheetReportEmployee,
  company?: CompanyDto | null,
): string {
  const days = employee.days ?? [];
  const columns = punchColumnCount(days);
  const punchHeaders = Array.from({ length: columns }, (_, index) =>
    index % 2 === 0 ? `Entrada ${index / 2 + 1}` : `Saída ${(index + 1) / 2}`,
  );
  const rows: Array<Array<string | number>> = [
    ['Espelho de ponto'],
    [companyLine(company)],
    [`Colaborador: ${formatDisplayName(employee.name)} (@${employee.login})`],
    [`Período: ${formatDateBR(report.from)} a ${formatDateBR(report.to)}`],
    [],
    ['Data', 'Dia', 'Ocorrência', ...punchHeaders, 'Previsto', 'Trabalhado', 'Saldo'],
  ];
  for (const day of days) {
    const cells = punchCells(day);
    rows.push([
      formatDateBR(day.businessDate),
      getWeekdayShortBR(day.businessDate),
      describeDay(day).label,
      ...Array.from({ length: columns }, (_, index) => {
        const cell = cells[index];
        return cell ? `${cell.time}${cell.adjusted ? '*' : ''}` : '';
      }),
      formatMinutes(day.expectedMinutes),
      formatMinutes(day.workedMinutes),
      formatMinutes(day.balanceMinutes, true),
    ]);
  }
  const totals = employee.totals;
  rows.push(
    [],
    ['Totais do período (dias fechados)'],
    ['Previsto', formatMinutes(totals.expectedMinutes)],
    ['Trabalhado', formatMinutes(totals.workedMinutes)],
    ['Saldo', formatMinutes(totals.balanceMinutes, true)],
    ['Horas extras', formatMinutes(totals.overtimeMinutes)],
    ['Faltas e atrasos', formatMinutes(totals.missingMinutes)],
  );
  if (days.some((day) => punchCells(day).some((cell) => cell.adjusted))) {
    rows.push([], ['* Horário ajustado pela administração.']);
  }
  return csvLines(rows);
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function slugify(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'relatorio'
  );
}
