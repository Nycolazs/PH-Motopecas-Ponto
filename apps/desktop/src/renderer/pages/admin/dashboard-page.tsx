import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Plus,
  RefreshCw,
  UserCheck,
  UserX,
  Users,
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

function formatTime(isoString?: string | null): string {
  if (!isoString) return '--:--';
  const d = new Date(isoString);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

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
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Employee Daily Attendance Table */}
            <div className="xl:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Quadro de Frequência do Dia
                  </h2>
                  <p className="text-xs text-slate-500">
                    Status e saldo de horas de cada colaborador em {selectedDate}
                  </p>
                </div>
                <Link
                  to="/admin/funcionarios"
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center"
                >
                  Gerenciar equipe <ExternalLink className="w-3 h-3 ml-1" />
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Colaborador</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Trabalhado</th>
                      <th className="py-3 px-3">Saldo</th>
                      <th className="py-3 px-3">Última Batida</th>
                      <th className="py-3 px-4 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {overview.employees.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500 text-sm">
                          Nenhum colaborador ativo cadastrado.
                        </td>
                      </tr>
                    )}
                    {overview.employees.map((emp: EmployeeTodayStatus) => {
                      const balanceFormatted =
                        emp.balanceMinutes !== null
                          ? formatMinutesDuration(emp.balanceMinutes)
                          : '--:--';
                      const balanceClass =
                        emp.balanceMinutes !== null && emp.balanceMinutes > 0
                          ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                          : emp.balanceMinutes !== null && emp.balanceMinutes < 0
                            ? 'text-rose-600 dark:text-rose-400 font-bold'
                            : 'text-slate-600 dark:text-slate-400';

                      return (
                        <tr
                          key={emp.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-3">
                              <AvatarImage
                                userId={emp.id}
                                name={emp.name}
                                hasAvatar={emp.hasAvatar}
                                size="sm"
                              />
                              <div>
                                <div className="font-semibold text-slate-900 dark:text-white">
                                  {emp.name}
                                </div>
                                <div className="text-xs text-slate-500">{emp.login}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <StatusBadge status={emp.status} workState={emp.workState} />
                          </td>
                          <td className="py-3 px-3 font-mono text-xs font-medium text-slate-800 dark:text-slate-200">
                            {formatMinutesDuration(emp.workedMinutes)} /{' '}
                            {formatMinutesDuration(emp.expectedMinutes)}
                          </td>
                          <td className={`py-3 px-3 font-mono text-xs ${balanceClass}`}>
                            {balanceFormatted}
                          </td>
                          <td className="py-3 px-3 text-xs text-slate-600 dark:text-slate-400 font-mono">
                            {emp.lastPunchAt ? (
                              <span>
                                {formatTime(emp.lastPunchAt)}{' '}
                                <span className="text-[10px] text-slate-500">
                                  ({emp.lastPunchKind === 'CLOCK_IN' ? 'Entrada' : 'Saída'})
                                </span>
                              </span>
                            ) : (
                              '--:--'
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => navigate(`/admin/funcionarios/${emp.id}`)}
                              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                            >
                              Ver Histórico
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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
                          {punch.employeeName}
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
                          {adj.employeeName}
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
