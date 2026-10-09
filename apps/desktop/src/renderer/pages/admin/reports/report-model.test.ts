import { describe, expect, it } from 'vitest';

import type {
  DailyAttendance,
  TimesheetReport,
  TimesheetReportEmployee,
} from '../../../api/contracts.js';
import {
  buildTeamCsv,
  buildTimesheetCsv,
  countDaysInclusive,
  describeDay,
  filterTeamRows,
  formatCpf,
  formatMonthLabel,
  hasConfiguredCnpj,
  isExcludedFromTotals,
  punchColumnCount,
  resolveMonthRange,
  shiftMonth,
  slugify,
  sortTeamRows,
  validateCustomRange,
} from './report-model.js';

const PUNCH_IDS = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555',
  '66666666-6666-4666-8666-666666666666',
];

function day(
  overrides: Partial<DailyAttendance> & { punchTimes?: string[] } = {},
): DailyAttendance {
  const { punchTimes = [], ...rest } = overrides;
  const punches = punchTimes.map((iso, index) => ({
    id: PUNCH_IDS[index]!,
    kind: index % 2 === 0 ? ('CLOCK_IN' as const) : ('CLOCK_OUT' as const),
    originalOccurredAt: iso,
    effectiveOccurredAt: iso,
    appliedAdjustmentCount: 0,
  }));
  return {
    businessDate: '2026-09-01',
    isFinalized: true,
    status: 'NORMAL',
    workState: null,
    expectedMinutes: 480,
    workedMinutes: 480,
    balanceMinutes: 0,
    punchCount: punches.length,
    completedIntervalCount: Math.floor(punches.length / 2),
    correctionCount: 0,
    expectationSource: 'WEEKLY_SCHEDULE',
    calendarStatus: null,
    exceptionName: null,
    chronology: {
      punches,
      integrityIssues: [],
      intervals: [],
      punchCount: punches.length,
      completedIntervalCount: Math.floor(punches.length / 2),
      hasOpenInterval: punches.length % 2 === 1,
      isIncomplete: false,
      workedMilliseconds: 0,
      workedMinutes: 0,
    },
    ...rest,
  };
}

function totals(
  overrides: Partial<TimesheetReportEmployee['totals']> = {},
): TimesheetReportEmployee['totals'] {
  return {
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    finalizedDayCount: 1,
    completeDayCount: 1,
    incompleteDayCount: 0,
    provisionalDayCount: 0,
    expectedMinutes: 480,
    workedMinutes: 480,
    balanceMinutes: 0,
    overtimeMinutes: 0,
    missingMinutes: 0,
    knownPartialWorkedMinutes: 0,
    punchCount: 4,
    correctionCount: 0,
    statusCounts: {
      normal: 1,
      overtime: 0,
      missingHours: 0,
      incomplete: 0,
      holiday: 0,
      dayOff: 0,
      closed: 0,
      vacation: 0,
    },
    ...overrides,
  };
}

function employee(overrides: Partial<TimesheetReportEmployee> = {}): TimesheetReportEmployee {
  return {
    employeeId: '77777777-7777-4777-8777-777777777777',
    name: 'DIEGO PEREIRA DANTAS',
    login: 'diegodantas',
    isActive: true,
    hasAvatar: false,
    cpf: null,
    hireDate: null,
    roleTitle: 'Mecânico',
    department: 'Oficina',
    totals: totals(),
    days: null,
    ...overrides,
  };
}

describe('period helpers', () => {
  it('clamps the current month to today and rejects future months', () => {
    expect(resolveMonthRange('2026-10', '2026-10-09')).toEqual({
      from: '2026-10-01',
      to: '2026-10-09',
      isPartial: true,
    });
    expect(resolveMonthRange('2026-09', '2026-10-09')).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
      isPartial: false,
    });
    expect(resolveMonthRange('2024-02', '2026-10-09')?.to).toBe('2024-02-29');
    expect(resolveMonthRange('2026-11', '2026-10-09')).toBeNull();
    expect(resolveMonthRange('2026-13', '2026-10-09')).toBeNull();
  });

  it('shifts months across year boundaries and labels them in pt-BR', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2025-12', 1)).toBe('2026-01');
    expect(formatMonthLabel('2026-03')).toBe('Março de 2026');
  });

  it('validates custom ranges with actionable messages', () => {
    const today = '2026-10-09';
    expect(validateCustomRange('2026-09-01', '2026-09-30', today)).toBeNull();
    expect(validateCustomRange('', '2026-09-30', today)).toMatch(/Informe a data inicial/);
    expect(validateCustomRange('2026-02-30', '2026-03-01', today)).toMatch(/datas válidas/);
    expect(validateCustomRange('2026-09-30', '2026-09-01', today)).toMatch(/anterior ou igual/);
    expect(validateCustomRange('2026-10-01', '2026-10-10', today)).toMatch(/depois de hoje/);
    expect(validateCustomRange('2025-01-01', '2026-01-02', today)).toMatch(/366 dias/);
    expect(countDaysInclusive('2026-09-01', '2026-09-30')).toBe(30);
  });
});

