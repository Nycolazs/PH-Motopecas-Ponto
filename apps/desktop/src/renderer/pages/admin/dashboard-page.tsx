import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Plus,
  RefreshCw,
  Search,
  UserCheck,
  UserX,
  Users,
  X,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import type { EmployeeTodayStatus, RecentAdjustment, RecentPunch } from '../../api/contracts.js';
import { useApiClient } from '../../auth/use-auth.js';
import { AvatarImage } from '../../components/avatar-image.js';
import { DateInput } from '../../components/date-input.js';
import { ManualPunchModal } from '../../components/manual-punch-modal.js';
import { StatusBadge } from '../../components/status-badge.js';
import { formatDateBR } from '../../lib/format.js';
import { formatMinutesDuration } from '@ph-ponto/shared';

export function formatDisplayName(rawName: string): string {
  if (!rawName) return '';
  const lowerPrepositions = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
  return rawName
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word, idx) => {
      if (idx > 0 && lowerPrepositions.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

function formatTime(isoString?: string | null): string {
  if (!isoString) return '--:--';
  const d = new Date(isoString);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

type StatusFilterType = 'ALL' | 'WORKING' | 'LUNCH' | 'NOT_STARTED' | 'INCOMPLETE';

export function AdminDashboardPage(): React.JSX.Element {
  const api = useApiClient();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [manualPunchOpen, setManualPunchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('ALL');

  const {
    data: overview,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['admin-overview', selectedDate],
    queryFn: () => api.getAdminOverview(selectedDate),
    refetchInterval: 30_000,
  });

  const { data: pendingAdjustments } = useQuery({
    queryKey: ['pending-adjustments-count'],
    queryFn: ({ signal }) => api.getPendingAdjustmentRequestsCount(signal),
    refetchInterval: 30_000,
  });

  const { data: employeesList } = useQuery({
    queryKey: ['admin-employees-select'],
    queryFn: () => api.getEmployees({ limit: 100 }),
  });

  const pendingCount = pendingAdjustments?.pendingCount ?? 0;

  const allEmployees = overview?.employees ?? [];
  const workingCount = allEmployees.filter((e) => e.workState === 'WORKING').length;
  const lunchCount = allEmployees.filter((e) => e.workState === 'LUNCH').length;
  const notStartedCount = allEmployees.filter((e) => e.workState === 'NOT_STARTED').length;
  const incompleteFilterCount = allEmployees.filter((e) => e.status === 'INCOMPLETE').length;

  const filteredEmployees = allEmployees.filter((emp) => {
    if (statusFilter === 'WORKING' && emp.workState !== 'WORKING') return false;
    if (statusFilter === 'LUNCH' && emp.workState !== 'LUNCH') return false;
    if (statusFilter === 'NOT_STARTED' && emp.workState !== 'NOT_STARTED') return false;
    if (statusFilter === 'INCOMPLETE' && emp.status !== 'INCOMPLETE') return false;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const nameMatch = emp.name.toLowerCase().includes(query);
      const loginMatch = emp.login.toLowerCase().includes(query);
      if (!nameMatch && !loginMatch) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Pending Adjustments Alert */}
      {pendingCount > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 dark:bg-amber-950/40 dark:border-amber-700/50 p-4 rounded-xl flex items-center justify-between gap-4 text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500 text-slate-950 rounded-lg shrink-0 font-bold">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm">
                {pendingCount === 1
                  ? 'Existe 1 solicitação de ajuste de ponto pendente'
                  : `Existem ${pendingCount} solicitações de ajuste de ponto pendentes`}
              </div>
              <div className="text-xs text-amber-700 dark:text-amber-300">
                Funcionários enviaram pedidos de correção que aguardam aprovação da administração.
              </div>
            </div>
          </div>
          <Link
            to="/admin/solicitacoes"
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 text-xs font-bold rounded-lg shrink-0 transition shadow-xs"
          >
            Avaliar Solicitações
          </Link>
        </div>
      )}

      {/* Top Banner & Date Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Painel Operacional</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Acompanhamento em tempo real de presença, batidas e jornada de trabalho
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <DateInput value={selectedDate} onChange={setSelectedDate} />

          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
            title="Atualizar dados"
            aria-label="Atualizar dados"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setManualPunchOpen(true)}
            className="primary-button text-xs py-2 px-3.5"
          >
            <Plus className="w-4 h-4 mr-1" />
            Inserir Ponto
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="p-12 flex flex-col items-center justify-center space-y-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
          <p className="text-sm font-medium">Carregando dados da empresa...</p>
        </div>
      )}

      {error && (
        <div className="p-5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-sm">
          Falha ao carregar o painel operacional. Verifique sua conexão e tente novamente.
        </div>
      )}

      {overview && (
        <>
          {/* Key Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Ativos</span>
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {overview.totalActiveEmployees}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Colaboradores ativos</div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Presentes</span>
                <UserCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {overview.clockedInTodayCount}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Bateram ponto hoje</div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Em Jornada</span>
                <Clock className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {overview.currentlyWorkingCount}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Trabalhando agora</div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Incompletos</span>
                <AlertCircle className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                {overview.incompleteCount}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Batidas pendentes</div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Ausentes</span>
                <UserX className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {overview.notClockedInCount}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Ainda não iniciaram</div>
            </div>
          </div>

          {/* Main Content Grid: Employee Status Table + Recent Activity */}
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_280px] 2xl:grid-cols-[minmax(0,1fr)_320px] gap-6">
            {/* Employee Daily Attendance Table */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs flex flex-col justify-between">
              <div>
                <div className="px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900 dark:text-white">
                        Quadro de Frequência do Dia
                      </h2>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {allEmployees.length} colaboradores
                      </span>
                    </div>
                    <Link
                      to="/admin/funcionarios"
                      className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 inline-flex items-center transition-colors"
                    >
                      Gerenciar equipe <ExternalLink className="w-3.5 h-3.5 ml-1" />
                    </Link>
                  </div>

                  {/* Search Bar + Quick Filter Tabs */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    {/* Quick Filter Tabs */}
                    <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none text-xs">
                      {[
                        { id: 'ALL' as const, label: 'Todos', count: allEmployees.length },
                        { id: 'WORKING' as const, label: 'Em jornada', count: workingCount },
                        { id: 'LUNCH' as const, label: 'Almoço', count: lunchCount },
                        {
                          id: 'NOT_STARTED' as const,
                          label: 'Não iniciados',
                          count: notStartedCount,
                        },
                        ...(incompleteFilterCount > 0
                          ? [
                              {
                                id: 'INCOMPLETE' as const,
                                label: 'Incompletos',
                                count: incompleteFilterCount,
                              },
                            ]
                          : []),
                      ].map((tab) => {
                        const isActive = statusFilter === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setStatusFilter(tab.id)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                              isActive
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            <span>{tab.label}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                                isActive
                                  ? 'bg-white/20 text-white'
                                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {tab.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Search Input */}
                    <div className="relative w-full sm:w-44 lg:w-48 shrink-0">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar colaborador..."
                        className="w-full pl-8 pr-7 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition-colors"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                          title="Limpar busca"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50/80 dark:bg-slate-800/60 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 pl-4 pr-2 text-left">Colaborador</th>
                        <th className="py-2.5 px-2 text-left">Status</th>
                        <th className="py-2.5 px-2 text-left">Jornada</th>
                        <th className="py-2.5 px-2 text-center">Saldo</th>
                        <th className="py-2.5 px-2 text-center">Última Batida</th>
                        <th className="py-2.5 pl-2 pr-4 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {allEmployees.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-500 text-sm">
                            Nenhum colaborador ativo cadastrado.
                          </td>
                        </tr>
                      )}
                      {allEmployees.length > 0 && filteredEmployees.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-12 text-center">
                            <div className="max-w-xs mx-auto space-y-2">
                              <Users className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                Nenhum colaborador encontrado
                              </p>
                              <p className="text-xs text-slate-500">
                                Não há colaboradores correspondentes aos critérios de busca ou
                                filtro selecionados.
                              </p>
                              {(searchQuery || statusFilter !== 'ALL') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSearchQuery('');
                                    setStatusFilter('ALL');
                                  }}
                                  className="mt-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                                >
                                  Limpar filtros
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                      {filteredEmployees.map((emp: EmployeeTodayStatus) => {
                        const percent =
                          emp.expectedMinutes > 0
                            ? Math.min(
                                100,
                                Math.round((emp.workedMinutes / emp.expectedMinutes) * 100),
                              )
                            : 0;

                        let balanceContent: React.ReactNode = (
                          <span className="text-slate-400 dark:text-slate-500 font-mono text-xs">
                            —
                          </span>
                        );
                        if (emp.balanceMinutes !== null && emp.balanceMinutes > 0) {
                          balanceContent = (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md font-mono text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                              +{formatMinutesDuration(emp.balanceMinutes)}
                            </span>
                          );
                        } else if (emp.balanceMinutes !== null && emp.balanceMinutes < 0) {
                          if (emp.workState === 'NOT_STARTED' || emp.workedMinutes === 0) {
                            balanceContent = (
                              <span
                                className="text-slate-400 dark:text-slate-500 font-mono text-xs"
                                title={`Previsto: ${formatMinutesDuration(emp.expectedMinutes)}`}
                              >
                                —
                              </span>
                            );
                          } else {
                            balanceContent = (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md font-mono text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
                                -{formatMinutesDuration(Math.abs(emp.balanceMinutes))}
                              </span>
                            );
                          }
                        } else if (emp.balanceMinutes === 0 && emp.workedMinutes > 0) {
                          balanceContent = (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md font-mono text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              0min
                            </span>
                          );
                        }

                        return (
                          <tr
                            key={emp.id}
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
                          >
                            <td className="py-2.5 pl-4 pr-2">
                              <div className="flex items-center space-x-2.5">
                                <div className="relative shrink-0">
                                  <AvatarImage
                                    userId={emp.id}
                                    name={emp.name}
                                    hasAvatar={emp.hasAvatar}
                                    size="sm"
                                  />
                                  {emp.workState === 'WORKING' && (
                                    <span
                                      className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900"
                                      title="Em jornada agora"
                                    />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors text-xs">
                                    {formatDisplayName(emp.name)}
                                  </div>
                                  <div className="text-[11px] text-slate-500 truncate font-mono">
                                    @{emp.login}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 px-2 whitespace-nowrap">
                              <StatusBadge status={emp.status} workState={emp.workState} />
                            </td>
                            <td className="py-2.5 px-2 whitespace-nowrap">
                              <div className="font-mono text-xs font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1">
                                <span>{formatMinutesDuration(emp.workedMinutes)}</span>
                                <span className="text-slate-400 font-sans text-[11px]">
                                  de {formatMinutesDuration(emp.expectedMinutes)}
                                </span>
                              </div>
                              <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-1">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    percent >= 100
                                      ? 'bg-emerald-500'
                                      : emp.workState === 'WORKING'
                                        ? 'bg-blue-500'
                                        : percent > 0
                                          ? 'bg-slate-400 dark:bg-slate-500'
                                          : 'bg-transparent'
                                  }`}
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-center whitespace-nowrap">
                              {balanceContent}
                            </td>
                            <td className="py-2.5 px-2 text-center whitespace-nowrap">
                              {emp.lastPunchAt ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/60 font-mono text-xs font-medium text-slate-700 dark:text-slate-300">
                                  <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span>{formatTime(emp.lastPunchAt)}</span>
                                  <span className="text-[10px] uppercase font-bold text-slate-400">
                                    ({emp.lastPunchKind === 'CLOCK_IN' ? 'Entr' : 'Saíd'})
                                  </span>
                                </span>
                              ) : (
                                <span className="text-slate-400 dark:text-slate-500 font-mono text-xs">
                                  —
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 pl-2 pr-4 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => navigate(`/admin/funcionarios/${emp.id}`)}
                                className="inline-flex items-center justify-center px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg border border-slate-200 dark:border-slate-700 transition-all shadow-2xs group/btn cursor-pointer"
                              >
                                <span>Ver espelho</span>
                                <ChevronRight className="w-3.5 h-3.5 ml-0.5 text-slate-400 group-hover/btn:text-blue-600 dark:group-hover/btn:text-blue-400 group-hover/btn:translate-x-0.5 transition-transform" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Table Footer Summary */}
              {allEmployees.length > 0 && (
                <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-500">
                  <span>
                    Exibindo {filteredEmployees.length} de {allEmployees.length} colaboradores
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>{workingCount} em jornada</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span>{lunchCount} em almoço</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-slate-400" />
                      <span>{notStartedCount} não iniciados</span>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar Activity: Recent Punches & Adjustments */}
            <div className="space-y-6">
              {/* Recent Punches */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center">
                    <Clock className="w-4 h-4 mr-2 text-blue-600" /> Batidas Recentes
                  </h3>
                  <Link
                    to="/admin/pontos"
                    className="text-xs font-semibold text-blue-600 hover:underline"
                  >
                    Ver todas
                  </Link>
                </div>

                <div className="space-y-3">
                  {overview.recentPunches.length === 0 && (
                    <p className="text-xs text-slate-500 py-3 text-center">
                      Nenhuma batida registrada recentemente.
                    </p>
                  )}
                  {overview.recentPunches.slice(0, 6).map((punch: RecentPunch) => (
                    <div
                      key={punch.id}
                      className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {formatDisplayName(punch.employeeName)}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {formatDateBR(punch.effectiveOccurredAt)} às{' '}
                          {formatTime(punch.effectiveOccurredAt)}
                        </div>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <StatusBadge status={punch.kind} />
                        {punch.origin === 'ADMIN_INSERTION' && (
                          <span
                            className="w-2 h-2 rounded-full bg-amber-500"
                            title="Inserção administrativa"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Adjustments */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center">
                    <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-600" /> Correções Recentes
                  </h3>
                </div>

                <div className="space-y-3">
                  {overview.recentAdjustments.length === 0 && (
                    <p className="text-xs text-slate-500 py-3 text-center">
                      Nenhuma correção efetuada recentemente.
                    </p>
                  )}
                  {overview.recentAdjustments.slice(0, 5).map((adj: RecentAdjustment) => (
                    <div
                      key={adj.id}
                      className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {formatDisplayName(adj.employeeName)}
                        </span>
                        <span className="text-[10px] text-slate-500">por {adj.adminName}</span>
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400">
                        Horário:{' '}
                        <span className="line-through text-rose-500">
                          {formatTime(adj.previousOccurredAt)}
                        </span>{' '}
                        →{' '}
                        <span className="font-bold text-emerald-600">
                          {formatTime(adj.correctedOccurredAt)}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 italic truncate">
                        "{adj.reason}"
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Manual Punch Modal */}
      {employeesList && (
        <ManualPunchModal
          isOpen={manualPunchOpen}
          onClose={() => setManualPunchOpen(false)}
          employees={employeesList.items}
          onSuccess={() => void refetch()}
        />
      )}
    </div>
  );
}
