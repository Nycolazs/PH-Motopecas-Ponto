import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileSpreadsheet,
  FileText,
  Printer,
  RefreshCw,
} from 'lucide-react';

import type { DailyAttendance, EffectivePunch, ManagedUser } from '../../api/contracts.js';
import { useApiClient } from '../../auth/use-auth.js';
import { DateInput } from '../../components/date-input.js';
import { SelectInput } from '../../components/select-input.js';
import { useToast } from '../../components/toast-context.js';
import {
  formatDateBR,
  formatDateTimeBR,
  getWeekdayShortBR,
} from '../../lib/format.js';
import { formatMinutesDuration } from '@ph-ponto/shared';
import logoUrl from '../../assets/phmotos-logo.png';

function getTodayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getStartOfMonthString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

function getPreviousMonthRange(): { from: string; to: string } {
  const d = new Date();
  const prevMonthDate = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  const y = prevMonthDate.getFullYear();
  const m = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(y, prevMonthDate.getMonth() + 1, 0).getDate();
  return {
    from: `${y}-${m}-01`,
    to: `${y}-${m}-${String(lastDay).padStart(2, '0')}`,
  };
}

function getStatusLabel(status: string | null | undefined, workState: string | null | undefined): string {
  if (status === 'HOLIDAY') return 'Feriado';
  if (status === 'DAY_OFF') return 'Folga';
  if (status === 'CLOSED') return 'Fechado';
  if (status === 'NORMAL') return 'Normal';
  if (status === 'OVERTIME') return 'Horas Extras';
  if (status === 'MISSING_HOURS') return 'Falta / Atraso';
  if (status === 'INCOMPLETE') return 'Incompleto';
  if (workState === 'NOT_STARTED') return 'Sem registro';
  if (workState === 'WORKING') return 'Em andamento';
  if (workState === 'OFF_DUTY') return 'Encerrado';
  return status ?? workState ?? 'Normal';
}

