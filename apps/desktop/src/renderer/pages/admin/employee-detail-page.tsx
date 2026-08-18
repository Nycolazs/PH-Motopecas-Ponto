import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Camera,
  Edit2,
  History,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import type { DailyAttendance, EffectivePunch } from '../../api/contracts.js';
import { useApiClient } from '../../auth/use-auth.js';
import { AvatarImage } from '../../components/avatar-image.js';
import { AvatarModal } from '../../components/avatar-modal.js';
import { ManualPunchModal } from '../../components/manual-punch-modal.js';
import { PunchCorrectionModal } from '../../components/punch-correction-modal.js';
import { StatusBadge } from '../../components/status-badge.js';
import { formatDateBR } from '../../lib/format.js';
import { formatMinutesDuration } from '@ph-ponto/shared';

function formatTime(isoString?: string | null): string {
  if (!isoString) return '--:--';
  const d = new Date(isoString);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function AdminEmployeeDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const employeeId = id ?? '';
  const api = useApiClient();
  const navigate = useNavigate();

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });

  const [activeTab, setActiveTab] = useState<'CALENDAR' | 'PUNCHES'>('CALENDAR');
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);

  // Modals
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [manualPunchOpen, setManualPunchOpen] = useState(false);
  const [correctPunch, setCorrectPunch] = useState<{
    id: string;
    occurredAt: string;
    sequence: number;
  } | null>(null);

  // Queries
  const { data: employee, refetch: refetchEmployee } = useQuery({
    queryKey: ['admin-employee-detail', employeeId],
    queryFn: () => api.getEmployee(employeeId),
    enabled: Boolean(employeeId),
  });

  const {
    data: monthly,
    isLoading: monthlyLoading,
    refetch: refetchMonthly,
  } = useQuery({
    queryKey: ['admin-employee-monthly', employeeId, currentMonth],
    queryFn: () => api.getAdminEmployeeMonthly(employeeId, currentMonth),
    enabled: Boolean(employeeId),
  });

  if (!employeeId) {
    return <div className="p-6">Colaborador não identificado.</div>;
  }

  const selectedDay = selectedDayDate
    ? monthly?.days.find((d: DailyAttendance) => d.businessDate === selectedDayDate)
    : monthly?.days[0];

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/admin/funcionarios')}
          className="inline-flex items-center text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Voltar para Funcionários
        </button>

        <div className="flex items-center space-x-3">
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

      {/* Employee Profile Header Card */}
      {employee && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center space-x-4">
            <div className="relative group">
              <AvatarImage
                userId={employee.id}
                name={employee.name}
                hasAvatar={employee.hasAvatar}
                size="xl"
              />
              <button
                type="button"
                onClick={() => setAvatarOpen(true)}
                title="Alterar foto"
                className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <Camera className="w-5 h-5 text-white" />
              </button>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  {employee.name}
                </h1>
                <StatusBadge isActive={employee.isActive} />
              </div>
              <div className="text-sm font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                Login: {employee.login}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Cadastrado em {formatDateBR(employee.createdAt)}
              </div>
            </div>
          </div>

          {/* Month Totals Summary */}
          {monthly && (
            <div className="grid grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0 w-full md:w-auto">
              <div className="text-center px-2">
                <div className="text-xs font-semibold text-slate-500 uppercase">Trabalhado</div>
                <div className="text-base font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                  {formatMinutesDuration(monthly.totals.workedMinutes)}
                </div>
              </div>
              <div className="text-center px-2 border-x border-slate-200 dark:border-slate-700">
                <div className="text-xs font-semibold text-slate-500 uppercase">Esperado</div>
                <div className="text-base font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                  {formatMinutesDuration(monthly.totals.expectedMinutes)}
                </div>
              </div>
              <div className="text-center px-2">
                <div className="text-xs font-semibold text-slate-500 uppercase">Saldo Mês</div>
                <div
                  className={`text-base font-bold font-mono mt-0.5 ${
                    monthly.totals.balanceMinutes >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {formatMinutesDuration(monthly.totals.balanceMinutes)}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Month Navigator & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setActiveTab('CALENDAR')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center ${
              activeTab === 'CALENDAR'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <CalendarIcon className="w-4 h-4 mr-2" />
            Calendário Mensal
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('PUNCHES')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center ${
              activeTab === 'PUNCHES'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <History className="w-4 h-4 mr-2" />
            Extrato de Batidas
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-xs font-semibold text-slate-500">Mês de referência:</span>
          <input
            type="month"
            value={currentMonth}
            onChange={(e) => setCurrentMonth(e.target.value)}
            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-900 dark:text-white"
          />
        </div>
      </div>

      {monthlyLoading && (
        <div className="p-12 flex flex-col items-center justify-center space-y-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
          <p className="text-sm font-medium">Carregando espelho de ponto...</p>
        </div>
      )}

      {/* Tab 1: Monthly Calendar Grid */}
      {activeTab === 'CALENDAR' && monthly && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Day Grid */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">
              Dias Trabalhados no Mês
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
              {monthly.days.map((day: DailyAttendance) => {
                const dayNumber = day.businessDate.split('-')[2];
                const isSelected = selectedDayDate === day.businessDate;

                return (
                  <button
                    key={day.businessDate}
                    type="button"
                    onClick={() => setSelectedDayDate(day.businessDate)}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      isSelected
                        ? 'border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/40 dark:bg-blue-950/30'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold text-slate-900 dark:text-white">
                        {dayNumber}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {day.punchCount} pts
                      </span>
                    </div>

                    <div className="mt-2 space-y-1">
                      <StatusBadge
                        status={day.status}
                        workState={day.workState}
                        className="text-[10px] py-0 px-1.5"
                      />
                      <div className="text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-300">
                        {formatMinutesDuration(day.workedMinutes)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Day Punch Detail */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-5">
            {selectedDay ? (
              <>
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Detalhes do Dia {formatDateBR(selectedDay.businessDate)}
                    </h3>
                    <div className="mt-1">
                      <StatusBadge status={selectedDay.status} workState={selectedDay.workState} />
                    </div>
                  </div>
                  <div className="text-right font-mono text-xs">
                    <div className="text-slate-500">Saldo do dia</div>
                    <div
                      className={`font-bold text-sm ${
                        selectedDay.balanceMinutes !== null && selectedDay.balanceMinutes >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {selectedDay.balanceMinutes !== null
                        ? formatMinutesDuration(selectedDay.balanceMinutes)
                        : '--:--'}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Batidas Registradas
                  </h4>
                  {selectedDay.chronology.punches.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4 text-center">
                      Nenhuma batida registrada nesta data.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {selectedDay.chronology.punches.map((punch: EffectivePunch, idx: number) => (
                        <div
                          key={punch.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-sm"
                        >
                          <div className="flex items-center space-x-3">
                            <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold">
                              {idx + 1}
                            </span>
                            <div>
                              <div className="font-mono font-bold text-slate-900 dark:text-white">
                                {formatTime(punch.effectiveOccurredAt)}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {punch.kind === 'CLOCK_IN' ? 'Entrada' : 'Saída'}
                                {punch.appliedAdjustmentCount > 0 && (
                                  <span className="text-blue-600 ml-1">
                                    ({punch.appliedAdjustmentCount} ajuste(s))
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setCorrectPunch({
                                id: punch.id,
                                occurredAt: punch.effectiveOccurredAt,
                                sequence: punch.appliedAdjustmentCount,
                              })
                            }
                            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 hover:underline flex items-center"
                          >
                            <Edit2 className="w-3.5 h-3.5 mr-1" />
                            Corrigir
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 space-y-1">
                  <div>
                    Horas previstas na jornada: {formatMinutesDuration(selectedDay.expectedMinutes)}
                  </div>
                  <div>Intervalos completos: {selectedDay.completedIntervalCount}</div>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500 text-center py-8">
                Selecione um dia no calendário ao lado.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Full Extrato Table */}
      {activeTab === 'PUNCHES' && monthly && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Data</th>
                  <th className="py-3.5 px-3">Status</th>
                  <th className="py-3.5 px-3">Previsto</th>
                  <th className="py-3.5 px-3">Trabalhado</th>
                  <th className="py-3.5 px-3">Saldo</th>
                  <th className="py-3.5 px-4">Batidas Efetivas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {monthly.days.map((day: DailyAttendance) => (
                  <tr
                    key={day.businessDate}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                      {formatDateBR(day.businessDate)}
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={day.status} workState={day.workState} />
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                      {formatMinutesDuration(day.expectedMinutes)}
                    </td>
                    <td className="py-3 px-3 font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                      {formatMinutesDuration(day.workedMinutes)}
                    </td>
                    <td
                      className={`py-3 px-3 font-mono text-xs font-bold ${
                        day.balanceMinutes !== null && day.balanceMinutes >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {day.balanceMinutes !== null
                        ? formatMinutesDuration(day.balanceMinutes)
                        : '--:--'}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700 dark:text-slate-300">
                      {day.chronology.punches.length === 0 ? (
                        <span className="text-slate-400">Sem registros</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {day.chronology.punches.map((p: EffectivePunch) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() =>
                                setCorrectPunch({
                                  id: p.id,
                                  occurredAt: p.effectiveOccurredAt,
                                  sequence: p.appliedAdjustmentCount,
                                })
                              }
                              title="Clique para corrigir este horário"
                              className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-950/50 dark:hover:text-blue-300 border border-slate-200 dark:border-slate-700 transition-colors"
                            >
                              {formatTime(p.effectiveOccurredAt)}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Avatar Modal */}
      {employee && (
        <AvatarModal
          isOpen={avatarOpen}
          onClose={() => setAvatarOpen(false)}
          userId={employee.id}
          userName={employee.name}
          hasAvatar={employee.hasAvatar}
          onAvatarUpdated={() => void refetchEmployee()}
        />
      )}

      {/* Manual Punch Modal */}
      {employee && (
        <ManualPunchModal
          isOpen={manualPunchOpen}
          onClose={() => setManualPunchOpen(false)}
          employees={[employee]}
          initialEmployeeId={employee.id}
          onSuccess={() => void refetchMonthly()}
        />
      )}

      {/* Punch Correction Modal */}
      {correctPunch && employee && (
        <PunchCorrectionModal
          isOpen={true}
          onClose={() => setCorrectPunch(null)}
          punchId={correctPunch.id}
          employeeName={employee.name}
          originalOccurredAt={correctPunch.occurredAt}
          currentSequence={correctPunch.sequence}
          onSuccess={() => void refetchMonthly()}
        />
      )}
    </div>
  );
}