describe('describeDay', () => {
  it('distinguishes absences, hour debits, overtime and pending days', () => {
    expect(describeDay(day({ status: 'MISSING_HOURS', punchCount: 0 }))).toEqual({
      label: 'Falta',
      tone: 'absence',
    });
    expect(
      describeDay(
        day({
          status: 'MISSING_HOURS',
          punchTimes: ['2026-09-01T11:00:00.000Z', '2026-09-01T15:00:00.000Z'],
        }),
      ).label,
    ).toBe('Débito de horas');
    expect(describeDay(day({ status: 'OVERTIME' })).label).toBe('Hora extra');
    expect(describeDay(day({ status: 'INCOMPLETE', balanceMinutes: null })).tone).toBe(
      'incomplete',
    );
    expect(describeDay(day({ isFinalized: false, status: null, punchCount: 0 })).label).toBe(
      'Aguardando',
    );
  });

  it('labels vacations, holidays and day offs without duplicating names', () => {
    expect(describeDay(day({ status: 'VACATION', calendarStatus: 'VACATION' })).label).toBe(
      'Férias',
    );
    expect(describeDay(day({ status: 'HOLIDAY', exceptionName: 'Feriado' })).label).toBe('Feriado');
    expect(describeDay(day({ status: 'HOLIDAY', exceptionName: 'Independência' })).label).toBe(
      'Feriado · Independência',
    );
    expect(describeDay(day({ status: 'DAY_OFF' })).label).toBe('Folga');
  });

  it('flags days that stay outside the consolidated totals', () => {
    expect(isExcludedFromTotals(day())).toBe(false);
    expect(isExcludedFromTotals(day({ isFinalized: false }))).toBe(true);
    expect(isExcludedFromTotals(day({ status: 'INCOMPLETE', balanceMinutes: null }))).toBe(true);
  });
});

describe('formatting helpers', () => {
  it('uses at least four punch columns and grows in entry/exit pairs', () => {
    expect(punchColumnCount([])).toBe(4);
    expect(
      punchColumnCount([
        day({
          punchTimes: [
            '2026-09-01T11:00:00.000Z',
            '2026-09-01T12:00:00.000Z',
            '2026-09-01T13:00:00.000Z',
            '2026-09-01T14:00:00.000Z',
            '2026-09-01T15:00:00.000Z',
          ],
        }),
      ]),
    ).toBe(6);
  });

  it('formats CPF, detects the placeholder CNPJ and builds safe filenames', () => {
    expect(formatCpf('12345678900')).toBe('123.456.789-00');
    expect(formatCpf(null)).toBeNull();
    expect(hasConfiguredCnpj({ cnpj: '00.000.000/0001-00' } as never)).toBe(false);
    expect(hasConfiguredCnpj({ cnpj: '12.345.678/0001-90' } as never)).toBe(true);
    expect(slugify('Ítalo Renan da Silva')).toBe('italo-renan-da-silva');
  });

  it('sorts accent-insensitively and searches by name, login or role', () => {
    const rows = [
      employee({ name: 'Ítalo', login: 'italo', totals: totals({ balanceMinutes: -30 }) }),
      employee({ name: 'Carlos', login: 'carlos', roleTitle: 'Atendente' }),
      employee({ name: 'Bruno', login: 'bruno', totals: totals({ balanceMinutes: 90 }) }),
    ];
    expect(sortTeamRows(rows, 'name', 'asc').map((row) => row.name)).toEqual([
      'Bruno',
      'Carlos',
      'Ítalo',
    ]);
    expect(sortTeamRows(rows, 'balance', 'asc').map((row) => row.name)).toEqual([
      'Ítalo',
      'Carlos',
      'Bruno',
    ]);
    expect(filterTeamRows(rows, 'italo').map((row) => row.name)).toEqual(['Ítalo']);
    expect(filterTeamRows(rows, 'atend').map((row) => row.name)).toEqual(['Carlos']);
  });
});

describe('CSV export', () => {
  const report: TimesheetReport = {
    from: '2026-09-01',
    to: '2026-09-30',
    generatedAt: '2026-10-01T12:00:00.000Z',
    employees: [
      employee({
        totals: totals({ balanceMinutes: -90, missingMinutes: 90 }),
        days: [
          day({
            punchTimes: [
              '2026-09-01T11:00:00.000Z',
              '2026-09-01T15:00:00.000Z',
              '2026-09-01T16:00:00.000Z',
              '2026-09-01T20:00:00.000Z',
            ],
          }),
        ],
      }),
    ],
    totals: totals({ balanceMinutes: -90, missingMinutes: 90 }),
  };

  it('produces Excel-friendly team spreadsheets with ASCII negative signs', () => {
    const csv = buildTeamCsv(report, null);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('Colaborador;Login;Cargo;Situação');
    expect(csv).toContain('Diego Pereira Dantas;diegodantas;Mecânico;Ativo;1;0;08:00;08:00;-01:30');
    expect(csv).not.toContain('−');
    expect(csv).toContain('\r\n');
  });

  it('exports the daily timesheet with punch columns in the business time zone', () => {
    const csv = buildTimesheetCsv(report, report.employees[0]!, null);
    expect(csv).toContain('Data;Dia;Ocorrência;Entrada 1;Saída 1;Entrada 2;Saída 2');
    expect(csv).toContain('01/09/2026;Ter;Normal;08:00;12:00;13:00;17:00;08:00;08:00;00:00');
  });
});
