import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Loader2,
  Printer,
  Users,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

import { ApiClientError } from '../../../api/client.js';
import type { ManagedUser, TimesheetReport } from '../../../api/contracts.js';
import { useApiClient } from '../../../auth/use-auth.js';
import { DateInput } from '../../../components/date-input.js';
import { FeedbackPanel } from '../../../components/feedback-panel.js';
import { MonthPicker } from '../../../components/month-picker.js';
import { SelectInput } from '../../../components/select-input.js';
import { useToast } from '../../../components/toast-context.js';
import { businessDateFromInstant } from '../../../lib/business-date.js';
import { formatDateBR, formatDisplayName } from '../../../lib/format.js';
import { TeamSummaryDocument, TimesheetDocument } from './report-documents.js';
import {
  buildTeamCsv,
  buildTimesheetCsv,
  countDaysInclusive,
  downloadCsv,
  formatMonthLabel,
  hasConfiguredCnpj,
  isBusinessDateString,
  isBusinessMonthString,
  resolveMonthRange,
  shiftMonth,
  slugify,
  validateCustomRange,
  type PeriodMode,
  type ReportView,
} from './report-model.js';
import { TeamReportPanel } from './team-report-panel.js';

type PrintJob =
  | { kind: 'team'; report: TimesheetReport }
  | { kind: 'individual'; report: TimesheetReport }
  | { kind: 'batch'; report: TimesheetReport };

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<SegmentedOption<T>>;
  onChange: (value: T) => void;
}): React.JSX.Element {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex shrink-0 rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800"
    >
      {options.map((option) => {
        const active = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500 ${
              active
                ? 'bg-white text-blue-700 shadow-xs dark:bg-slate-950 dark:text-blue-300'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:border-blue-400 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 cursor-pointer"
    >
      {children}
    </button>
  );
}

const ACTION_BUTTON =
  'inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500';
const SECONDARY_ACTION = `${ACTION_BUTTON} border border-slate-200 bg-white text-slate-700 hover:border-blue-400 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:text-blue-300`;
const PRIMARY_ACTION = `${ACTION_BUTTON} bg-blue-600 text-white shadow-xs hover:bg-blue-700`;

function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  return 'Não foi possível gerar o relatório. Tente novamente.';
}

export function AdminReportsPage(): React.JSX.Element {
  const api = useApiClient();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [today] = useState(() => businessDateFromInstant());
  const currentMonth = today.slice(0, 7);

  // ---- URL-backed state (survives reloads and allows deep links) ----------
  const view: ReportView = searchParams.get('visao') === 'individual' ? 'individual' : 'team';
  const periodMode: PeriodMode =
    searchParams.get('periodo') === 'personalizado' ? 'custom' : 'month';
  const monthParam = searchParams.get('mes') ?? '';
  const month =
    isBusinessMonthString(monthParam) && monthParam <= currentMonth ? monthParam : currentMonth;
  const customFromParam = searchParams.get('de') ?? '';
  const customToParam = searchParams.get('ate') ?? '';
  const customFrom = isBusinessDateString(customFromParam) ? customFromParam : `${currentMonth}-01`;
  const customTo = isBusinessDateString(customToParam) ? customToParam : today;
  const selectedEmployeeId = searchParams.get('colaborador') ?? '';
  const includeInactive = searchParams.get('inativos') === '1';

  const updateParams = (changes: Record<string, string | null>): void => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const [key, value] of Object.entries(changes)) {
          if (value === null || value === '') next.delete(key);
          else next.set(key, value);
        }
        return next;
      },
      { replace: true },
    );
  };

  // ---- Period resolution -------------------------------------------------
  const monthRange = resolveMonthRange(month, today);
  const customError =
    periodMode === 'custom' ? validateCustomRange(customFrom, customTo, today) : null;
  const range =
    periodMode === 'month'
      ? monthRange
      : customError === null
        ? { from: customFrom, to: customTo, isPartial: false }
        : null;

  // ---- Data --------------------------------------------------------------
  const { data: company } = useQuery({
    queryKey: ['company-data'],
    queryFn: ({ signal }) => api.getCompany(signal),
  });

  const employeesQuery = useQuery({
    queryKey: ['admin-employees-select'],
    queryFn: ({ signal }) => api.getEmployees({ limit: 100 }, signal),
  });

  const employeeOptions = useMemo(() => {
    const all = [...(employeesQuery.data?.items ?? [])].sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR'),
    );
    return all.filter(
      (employee: ManagedUser) =>
        employee.isActive || includeInactive || employee.id === selectedEmployeeId,
    );
  }, [employeesQuery.data, includeInactive, selectedEmployeeId]);

  // Individual view never starts empty: default to the first collaborator.
  const effectiveEmployeeId =
    view === 'individual'
      ? employeeOptions.some((employee) => employee.id === selectedEmployeeId)
        ? selectedEmployeeId
        : (employeeOptions[0]?.id ?? '')
      : '';

  const teamQuery = useQuery({
    queryKey: ['timesheet-report', 'team', range?.from, range?.to, includeInactive],
    queryFn: ({ signal }) =>
      api.getTimesheetReport({ from: range!.from, to: range!.to, includeInactive }, signal),
    enabled: view === 'team' && range !== null,
    placeholderData: keepPreviousData,
  });

  const individualQuery = useQuery({
    queryKey: ['timesheet-report', 'individual', effectiveEmployeeId, range?.from, range?.to],
    queryFn: ({ signal }) =>
      api.getTimesheetReport(
        { from: range!.from, to: range!.to, employeeId: effectiveEmployeeId, includeDays: true },
        signal,
      ),
    enabled: view === 'individual' && range !== null && effectiveEmployeeId !== '',
    placeholderData: keepPreviousData,
  });

  const individualEmployee = individualQuery.data?.employees.find(
    (employee) => employee.employeeId === effectiveEmployeeId,
  );

  // ---- Printing ----------------------------------------------------------
  const [printJob, setPrintJob] = useState<PrintJob | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);

  useEffect(() => {
    if (printJob === null) return undefined;
    const handleAfterPrint = (): void => setPrintJob(null);
    window.addEventListener('afterprint', handleAfterPrint);
    // Wait one frame so the print-only document is committed and laid out.
    const frame = window.requestAnimationFrame(() => {
      window.print();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [printJob]);

  const handlePrintAll = async (): Promise<void> => {
    if (range === null) return;
    setBatchLoading(true);
    try {
      const report = await queryClient.fetchQuery({
        queryKey: ['timesheet-report', 'batch', range.from, range.to, includeInactive],
        queryFn: ({ signal }) =>
          api.getTimesheetReport(
            { from: range.from, to: range.to, includeInactive, includeDays: true },
            signal,
          ),
      });
      if (report.employees.length === 0) {
        toast.info('Nenhum colaborador com dias apurados neste período.');
        return;
      }
      setPrintJob({ kind: 'batch', report });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBatchLoading(false);
    }
  };

  // ---- Exports -----------------------------------------------------------
  const handleTeamCsv = (): void => {
    const report = teamQuery.data;
    if (!report) return;
    downloadCsv(
      `resumo-ponto-equipe_${report.from}_${report.to}.csv`,
      buildTeamCsv(report, company),
    );
    toast.success('Planilha da equipe exportada.');
  };

  const handleIndividualCsv = (): void => {
    const report = individualQuery.data;
    if (!report || !individualEmployee) return;
    downloadCsv(
      `espelho-ponto_${slugify(individualEmployee.name)}_${report.from}_${report.to}.csv`,
      buildTimesheetCsv(report, individualEmployee, company),
    );
    toast.success('Espelho exportado em planilha.');
  };

  // ---- Navigation helpers ------------------------------------------------
  const selectedIndex = employeeOptions.findIndex(
    (employee) => employee.id === effectiveEmployeeId,
  );
  const goToEmployee = (offset: number): void => {
    const next = employeeOptions[selectedIndex + offset];
    if (next) updateParams({ colaborador: next.id });
  };

  const openEmployee = (employeeId: string): void => {
    updateParams({ visao: 'individual', colaborador: employeeId });
  };

  const rangeLabel =
    range === null
      ? null
      : `${formatDateBR(range.from)} a ${formatDateBR(range.to)} • ${countDaysInclusive(range.from, range.to)} dias`;

  // Actions only run on data that belongs to the period currently on screen.
  const teamReady =
    range !== null &&
    teamQuery.data !== undefined &&
    !teamQuery.isPlaceholderData &&
    teamQuery.data.employees.length > 0;
  const individualReady =
    range !== null && individualEmployee !== undefined && !individualQuery.isPlaceholderData;

  const activeQuery = view === 'team' ? teamQuery : individualQuery;
  const isRefreshing = activeQuery.isFetching && activeQuery.data !== undefined;

  return (
    <>
      <div className="no-print space-y-5">
        {/* Page header: title + actions for the current report */}
        <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
              <FileText className="h-5 w-5 text-blue-600" aria-hidden="true" />
              Relatórios de Ponto
            </h1>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Feche as horas do período e emita espelhos de ponto para assinatura.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:flex-nowrap">
            {view === 'team' ? (
              <>
                <button
                  type="button"
                  className={SECONDARY_ACTION}
                  onClick={handleTeamCsv}
                  disabled={!teamReady}
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  Exportar planilha
                </button>
                <button
                  type="button"
                  className={SECONDARY_ACTION}
                  onClick={() =>
                    teamQuery.data && setPrintJob({ kind: 'team', report: teamQuery.data })
                  }
                  disabled={!teamReady}
                >
                  <Printer className="h-4 w-4" aria-hidden="true" />
                  Imprimir resumo
                </button>
                <button
                  type="button"
                  className={PRIMARY_ACTION}
                  onClick={() => void handlePrintAll()}
                  disabled={!teamReady || batchLoading}
                >
                  {batchLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Printer className="h-4 w-4" aria-hidden="true" />
                  )}
                  {batchLoading ? 'Preparando...' : 'Imprimir espelhos'}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={SECONDARY_ACTION}
                  onClick={handleIndividualCsv}
                  disabled={!individualReady}
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  Exportar planilha
                </button>
                <button
                  type="button"
                  className={PRIMARY_ACTION}
                  onClick={() =>
                    individualQuery.data &&
                    setPrintJob({ kind: 'individual', report: individualQuery.data })
                  }
                  disabled={!individualReady}
                >
                  <Printer className="h-4 w-4" aria-hidden="true" />
                  Imprimir / Salvar PDF
                </button>
              </>
            )}
          </div>
        </div>

        {/* Filters: report type → period → collaborator */}
        <section
          aria-label="Filtros do relatório"
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xs dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <Segmented<ReportView>
              label="Tipo de relatório"
              value={view}
              onChange={(value) =>
                updateParams({ visao: value === 'individual' ? 'individual' : null })
              }
              options={[
                { value: 'team', label: 'Resumo da equipe', icon: Users },
                { value: 'individual', label: 'Espelho individual', icon: FileText },
              ]}
            />

            <div
              className="hidden h-6 w-px bg-slate-200 dark:bg-slate-700 md:block"
              aria-hidden="true"
            />

            <div className="flex flex-wrap items-center gap-2">
              <Segmented<PeriodMode>
                label="Tipo de período"
                value={periodMode}
                onChange={(value) =>
                  updateParams(
                    value === 'custom'
                      ? {
                          periodo: 'personalizado',
                          de: range?.from ?? customFrom,
                          ate: range?.to ?? customTo,
                        }
                      : { periodo: null, de: null, ate: null },
                  )
                }
                options={[
                  { value: 'month', label: 'Mês' },
                  { value: 'custom', label: 'Personalizado' },
                ]}
              />
              {periodMode === 'month' ? (
                <div className="flex items-center gap-1.5">
                  <IconButton
                    label="Mês anterior"
                    onClick={() => updateParams({ mes: shiftMonth(month, -1) })}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </IconButton>
                  <MonthPicker
                    value={month}
                    max={currentMonth}
                    onChange={(value) => updateParams({ mes: value })}
                  />
                  <IconButton
                    label="Próximo mês"
                    onClick={() => updateParams({ mes: shiftMonth(month, 1) })}
                    disabled={month >= currentMonth}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </IconButton>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <DateInput
                    compact
                    value={customFrom}
                    max={today}
                    onChange={(value) => updateParams({ de: value })}
                    className="w-40"
                    id="report-from"
                    label="De"
                  />
                  <span className="text-xs text-slate-400">até</span>
                  <DateInput
                    compact
                    value={customTo}
                    max={today}
                    onChange={(value) => updateParams({ ate: value })}
                    className="w-40"
                    id="report-to"
                    label="Até"
                  />
                </div>
              )}
            </div>

            {view === 'individual' && (
              <>
                <div className="flex w-full items-center gap-1.5">
                  <span className="mr-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Colaborador
                  </span>
                  <IconButton
                    label="Colaborador anterior"
                    onClick={() => goToEmployee(-1)}
                    disabled={selectedIndex <= 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </IconButton>
                  <SelectInput
                    size="sm"
                    placeholder={
                      employeesQuery.isLoading ? 'Carregando colaboradores...' : 'Selecione...'
                    }
                    value={effectiveEmployeeId}
                    onChange={(value) => updateParams({ colaborador: value })}
                    options={employeeOptions.map((employee) => ({
                      value: employee.id,
                      label: formatDisplayName(employee.name),
                      sublabel: employee.isActive ? `@${employee.login}` : 'Inativo',
                    }))}
                    searchable
                    className="w-72"
                  />
                  <IconButton
                    label="Próximo colaborador"
                    onClick={() => goToEmployee(1)}
                    disabled={selectedIndex < 0 || selectedIndex >= employeeOptions.length - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </IconButton>
                  {employeeOptions.length > 0 && selectedIndex >= 0 && (
                    <span className="ml-1 text-[11px] tabular-nums text-slate-400">
                      {selectedIndex + 1} de {employeeOptions.length}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
            {periodMode === 'custom' && customError ? (
              <span
                role="alert"
                className="flex items-center gap-1.5 font-semibold text-rose-600 dark:text-rose-400"
              >
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                {customError}
              </span>
            ) : range === null ? (
              <span role="alert" className="font-semibold text-rose-600 dark:text-rose-400">
                Selecione um mês até {formatMonthLabel(currentMonth)}.
              </span>
            ) : (
              <>
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {rangeLabel}
                </span>
                {range.isPartial && (
                  <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                    Mês em andamento · apurado até hoje
                  </span>
                )}
              </>
            )}
            {isRefreshing && (
              <span className="flex items-center gap-1 text-slate-400">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> Atualizando...
              </span>
            )}
            {company && !hasConfiguredCnpj(company) && (
              <Link
                to="/admin/empresa"
                className="ml-auto text-[11px] font-semibold text-amber-700 hover:underline dark:text-amber-400"
              >
                Complete o cadastro da empresa (CNPJ) para exibi-lo nos documentos
              </Link>
            )}
          </div>
        </section>

        {/* Content */}
        {range === null ? null : view === 'team' ? (
          teamQuery.isError && !teamQuery.data ? (
            <FeedbackPanel error={teamQuery.error} onRetry={() => void teamQuery.refetch()} />
          ) : teamQuery.isLoading || !teamQuery.data ? (
            <LoadingCard label="Calculando o fechamento da equipe..." />
          ) : (
            <div
              className={`transition-opacity ${teamQuery.isPlaceholderData ? 'opacity-60' : ''}`}
            >
              <TeamReportPanel
                report={teamQuery.data}
                includeInactive={includeInactive}
                onIncludeInactiveChange={(value) => updateParams({ inativos: value ? '1' : null })}
                onOpenEmployee={openEmployee}
              />
            </div>
          )
        ) : employeesQuery.isError ? (
          <FeedbackPanel
            error={employeesQuery.error}
            onRetry={() => void employeesQuery.refetch()}
          />
        ) : !employeesQuery.isLoading && employeeOptions.length === 0 ? (
          <EmptyCard
            title="Nenhum colaborador cadastrado"
            description="Cadastre colaboradores para emitir espelhos de ponto."
          />
        ) : individualQuery.isError && !individualQuery.data ? (
          <FeedbackPanel
            error={individualQuery.error}
            onRetry={() => void individualQuery.refetch()}
          />
        ) : individualQuery.isLoading || !individualQuery.data || !individualEmployee ? (
          <LoadingCard label="Montando o espelho de ponto..." />
        ) : (
          <div className="space-y-3">
            {individualEmployee.totals.incompleteDayCount > 0 && (
              <IncompleteNotice
                employeeId={individualEmployee.employeeId}
                firstDate={
                  individualEmployee.days?.find(
                    (day) =>
                      day.isFinalized &&
                      (day.status === 'INCOMPLETE' || day.balanceMinutes === null),
                  )?.businessDate
                }
                count={individualEmployee.totals.incompleteDayCount}
              />
            )}
            <div
              className={`report-preview rounded-xl border border-slate-200 bg-slate-100 p-3 transition-opacity dark:border-slate-800 dark:bg-slate-950 sm:p-5 ${
                isRefreshing ? 'opacity-60' : ''
              }`}
            >
              <TimesheetDocument
                company={company}
                report={individualQuery.data}
                employee={individualEmployee}
                className="mx-auto max-w-[210mm] rounded-sm p-[12mm] shadow-md"
              />
            </div>
          </div>
        )}
      </div>

      {/* Print-only output */}
      <div className="print-only" aria-hidden={printJob === null}>
        {printJob?.kind === 'team' && (
          <TeamSummaryDocument company={company} report={printJob.report} />
        )}
        {printJob?.kind === 'individual' &&
          printJob.report.employees.map((employee) => (
            <TimesheetDocument
              key={employee.employeeId}
              company={company}
              report={printJob.report}
              employee={employee}
            />
          ))}
        {printJob?.kind === 'batch' &&
          printJob.report.employees.map((employee, index) => (
            <TimesheetDocument
              key={employee.employeeId}
              company={company}
              report={printJob.report}
              employee={employee}
              className={index < printJob.report.employees.length - 1 ? 'print-page-break' : ''}
            />
          ))}
      </div>
    </>
  );
}

function LoadingCard({ label }: { label: string }): React.JSX.Element {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white p-12 text-slate-500 dark:border-slate-800 dark:bg-slate-900"
    >
      <Loader2 className="h-7 w-7 animate-spin text-blue-600" aria-hidden="true" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}

function EmptyCard({
  title,
  description,
}: {
  title: string;
  description: string;
}): React.JSX.Element {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
    </div>
  );
}

function IncompleteNotice({
  employeeId,
  firstDate,
  count,
}: {
  employeeId: string;
  firstDate: string | undefined;
  count: number;
}): React.JSX.Element {
  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between"
    >
      <span className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        {count === 1
          ? 'Há 1 dia com batidas incompletas. Ele fica fora dos totais até ser corrigido.'
          : `Há ${count} dias com batidas incompletas. Eles ficam fora dos totais até serem corrigidos.`}
      </span>
      <Link
        to={`/admin/funcionarios/${employeeId}${firstDate ? `?date=${firstDate}` : ''}`}
        className="shrink-0 text-xs font-bold text-amber-800 underline-offset-2 hover:underline dark:text-amber-300"
      >
        Corrigir batidas
      </Link>
    </div>
  );
}