export function AdminReportsPage(): React.JSX.Element {
  const api = useApiClient();
  const toast = useToast();

  const [fromDate, setFromDate] = useState(getStartOfMonthString);
  const [toDate, setToDate] = useState(getTodayString);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

  const { data: employeesList } = useQuery({
    queryKey: ['admin-employees-select'],
    queryFn: () => api.getEmployees({ limit: 100 }),
  });

  const { data: periodData, isLoading: periodLoading } = useQuery({
    queryKey: ['admin-report-period', selectedEmployeeId, fromDate, toDate],
    queryFn: () => {
      if (selectedEmployeeId) {
        return api.getAdminEmployeeHistory(selectedEmployeeId, fromDate, toDate);
      }
      return null;
    },
    enabled: Boolean(selectedEmployeeId && fromDate && toDate),
  });

  const handleExportCsv = (): void => {
    if (!periodData || !selectedEmployeeId) {
      toast.error('Selecione um colaborador para exportar o relatório.');
      return;
    }

    const employee = employeesList?.items.find((e: ManagedUser) => e.id === selectedEmployeeId);
    const headers = [
      'Data',
      'Dia',
      'Status',
      'Previsto (min)',
      'Trabalhado (min)',
      'Saldo (min)',
      'Qtd Batidas',
      'Horarios',
    ];
    const rows = periodData.days.map((d: DailyAttendance) => [
      formatDateBR(d.businessDate),
      getWeekdayShortBR(d.businessDate),
      getStatusLabel(d.status, d.workState),
      String(d.expectedMinutes),
      String(d.workedMinutes),
      String(d.balanceMinutes ?? 0),
      String(d.punchCount),
      `"${d.chronology.punches
        .map((p: EffectivePunch) =>
          new Date(p.effectiveOccurredAt).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        )
        .join(' - ')}"`,
    ]);

    const csvContent = [
      `Relatório de Espelho de Ponto - PH Motopeças`,
      `Colaborador: ${employee?.name ?? ''} (${employee?.login ?? ''})`,
      `Período de Apuração: ${formatDateBR(fromDate)} a ${formatDateBR(toDate)}`,
      `Emitido em: ${formatDateTimeBR(new Date())}`,
      ``,
      headers.join(','),
      ...rows.map((r: string[]) => r.join(',')),
      ``,
      `Totais Consolidados:`,
      `Horas Esperadas,${formatMinutesDuration(periodData.totals.expectedMinutes)}`,
      `Horas Trabalhadas,${formatMinutesDuration(periodData.totals.workedMinutes)}`,
      `Saldo Total,${formatMinutesDuration(periodData.totals.balanceMinutes)}`,
      `Horas Extras,${formatMinutesDuration(periodData.totals.overtimeMinutes)}`,
      `Horas Faltantes / Atrasos,${formatMinutesDuration(periodData.totals.missingMinutes)}`,
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `espelho-ponto-${employee?.login ?? 'geral'}-${fromDate}-${toDate}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Arquivo CSV exportado com sucesso!');
  };

  const handlePrint = (): void => {
    window.print();
  };

  const handleSetThisMonth = (): void => {
    setFromDate(getStartOfMonthString());
    setToDate(getTodayString());
  };

  const handleSetPrevMonth = (): void => {
    const { from, to } = getPreviousMonthRange();
    setFromDate(from);
    setToDate(to);
  };

  const selectedEmployeeObj = employeesList?.items.find(
    (e: ManagedUser) => e.id === selectedEmployeeId,
  );

  return (
    <div className="space-y-6">
      {/* Top Header Controls (Hidden on print) */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center">
            <FileText className="w-5 h-5 mr-2 text-blue-600" /> Relatórios e Espelho de Ponto
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Gere espelhos de ponto oficiais em PDF para impressão e exporte dados consolidados em CSV
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={!periodData || periodLoading}
            className="secondary-button text-xs py-2 px-3.5 disabled:opacity-40 flex items-center font-medium cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 mr-1.5 text-emerald-600" />
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={handlePrint}
            disabled={!periodData || periodLoading}
            className="primary-button text-xs py-2 px-3.5 disabled:opacity-40 flex items-center font-semibold cursor-pointer shadow-sm"
          >
            <Printer className="w-4 h-4 mr-1.5" />
            Imprimir / Salvar PDF
          </button>
        </div>
      </div>

      {/* Report Filters Card (Hidden on print) */}
      <div className="no-print bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            Filtros do Relatório
          </span>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 mr-1">Atalhos de período:</span>
            <button
              type="button"
              onClick={handleSetThisMonth}
              className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950 text-slate-700 dark:text-slate-300 hover:text-blue-600 text-[11px] font-medium transition-colors cursor-pointer"
            >
              Este Mês
            </button>
            <button
              type="button"
              onClick={handleSetPrevMonth}
              className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950 text-slate-700 dark:text-slate-300 hover:text-blue-600 text-[11px] font-medium transition-colors cursor-pointer"
            >
              Mês Anterior
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <SelectInput
              label="Colaborador *"
              placeholder="Selecione um colaborador..."
              value={selectedEmployeeId}
              onChange={setSelectedEmployeeId}
              options={(employeesList?.items ?? []).map((emp: ManagedUser) => ({
                value: emp.id,
                label: emp.name,
                sublabel: emp.login,
              }))}
              searchable
              className="w-full"
            />
          </div>

          <div>
            <DateInput
              label="Data Inicial *"
              labelPosition="top"
              value={fromDate}
              onChange={setFromDate}
              className="w-full"
            />
          </div>

          <div>
            <DateInput
              label="Data Final *"
              labelPosition="top"
              value={toDate}
              onChange={setToDate}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Loading & Empty states */}
      {periodLoading && (
        <div className="no-print p-12 flex flex-col items-center justify-center space-y-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500">
          <RefreshCw className="w-7 h-7 animate-spin text-blue-600" />
          <p className="text-sm font-medium">Consolidando e calculando espelho de ponto...</p>
        </div>
      )}

      {!selectedEmployeeId && !periodLoading && (
        <div className="no-print p-12 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 text-sm">
          Selecione um colaborador acima para visualizar e imprimir o espelho de ponto oficial.
        </div>
      )}

      {/* Official Timesheet Document Sheet */}
      {periodData && selectedEmployeeObj && (
        <div className="report-print-sheet bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-8 space-y-6 print:border-none print:shadow-none print:p-0 print:m-0 print:space-y-4 print:text-black">
          {/* Header */}
          <div className="print-avoid-break flex items-center justify-between border-b-2 border-slate-200 dark:border-slate-800 print:border-slate-300 pb-4">
            <div className="flex items-center space-x-4">
              <img
                src={logoUrl}
                alt="PH Motopeças"
                className="h-10 w-auto object-contain print:h-9"
              />
              <div>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 print:text-slate-600 uppercase tracking-wider">
                  PH Motopeças • Gestão de Ponto Eletrônico
                </div>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white print:text-black tracking-tight">
                  ESPELHO DE PONTO E FREQUÊNCIA INDIVIDUAL
                </h2>
              </div>
            </div>

            <div className="text-right text-xs text-slate-500 dark:text-slate-400 print:text-slate-600">
              <div>
                Emissão:{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-300 print:text-black">
                  {formatDateTimeBR(new Date())}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 print:text-slate-500">
                Sistema PH-Ponto • Documento Oficial
              </div>
            </div>
          </div>

          {/* Employee & Period Details Box */}
          <div className="print-avoid-break bg-slate-50 dark:bg-slate-800/50 print:bg-slate-50 rounded-lg border border-slate-200 dark:border-slate-700 print:border-slate-300 p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 print:text-slate-600 uppercase tracking-wider">
                  Colaborador
                </div>
                <div className="font-bold text-sm text-slate-900 dark:text-white print:text-black mt-0.5">
                  {selectedEmployeeObj.name}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 print:text-slate-600 uppercase tracking-wider">
                  Login / Identificador
                </div>
                <div className="font-mono font-bold text-sm text-slate-900 dark:text-white print:text-black mt-0.5">
                  {selectedEmployeeObj.login}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 print:text-slate-600 uppercase tracking-wider">
                  Período de Apuração
                </div>
                <div className="font-bold text-sm text-slate-900 dark:text-white print:text-black mt-0.5">
                  {formatDateBR(fromDate)} a {formatDateBR(toDate)}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 print:text-slate-600 uppercase tracking-wider">
                  Situação Cadastral
                </div>
                <div className="font-bold text-sm text-slate-900 dark:text-white print:text-black mt-0.5 flex items-center">
                  <span
                    className={`inline-block w-2 h-2 rounded-full mr-1.5 ${
                      selectedEmployeeObj.isActive ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                  />
                  {selectedEmployeeObj.isActive ? 'Ativo' : 'Inativo'}
                </div>
              </div>
            </div>
          </div>

          {/* Consolidated Period Totals KPI Banner */}
          <div className="print-avoid-break grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 print:bg-slate-50 rounded-lg border border-slate-200 dark:border-slate-700 print:border-slate-300 text-center">
              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 print:text-slate-600 uppercase tracking-wider">
                Previsto
              </div>
              <div className="text-sm font-extrabold font-mono text-slate-900 dark:text-white print:text-black mt-0.5">
                {formatMinutesDuration(periodData.totals.expectedMinutes)}
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 print:bg-slate-50 rounded-lg border border-slate-200 dark:border-slate-700 print:border-slate-300 text-center">
              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 print:text-slate-600 uppercase tracking-wider">
                Trabalhado
              </div>
              <div className="text-sm font-extrabold font-mono text-slate-900 dark:text-white print:text-black mt-0.5">
                {formatMinutesDuration(periodData.totals.workedMinutes)}
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 print:bg-slate-50 rounded-lg border border-slate-200 dark:border-slate-700 print:border-slate-300 text-center">
              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 print:text-slate-600 uppercase tracking-wider">
                Saldo do Período
              </div>
              <div
                className={`text-sm font-extrabold font-mono mt-0.5 ${
                  periodData.totals.balanceMinutes >= 0
                    ? 'text-emerald-600 dark:text-emerald-400 print:text-emerald-700'
                    : 'text-rose-600 dark:text-rose-400 print:text-rose-700'
                }`}
              >
                {formatMinutesDuration(periodData.totals.balanceMinutes)}
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 print:bg-slate-50 rounded-lg border border-slate-200 dark:border-slate-700 print:border-slate-300 text-center">
              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 print:text-slate-600 uppercase tracking-wider flex items-center justify-center gap-1">
                <span>Horas Extras</span>
              </div>
              <div className="text-sm font-extrabold font-mono text-emerald-600 dark:text-emerald-400 print:text-emerald-700 mt-0.5">
                {formatMinutesDuration(periodData.totals.overtimeMinutes)}
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 print:bg-slate-50 rounded-lg border border-slate-200 dark:border-slate-700 print:border-slate-300 text-center col-span-2 sm:col-span-1">
              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 print:text-slate-600 uppercase tracking-wider flex items-center justify-center gap-1">
                <span>Faltas / Atrasos</span>
              </div>
              <div className="text-sm font-extrabold font-mono text-rose-600 dark:text-rose-400 print:text-rose-700 mt-0.5">
                {formatMinutesDuration(periodData.totals.missingMinutes)}
              </div>
            </div>
          </div>

          {/* Daily Attendance Detailed Table */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 print:border-slate-300 overflow-hidden">
            <table className="print-table w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 print:bg-slate-100 text-slate-700 dark:text-slate-300 print:text-black font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 print:border-slate-300 text-[10px]">
                <tr>
                  <th className="py-2 px-2.5 w-24 whitespace-nowrap">Data</th>
                  <th className="py-2 px-1.5 w-10 text-center">Dia</th>
                  <th className="py-2 px-2 w-24 whitespace-nowrap">Situação</th>
                  <th className="py-2 px-2.5">Batidas / Registros</th>
                  <th className="py-2 px-2 text-right w-16 whitespace-nowrap">Previsto</th>
                  <th className="py-2 px-2 text-right w-16 whitespace-nowrap">Trabalhado</th>
                  <th className="py-2 px-2.5 text-right w-16 whitespace-nowrap">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-slate-200 font-sans">
                {periodData.days.map((day: DailyAttendance, idx: number) => {
                  const statusText = getStatusLabel(day.status, day.workState);
                  const isDayOff = day.status === 'DAY_OFF' || day.status === 'HOLIDAY' || day.status === 'CLOSED';
                  const hasNegativeBalance =
                    day.balanceMinutes !== null && day.balanceMinutes < 0;
                  const hasPositiveBalance =
                    day.balanceMinutes !== null && day.balanceMinutes > 0;

                  return (
                    <tr
                      key={day.businessDate}
                      className={`text-[11px] ${
                        idx % 2 === 0
                          ? 'bg-white dark:bg-slate-900 print:bg-white'
                          : 'bg-slate-50/50 dark:bg-slate-800/20 print:bg-slate-50/40'
                      }`}
                    >
                      <td className="py-2 px-2.5 font-semibold text-slate-900 dark:text-white print:text-black whitespace-nowrap">
                        {formatDateBR(day.businessDate)}
                      </td>
                      <td className="py-2 px-1.5 text-center text-slate-500 dark:text-slate-400 print:text-slate-700 font-medium">
                        {getWeekdayShortBR(day.businessDate)}
                      </td>
                      <td className="py-2 px-2 whitespace-nowrap">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                            isDayOff
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 print:bg-slate-100 print:text-slate-700 print:border-slate-300'
                              : day.status === 'INCOMPLETE'
                                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 print:bg-amber-50 print:text-amber-800'
                                : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 print:bg-slate-50 print:text-slate-800 print:border-slate-200'
                          }`}
                        >
                          {statusText}
                        </span>
                      </td>
                      <td className="py-2 px-2.5 font-mono text-[11px] text-slate-800 dark:text-slate-200 print:text-black whitespace-nowrap">
                        {day.chronology.punches.length === 0 ? (
                          <span className="text-slate-400 print:text-slate-500 font-sans italic text-[10px]">
                            {isDayOff ? 'Folga' : 'Sem registros'}
                          </span>
                        ) : (
                          <span className="font-semibold whitespace-nowrap">
                            {day.chronology.punches
                              .map((p: EffectivePunch) => {
                                const d = new Date(p.effectiveOccurredAt);
                                return d.toLocaleTimeString('pt-BR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                });
                              })
                              .join('  •  ')}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-slate-600 dark:text-slate-400 print:text-slate-700 whitespace-nowrap">
                        {formatMinutesDuration(day.expectedMinutes)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono font-bold text-slate-900 dark:text-white print:text-black whitespace-nowrap">
                        {formatMinutesDuration(day.workedMinutes)}
                      </td>
                      <td
                        className={`py-2 px-2.5 text-right font-mono font-bold whitespace-nowrap ${
                          hasPositiveBalance
                            ? 'text-emerald-600 dark:text-emerald-400 print:text-emerald-700'
                            : hasNegativeBalance
                              ? 'text-rose-600 dark:text-rose-400 print:text-rose-700'
                              : 'text-slate-500 dark:text-slate-400 print:text-slate-600'
                        }`}
                      >
                        {day.balanceMinutes !== null
                          ? formatMinutesDuration(day.balanceMinutes)
                          : '--:--'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-100 dark:bg-slate-800 print:bg-slate-100 border-t-2 border-slate-300 dark:border-slate-700 print:border-slate-400 text-xs font-bold text-slate-900 dark:text-white print:text-black">
                <tr>
                  <td colSpan={4} className="py-2.5 px-3 uppercase tracking-wider text-[11px]">
                    Total Geral do Período ({periodData.days.length} dias apurados)
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-mono">
                    {formatMinutesDuration(periodData.totals.expectedMinutes)}
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-mono">
                    {formatMinutesDuration(periodData.totals.workedMinutes)}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-right font-mono ${
                      periodData.totals.balanceMinutes >= 0
                        ? 'text-emerald-600 dark:text-emerald-400 print:text-emerald-700'
                        : 'text-rose-600 dark:text-rose-400 print:text-rose-700'
                    }`}
                  >
                    {formatMinutesDuration(periodData.totals.balanceMinutes)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Declaratory Terms and Signatures (Print / PDF only) */}
          <div className="print-signatures pt-6 border-t border-slate-200 dark:border-slate-800 print:border-slate-300 space-y-8">
            <p className="text-[10px] text-slate-500 dark:text-slate-400 print:text-slate-600 text-justify leading-relaxed">
              Reconheço a exatidão e a veracidade das informações de frequência e horários
              registradas neste espelho de ponto eletrônico, correspondentes ao período apurado, nos
              termos acordados com a empresa.
            </p>

            <div className="grid grid-cols-2 gap-12 pt-6">
              <div className="text-center">
                <div className="border-t border-slate-400 dark:border-slate-600 print:border-black w-4/5 mx-auto mb-2" />
                <div className="font-bold text-xs text-slate-900 dark:text-white print:text-black">
                  {selectedEmployeeObj.name}
                </div>
                <div className="text-[10px] text-slate-500 print:text-slate-600">
                  Assinatura do Colaborador
                </div>
                <div className="text-[10px] text-slate-400 print:text-slate-500 mt-1">
                  Data: _____/_____/________
                </div>
              </div>

              <div className="text-center">
                <div className="border-t border-slate-400 dark:border-slate-600 print:border-black w-4/5 mx-auto mb-2" />
                <div className="font-bold text-xs text-slate-900 dark:text-white print:text-black">
                  PH Motopeças
                </div>
                <div className="text-[10px] text-slate-500 print:text-slate-600">
                  Assinatura do Gestor / RH
                </div>
                <div className="text-[10px] text-slate-400 print:text-slate-500 mt-1">
                  Data: _____/_____/________
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
