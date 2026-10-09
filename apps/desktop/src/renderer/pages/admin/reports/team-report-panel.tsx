import { useMemo, useState } from 'react';
import { formatMinutesDuration } from '@ph-ponto/shared';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  ChevronRight,
  Clock,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import type { TimesheetReport, TimesheetReportEmployee } from '../../../api/contracts.js';
import { AvatarImage } from '../../../components/avatar-image.js';
import { formatDisplayName, formatMinutes } from '../../../lib/format.js';
import {
  filterTeamRows,
  sortTeamRows,
  type SortDirection,
  type TeamSortKey,
} from './report-model.js';

interface TeamReportPanelProps {
  report: TimesheetReport;
  includeInactive: boolean;
  onIncludeInactiveChange: (value: boolean) => void;
  onOpenEmployee: (employeeId: string) => void;
}

function signedDuration(value: number): string {
  return `${value > 0 ? '+' : ''}${formatMinutesDuration(value)}`;
}

function balanceTone(value: number): string {
  if (value > 0) return 'text-emerald-700 dark:text-emerald-400';
  if (value < 0) return 'text-rose-700 dark:text-rose-400';
  return 'text-slate-500 dark:text-slate-400';
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  valueClassName = 'text-slate-900 dark:text-white',
  children,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  valueClassName?: string;
  children?: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </span>
        <Icon className="h-4 w-4 text-slate-400" aria-hidden="true" />
      </div>
      <div className={`mt-1.5 text-2xl font-extrabold tabular-nums ${valueClassName}`}>{value}</div>
      <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{hint}</div>
      {children}
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  align = 'right',
}: {
  label: string;
  sortKey: TeamSortKey;
  activeKey: TeamSortKey;
  direction: SortDirection;
  onSort: (key: TeamSortKey) => void;
  align?: 'left' | 'right';
}): React.JSX.Element {
  const active = sortKey === activeKey;
  const Icon = !active ? ArrowUpDown : direction === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`px-2.5 py-2.5 ${align === 'right' ? 'text-right' : 'text-left'}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 rounded uppercase tracking-wider cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-500 ${
          active ? 'text-blue-700 dark:text-blue-300' : 'hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        {label}
        <Icon className="h-3 w-3" aria-hidden="true" />
      </button>
    </th>
  );
}

export function TeamReportPanel({
  report,
  includeInactive,
  onIncludeInactiveChange,
  onOpenEmployee,
}: TeamReportPanelProps): React.JSX.Element {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<TeamSortKey>('name');
  const [direction, setDirection] = useState<SortDirection>('asc');

  const rows = useMemo(
    () => sortTeamRows(filterTeamRows(report.employees, search), sortKey, direction),
    [report.employees, search, sortKey, direction],
  );

  const handleSort = (key: TeamSortKey): void => {
    if (key === sortKey) {
      setDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // Numbers read best largest-first; names alphabetically.
      setDirection(key === 'name' ? 'asc' : key === 'balance' ? 'asc' : 'desc');
    }
  };

  const totals = report.totals;
  const progress =
    totals.expectedMinutes > 0
      ? Math.min(100, Math.round((totals.workedMinutes / totals.expectedMinutes) * 100))
      : 0;
  const pendingEmployees = report.employees.filter(
    (employee) => employee.totals.incompleteDayCount > 0,
  ).length;
  const maxAbsBalance = Math.max(
    1,
    ...report.employees.map((employee) => Math.abs(employee.totals.balanceMinutes)),
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Horas trabalhadas"
          value={formatMinutesDuration(totals.workedMinutes)}
          hint={`${progress}% de ${formatMinutesDuration(totals.expectedMinutes)} previstas`}
          icon={Clock}
        >
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
            role="progressbar"
            aria-label="Horas trabalhadas em relação ao previsto"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <div className="h-full rounded-full bg-blue-600" style={{ width: `${progress}%` }} />
          </div>
        </KpiCard>
        <KpiCard
          label="Saldo da equipe"
          value={signedDuration(totals.balanceMinutes)}
          hint="Horas extras menos faltas e atrasos"
          icon={totals.balanceMinutes >= 0 ? TrendingUp : TrendingDown}
          valueClassName={balanceTone(totals.balanceMinutes)}
        />
        <KpiCard
          label="Horas extras"
          value={formatMinutesDuration(totals.overtimeMinutes)}
          hint={`${totals.statusCounts.overtime} ${totals.statusCounts.overtime === 1 ? 'dia' : 'dias'} acima da jornada`}
          icon={TrendingUp}
        />
        <KpiCard
          label="Faltas e atrasos"
          value={formatMinutesDuration(totals.missingMinutes)}
          hint={`${totals.statusCounts.missingHours} ${totals.statusCounts.missingHours === 1 ? 'dia' : 'dias'} abaixo da jornada`}
          icon={TrendingDown}
        />
      </div>

      {totals.incompleteDayCount > 0 && (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {totals.incompleteDayCount === 1
              ? '1 dia com batidas incompletas'
              : `${totals.incompleteDayCount} dias com batidas incompletas`}{' '}
            ({pendingEmployees} {pendingEmployees === 1 ? 'colaborador' : 'colaboradores'}). Esses
            dias ficam fora dos totais até serem corrigidos.
          </span>
          <Link
            to="/admin/incompletos"
            className="shrink-0 text-xs font-bold text-amber-800 underline-offset-2 hover:underline dark:text-amber-300"
          >
            Revisar pendências
          </Link>
        </div>
      )}

      <section
        aria-label="Fechamento por colaborador"
        className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Fechamento por colaborador
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <Users className="h-3 w-3" aria-hidden="true" />
              {report.employees.length}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(event) => onIncludeInactiveChange(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-500"
              />
              Mostrar inativos
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar colaborador ou cargo..."
                aria-label="Buscar colaborador ou cargo"
                className="h-9 w-64 rounded-lg border border-slate-200 bg-white pl-8 pr-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Limpar busca"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {report.employees.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Nenhum colaborador com dias apurados neste período
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Escolha outro período ou marque “Mostrar inativos”.
            </p>
          </div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Nenhum colaborador encontrado para “{search}”.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                <tr>
                  <SortHeader
                    label="Colaborador"
                    sortKey="name"
                    activeKey={sortKey}
                    direction={direction}
                    onSort={handleSort}
                    align="left"
                  />
                  <th scope="col" className="px-2.5 py-2.5 text-right uppercase tracking-wider">
                    Previsto
                  </th>
                  <SortHeader
                    label="Trabalhado"
                    sortKey="worked"
                    activeKey={sortKey}
                    direction={direction}
                    onSort={handleSort}
                  />
                  <SortHeader
                    label="Saldo"
                    sortKey="balance"
                    activeKey={sortKey}
                    direction={direction}
                    onSort={handleSort}
                  />
                  <SortHeader
                    label="Extras"
                    sortKey="overtime"
                    activeKey={sortKey}
                    direction={direction}
                    onSort={handleSort}
                  />
                  <SortHeader
                    label="Faltas/atrasos"
                    sortKey="missing"
                    activeKey={sortKey}
                    direction={direction}
                    onSort={handleSort}
                  />
                  <th scope="col" className="px-2.5 py-2.5 text-center uppercase tracking-wider">
                    Pendências
                  </th>
                  <th scope="col" className="px-2.5 py-2.5 text-right">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((employee) => (
                  <TeamRow
                    key={employee.employeeId}
                    employee={employee}
                    maxAbsBalance={maxAbsBalance}
                    onOpen={() => onOpenEmployee(employee.employeeId)}
                  />
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-slate-50 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800/40 dark:text-white">
                <tr>
                  <td className="px-2.5 py-2.5 uppercase tracking-wider text-[11px]">
                    Total da equipe
                  </td>
                  <td className="px-2.5 py-2.5 text-right font-mono tabular-nums">
                    {formatMinutes(totals.expectedMinutes)}
                  </td>
                  <td className="px-2.5 py-2.5 text-right font-mono tabular-nums">
                    {formatMinutes(totals.workedMinutes)}
                  </td>
                  <td
                    className={`px-2.5 py-2.5 text-right font-mono tabular-nums ${balanceTone(totals.balanceMinutes)}`}
                  >
                    {formatMinutes(totals.balanceMinutes, true)}
                  </td>
                  <td className="px-2.5 py-2.5 text-right font-mono tabular-nums">
                    {formatMinutes(totals.overtimeMinutes)}
                  </td>
                  <td className="px-2.5 py-2.5 text-right font-mono tabular-nums">
                    {formatMinutes(totals.missingMinutes)}
                  </td>
                  <td className="px-2.5 py-2.5 text-center tabular-nums">
                    {totals.incompleteDayCount > 0 ? totals.incompleteDayCount : '—'}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <p className="border-t border-slate-100 px-4 py-2.5 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
          Totais consideram apenas dias fechados e completos. O dia de hoje e dias com batidas
          incompletas entram depois de encerrados ou corrigidos.
        </p>
      </section>
    </div>
  );
}

function TeamRow({
  employee,
  maxAbsBalance,
  onOpen,
}: {
  employee: TimesheetReportEmployee;
  maxAbsBalance: number;
  onOpen: () => void;
}): React.JSX.Element {
  const totals = employee.totals;
  const name = formatDisplayName(employee.name);
  const progress =
    totals.expectedMinutes > 0
      ? Math.min(100, Math.round((totals.workedMinutes / totals.expectedMinutes) * 100))
      : null;
  const balanceWidth = Math.round((Math.abs(totals.balanceMinutes) / maxAbsBalance) * 100);

  return (
    <tr className="group transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40">
      <td className="px-2.5 py-2.5">
        <div className="flex items-center gap-3">
          <AvatarImage
            userId={employee.employeeId}
            name={employee.name}
            hasAvatar={employee.hasAvatar}
            size="sm"
          />
          <div className="min-w-0 max-w-[230px]">
            <div className="flex items-center gap-1.5 truncate text-sm font-semibold text-slate-900 dark:text-white">
              {name}
              {!employee.isActive && (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  Inativo
                </span>
              )}
            </div>
            <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
              {employee.roleTitle ?? `@${employee.login}`}
            </div>
          </div>
        </div>
      </td>
      <td className="px-2.5 py-2.5 text-right font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
        {formatMinutes(totals.expectedMinutes)}
      </td>
      <td className="px-2.5 py-2.5 text-right">
        <div className="font-mono text-xs font-semibold tabular-nums text-slate-900 dark:text-white">
          {formatMinutes(totals.workedMinutes)}
        </div>
        {progress !== null && (
          <div
            className="ml-auto mt-1 h-1 w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
            title={`${progress}% do previsto`}
          >
            <div className="h-full rounded-full bg-blue-500" style={{ width: `${progress}%` }} />
          </div>
        )}
      </td>
      <td className="px-2.5 py-2.5 text-right">
        <div
          className={`font-mono text-xs font-bold tabular-nums ${balanceTone(totals.balanceMinutes)}`}
        >
          {formatMinutes(totals.balanceMinutes, true)}
        </div>
        {totals.balanceMinutes !== 0 && (
          <div className="ml-auto mt-1 h-1 w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={`h-full rounded-full ${totals.balanceMinutes > 0 ? 'bg-emerald-500' : 'ml-auto bg-rose-500'}`}
              style={{ width: `${Math.max(6, balanceWidth)}%` }}
            />
          </div>
        )}
      </td>
      <td className="px-2.5 py-2.5 text-right font-mono text-xs tabular-nums text-slate-700 dark:text-slate-300">
        {totals.overtimeMinutes > 0 ? formatMinutes(totals.overtimeMinutes) : '—'}
      </td>
      <td className="px-2.5 py-2.5 text-right font-mono text-xs tabular-nums text-slate-700 dark:text-slate-300">
        {totals.missingMinutes > 0 ? formatMinutes(totals.missingMinutes) : '—'}
      </td>
      <td className="px-2.5 py-2.5 text-center">
        {totals.incompleteDayCount > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            {totals.incompleteDayCount} {totals.incompleteDayCount === 1 ? 'dia' : 'dias'}
          </span>
        ) : (
          <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-500" aria-label="Sem pendências" />
        )}
      </td>
      <td className="px-2.5 py-2.5 text-right">
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Abrir espelho de ${name}`}
          className="inline-flex h-8 items-center gap-0.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-400 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:text-blue-300 cursor-pointer"
        >
          Espelho
          <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </button>
      </td>
    </tr>
  );
}
