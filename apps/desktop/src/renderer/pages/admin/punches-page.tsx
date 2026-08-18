import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, Edit2, Plus, RefreshCw, User } from 'lucide-react';

import type { EffectivePunch, EmployeeTodayStatus, ManagedUser } from '../../api/contracts.js';
import { useApiClient } from '../../auth/use-auth.js';
import { AvatarImage } from '../../components/avatar-image.js';
import { DateInput } from '../../components/date-input.js';
import { SelectInput } from '../../components/select-input.js';
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

export function AdminPunchesPage(): React.JSX.Element {
  const api = useApiClient();
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [manualPunchOpen, setManualPunchOpen] = useState(false);
  const [correctPunch, setCorrectPunch] = useState<{
    id: string;
    occurredAt: string;
    sequence: number;
    employeeName: string;
  } | null>(null);

  const { data: employeesList } = useQuery({
    queryKey: ['admin-employees-select'],
    queryFn: () => api.getEmployees({ limit: 100 }),
  });

  const { data: overview, refetch: refetchOverview } = useQuery({
    queryKey: ['admin-overview', selectedDate],
    queryFn: () => api.getAdminOverview(selectedDate),
    enabled: !selectedEmployeeId,
  });

  const {
    data: employeeDay,
    isLoading: employeeDayLoading,
    refetch: refetchEmployeeDay,
  } = useQuery({
    queryKey: ['admin-employee-day', selectedEmployeeId, selectedDate],
    queryFn: () => api.getAdminEmployeeDay(selectedEmployeeId, selectedDate),
    enabled: Boolean(selectedEmployeeId),
  });

  const selectedEmployeeObj = employeesList?.items.find(
    (e: ManagedUser) => e.id === selectedEmployeeId,
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center">
            <Clock className="w-5 h-5 mr-2 text-blue-600" /> Monitoramento e Ajustes de Ponto
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Visualize registros de batida, insira pontos manuais e efetue correções com histórico
          </p>
        </div>

        <button
          type="button"
          onClick={() => setManualPunchOpen(true)}
          className="primary-button text-xs py-2 px-4 shrink-0"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Inserir Ponto Manual
        </button>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <DateInput
          label="Data"
          value={selectedDate}
          onChange={setSelectedDate}
          className="w-full"
        />

        <div className="sm:col-span-2">
          <SelectInput
            label="Filtrar por Colaborador"
            placeholder="Todos os colaboradores"
            value={selectedEmployeeId}
            onChange={setSelectedEmployeeId}
            options={[
              { value: '', label: 'Todos os colaboradores' },
              ...(employeesList?.items ?? []).map((emp: ManagedUser) => ({
                value: emp.id,
                label: emp.name,
                sublabel: emp.login,
              })),
            ]}
            icon={<User className="w-4 h-4" />}
            searchable
            clearable
            className="w-full"
          />
        </div>
      </div>

      {/* Mode 1: Single Employee Day Punches */}
      {selectedEmployeeId && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center space-x-3">
              {selectedEmployeeObj && (
                <AvatarImage
                  userId={selectedEmployeeObj.id}
                  name={selectedEmployeeObj.name}
                  hasAvatar={selectedEmployeeObj.hasAvatar}
                  size="md"
                />
              )}
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {selectedEmployeeObj?.name ?? 'Colaborador'}
                </h2>
                <div className="text-xs text-slate-500">Batidas em {selectedDate}</div>
              </div>
            </div>

            {employeeDay && (
              <div className="flex items-center space-x-4 text-right text-xs">
                <div>
                  <div className="text-slate-500">Trabalhado / Previsto</div>
                  <div className="font-mono font-bold text-slate-900 dark:text-white">
                    {formatMinutesDuration(employeeDay.workedMinutes)} /{' '}
                    {formatMinutesDuration(employeeDay.expectedMinutes)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Status</div>
                  <StatusBadge status={employeeDay.status} workState={employeeDay.workState} />
                </div>
              </div>
            )}
          </div>

          {employeeDayLoading && (
            <div className="p-8 text-center text-slate-500">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
              Carregando batidas do colaborador...
            </div>
          )}

          {employeeDay && (
            <div className="space-y-3">
              {employeeDay.chronology.punches.length === 0 ? (
                <p className="text-sm text-slate-500 py-8 text-center">
                  Nenhum registro de ponto encontrado para esta data.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {employeeDay.chronology.punches.map((punch: EffectivePunch, idx: number) => (
                    <div
                      key={punch.id}
                      className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-xs">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="text-base font-mono font-bold text-slate-900 dark:text-white">
                            {formatTime(punch.effectiveOccurredAt)}
                          </div>
                          <div className="text-xs text-slate-500 flex items-center space-x-1.5">
                            <StatusBadge status={punch.kind} />
                            {punch.appliedAdjustmentCount > 0 && (
                              <span className="text-[11px] text-blue-600 font-semibold">
                                ({punch.appliedAdjustmentCount} correção)
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
                            employeeName: selectedEmployeeObj?.name ?? 'Colaborador',
                          })
                        }
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition-colors flex items-center"
                      >
                        <Edit2 className="w-3.5 h-3.5 mr-1 text-blue-600" />
                        Corrigir
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Mode 2: All Employees Punches for Selected Date */}
      {!selectedEmployeeId && overview && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Quadro Geral de Pontos ({formatDateBR(selectedDate)})
            </h2>
            <p className="text-xs text-slate-500">
              Registros e horários de entrada e saída de todos os colaboradores na data selecionada
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Colaborador</th>
                  <th className="py-3.5 px-3">Status</th>
                  <th className="py-3.5 px-3">Previsto</th>
                  <th className="py-3.5 px-3">Trabalhado</th>
                  <th className="py-3.5 px-3">Saldo</th>
                  <th className="py-3.5 px-3">Última Batida</th>
                  <th className="py-3.5 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {overview.employees.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-500 text-sm">
                      Nenhum colaborador encontrado.
                    </td>
                  </tr>
                )}
                {overview.employees.map((emp: EmployeeTodayStatus) => (
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
                          <div className="font-bold text-slate-900 dark:text-white">{emp.name}</div>
                          <div className="text-xs text-slate-500">{emp.login}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={emp.status} workState={emp.workState} />
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                      {formatMinutesDuration(emp.expectedMinutes)}
                    </td>
                    <td className="py-3 px-3 font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                      {formatMinutesDuration(emp.workedMinutes)}
                    </td>
                    <td
                      className={`py-3 px-3 font-mono text-xs font-bold ${
                        emp.balanceMinutes !== null && emp.balanceMinutes >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {emp.balanceMinutes !== null
                        ? formatMinutesDuration(emp.balanceMinutes)
                        : '--:--'}
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                      {emp.lastPunchAt ? formatTime(emp.lastPunchAt) : '--:--'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedEmployeeId(emp.id)}
                        className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Ver Batidas
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Punch Modal */}
      {employeesList && (
        <ManualPunchModal
          isOpen={manualPunchOpen}
          onClose={() => setManualPunchOpen(false)}
          employees={employeesList.items}
          {...(selectedEmployeeId ? { initialEmployeeId: selectedEmployeeId } : {})}
          onSuccess={() => {
            void refetchOverview();
            void refetchEmployeeDay();
          }}
        />
      )}

      {/* Punch Correction Modal */}
      {correctPunch && (
        <PunchCorrectionModal
          isOpen={true}
          onClose={() => setCorrectPunch(null)}
          punchId={correctPunch.id}
          employeeName={correctPunch.employeeName}
          originalOccurredAt={correctPunch.occurredAt}
          currentSequence={correctPunch.sequence}
          onSuccess={() => {
            void refetchOverview();
            void refetchEmployeeDay();
          }}
        />
      )}
    </div>
  );
}
