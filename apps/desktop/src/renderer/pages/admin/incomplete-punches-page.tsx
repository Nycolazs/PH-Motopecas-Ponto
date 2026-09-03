import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';

import { useApiClient } from '../../auth/use-auth.js';
import { AvatarImage } from '../../components/avatar-image.js';
import { MonthPicker } from '../../components/month-picker.js';
import { formatDateBR } from '../../lib/format.js';
import type { IncompleteAttendanceDayItem } from '../../api/contracts.js';

function formatPunchTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    });
  } catch {
    return '--:--';
  }
}

function getWeekdayName(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y!, m! - 1, d!);
    return date.toLocaleDateString('pt-BR', { weekday: 'long' });
  } catch {
    return '';
  }
}

export function IncompletePunchesPage(): React.JSX.Element {
  const api = useApiClient();
  const navigate = useNavigate();

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });

  const [searchTerm, setSearchTerm] = useState('');

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin-incomplete-attendance', selectedMonth],
    queryFn: ({ signal }) => api.getAdminIncompleteDays(selectedMonth, signal),
  });

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    if (!searchTerm.trim()) return data.items;
    const term = searchTerm.toLowerCase();
    return data.items.filter(
      (item: IncompleteAttendanceDayItem) =>
        item.employeeName.toLowerCase().includes(term) ||
        item.employeeLogin.toLowerCase().includes(term) ||
        item.businessDate.includes(term),
    );
  }, [data?.items, searchTerm]);

  const handleFixDay = (employeeId: string, businessDate: string): void => {
    navigate(`/admin/funcionarios/${employeeId}?date=${businessDate}`);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                Batidas Incompletas
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Colaboradores com registros pendentes de finalização ou batidas ímpares
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Mês:</span>
            <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
          </div>

          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isLoading || isFetching}
            className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            title="Atualizar listagem"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Dias Incompletos
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {isLoading ? '--' : data?.totalIncompleteDays ?? 0}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Funcionários Afetados
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {isLoading ? '--' : data?.totalAffectedEmployees ?? 0}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div
            className={`p-3 rounded-xl ${
              (data?.totalIncompleteDays ?? 0) === 0
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
            }`}
          >
            {(data?.totalIncompleteDays ?? 0) === 0 ? (
              <CheckCircle2 className="w-6 h-6" />
            ) : (
              <AlertTriangle className="w-6 h-6" />
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Status Geral
            </p>
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {isLoading
                ? 'Carregando...'
                : (data?.totalIncompleteDays ?? 0) === 0
                  ? 'Todos os pontos em ordem'
                  : 'Requer correções manuais'}
            </p>
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Buscar por colaborador ou login..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 bg-transparent border-none text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Main List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center space-y-3 text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-xs font-medium">Buscando batidas incompletas...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="inline-flex p-3 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 mb-2">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {searchTerm
                ? 'Nenhum resultado para a busca'
                : 'Nenhum ponto incompleto neste mês'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {searchTerm
                ? 'Tente buscar com outro nome de colaborador ou login.'
                : 'Todas as batidas de ponto registradas pelos colaboradores estão completas e regulares para o mês selecionado.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredItems.map((item: IncompleteAttendanceDayItem) => {
              const weekday = getWeekdayName(item.businessDate);
              const formattedDate = formatDateBR(item.businessDate);

              return (
                <div
                  key={`${item.employeeId}-${item.businessDate}`}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                >
                  {/* Left Column: Employee & Date Info */}
                  <div className="flex items-start sm:items-center gap-4 min-w-[280px]">
                    <AvatarImage
                      hasAvatar={item.hasAvatar}
                      userId={item.employeeId}
                      name={item.employeeName}
                      className="w-12 h-12 rounded-xl text-base shadow-xs shrink-0"
                    />

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {item.employeeName}
                        </span>
                        <span className="text-xs font-medium text-slate-400">
                          @{item.employeeLogin}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {formattedDate}
                        </span>
                        <span className="capitalize text-slate-400">({weekday})</span>
                      </div>
                    </div>
                  </div>

                  {/* Middle Column: Punches Sequence */}
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Batidas Registradas:
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60">
                        {item.punchCount} {item.punchCount === 1 ? 'batida' : 'batidas'} (ímpar)
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {item.punches.map((p, idx) => {
                        const time = formatPunchTime(p.effectiveOccurredAt);
                        const isOdd = idx % 2 === 0;
                        return (
                          <div
                            key={p.id}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 border ${
                              isOdd
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/60'
                                : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900/60'
                            }`}
                          >
                            <span className="font-bold">{time}</span>
                            <span className="text-[10px] opacity-75">
                              {isOdd ? 'Entrada' : 'Saída'}
                            </span>
                          </div>
                        );
                      })}
                      <div className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Falta Batida</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Action Button */}
                  <div className="flex items-center justify-end shrink-0 pt-2 md:pt-0">
                    <button
                      type="button"
                      onClick={() => handleFixDay(item.employeeId, item.businessDate)}
                      className="primary-button text-xs py-2 px-4 flex items-center gap-2 font-semibold shadow-xs hover:shadow-md transition-all cursor-pointer"
                    >
                      <span>Corrigir Ponto</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
