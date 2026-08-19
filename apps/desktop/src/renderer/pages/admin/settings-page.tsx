import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  Clock,
  History,
  Palmtree,
  Plus,
  Settings,
  Sparkles,
  Trash2,
  Utensils,
} from 'lucide-react';

import { useApiClient } from '../../auth/use-auth.js';
import type {
  CalendarException,
  ManagedUser,
  ScheduleDay,
  ScheduleVersion,
  Vacation,
} from '../../api/contracts.js';
import { AvatarImage } from '../../components/avatar-image.js';
import { DateInput } from '../../components/date-input.js';
import { Modal } from '../../components/modal.js';
import { SelectInput } from '../../components/select-input.js';
import { StatusBadge } from '../../components/status-badge.js';
import { useToast } from '../../components/toast-context.js';
import { formatDateBR } from '../../lib/format.js';

const WEEKDAYS = [
  { key: 'MONDAY', label: 'Segunda-feira' },
  { key: 'TUESDAY', label: 'Terça-feira' },
  { key: 'WEDNESDAY', label: 'Quarta-feira' },
  { key: 'THURSDAY', label: 'Quinta-feira' },
  { key: 'FRIDAY', label: 'Sexta-feira' },
  { key: 'SATURDAY', label: 'Sábado' },
  { key: 'SUNDAY', label: 'Domingo' },
];

function minuteToTimeString(minute?: number | null): string {
  if (minute === undefined || minute === null) return '';
  const h = String(Math.floor(minute / 60)).padStart(2, '0');
  const m = String(minute % 60).padStart(2, '0');
  return `${h}:${m}`;
}

function timeStringToMinute(timeStr: string): number | null {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  if (h === undefined || m === undefined || isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function calculateDayDurationMinutes(day: {
  isOpen: boolean;
  openingMinute?: number | null;
  closingMinute?: number | null;
  lunchEnabled?: boolean;
  lunchStartMinute?: number | null;
  lunchEndMinute?: number | null;
}): number {
  if (!day.isOpen || day.openingMinute == null || day.closingMinute == null) return 0;
  if (day.closingMinute <= day.openingMinute) return 0;
  let total = day.closingMinute - day.openingMinute;
  if (
    day.lunchEnabled &&
    day.lunchStartMinute != null &&
    day.lunchEndMinute != null &&
    day.lunchEndMinute > day.lunchStartMinute
  ) {
    total -= day.lunchEndMinute - day.lunchStartMinute;
  }
  return Math.max(0, total);
}

function calculateDayMinutesFromStrings(day: {
  isOpen: boolean;
  openingTime: string;
  closingTime: string;
  lunchEnabled: boolean;
}): number {
  if (!day.isOpen) return 0;
  const open = timeStringToMinute(day.openingTime);
  const close = timeStringToMinute(day.closingTime);
  if (open === null || close === null || close <= open) return 0;
  let total = close - open;
  if (day.lunchEnabled) {
    total -= 60; // Standard 1 hour lunch
  }
  return Math.max(0, total);
}

function formatMinutesToFriendly(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function formatScheduleEffectiveDate(effectiveDate: string, createdAt?: string): string {
  const isBaseline = effectiveDate.startsWith('1970') || Number(effectiveDate.slice(0, 4)) < 2000;
  if (isBaseline) {
    if (createdAt) {
      return formatDateBR(createdAt.split('T')[0] ?? createdAt);
    }
    return formatDateBR('2026-01-01');
  }
  return formatDateBR(effectiveDate);
}

export function AdminSettingsPage(): React.JSX.Element {
  const api = useApiClient();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'SCHEDULES' | 'EXCEPTIONS' | 'VACATIONS'>('SCHEDULES');

  // New Schedule Modal state
  const [newScheduleModalOpen, setNewScheduleModalOpen] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1); // Tomorrow as default
    return d.toISOString().split('T')[0] ?? '';
  });
  const [scheduleNote, setScheduleNote] = useState('');
  const [scheduleDays, setScheduleDays] = useState(() =>
    WEEKDAYS.map((w) => ({
      weekday: w.key,
      isOpen: w.key !== 'SUNDAY',
      openingTime: '08:00',
      closingTime: w.key === 'SATURDAY' ? '12:00' : '17:00',
      lunchEnabled: w.key !== 'SATURDAY' && w.key !== 'SUNDAY',
    })),
  );
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  // Preset helpers for schedule configuration
  const applyPreset44h = (): void => {
    setScheduleDays(
      WEEKDAYS.map((w) => ({
        weekday: w.key,
        isOpen: w.key !== 'SUNDAY',
        openingTime: '08:00',
        closingTime: w.key === 'SATURDAY' ? '12:00' : '17:00',
        lunchEnabled: w.key !== 'SATURDAY' && w.key !== 'SUNDAY',
      })),
    );
    toast.info('Modelo 44h aplicado (Seg-Sex 8h com 1h almoço + Sáb 4h)');
  };

  const applyPreset44hDirect = (): void => {
    setScheduleDays(
      WEEKDAYS.map((w) => ({
        weekday: w.key,
        isOpen: w.key !== 'SATURDAY' && w.key !== 'SUNDAY',
        openingTime: '08:00',
        closingTime: '17:48',
        lunchEnabled: w.key !== 'SATURDAY' && w.key !== 'SUNDAY',
      })),
    );
    toast.info('Modelo 44h sem sábado aplicado (Seg-Sex 8h48 com 1h almoço)');
  };

  const applyPreset40h = (): void => {
    setScheduleDays(
      WEEKDAYS.map((w) => ({
        weekday: w.key,
        isOpen: w.key !== 'SATURDAY' && w.key !== 'SUNDAY',
        openingTime: '08:00',
        closingTime: '17:00',
        lunchEnabled: w.key !== 'SATURDAY' && w.key !== 'SUNDAY',
      })),
    );
    toast.info('Modelo 40h aplicado (Seg-Sex 8h com 1h almoço)');
  };

  const applyPreset30h = (): void => {
    setScheduleDays(
      WEEKDAYS.map((w) => ({
        weekday: w.key,
        isOpen: w.key !== 'SATURDAY' && w.key !== 'SUNDAY',
        openingTime: '08:00',
        closingTime: '14:00',
        lunchEnabled: false,
      })),
    );
    toast.info('Modelo 30h aplicado (Seg-Sex 6h corridas)');
  };

  const replicateMonday = (): void => {
    const monday = scheduleDays[0];
    if (!monday) return;
    setScheduleDays(
      scheduleDays.map((d, index) => {
        if (index >= 1 && index <= 4) {
          return {
            ...d,
            isOpen: monday.isOpen,
            openingTime: monday.openingTime,
            closingTime: monday.closingTime,
            lunchEnabled: monday.lunchEnabled,
          };
        }
        return d;
      }),
    );
    toast.info('Horário de Segunda replicado para Terça a Sexta');
  };

  const totalWeeklyMinutes = scheduleDays.reduce(
    (acc, day) => acc + calculateDayMinutesFromStrings(day),
    0,
  );
  const openDaysCount = scheduleDays.filter((d) => d.isOpen).length;

  // Calendar Exception Modal state
  const [exceptionModalOpen, setExceptionModalOpen] = useState(false);
  const [exceptionDate, setExceptionDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0] ?? '';
  });
  const [exceptionKind, setExceptionKind] = useState<'HOLIDAY' | 'CLOSED' | 'SPECIAL_HOURS'>(
    'HOLIDAY',
  );
  const [exceptionName, setExceptionName] = useState('');
  const [exceptionOpening, setExceptionOpening] = useState('08:00');
  const [exceptionClosing, setExceptionClosing] = useState('12:00');
  const [exceptionLunchEnabled, setExceptionLunchEnabled] = useState(false);
  const [exceptionError, setExceptionError] = useState<string | null>(null);
  const [exceptionLoading, setExceptionLoading] = useState(false);

  // Vacations Modal State
  const [vacationModalOpen, setVacationModalOpen] = useState(false);
  const [vacationEmployeeId, setVacationEmployeeId] = useState('');
  const [vacationStartDate, setVacationStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0] ?? '';
  });
  const [vacationEndDate, setVacationEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0] ?? '';
  });
  const [vacationNote, setVacationNote] = useState('');
  const [vacationError, setVacationError] = useState<string | null>(null);
  const [vacationLoading, setVacationLoading] = useState(false);

  const vacationDaysCount = (() => {
    if (!vacationStartDate || !vacationEndDate) return 0;
    const startMs = Date.parse(`${vacationStartDate}T00:00:00Z`);
    const endMs = Date.parse(`${vacationEndDate}T00:00:00Z`);
    if (isNaN(startMs) || isNaN(endMs) || endMs < startMs) return 0;
    return Math.round((endMs - startMs) / 86_400_000) + 1;
  })();

  // Queries
  const { data: schedulesData, refetch: refetchSchedules } = useQuery({
    queryKey: ['admin-schedules-list'],
    queryFn: () => api.getSchedules({ limit: 20 }),
  });

  const { data: exceptionsData, refetch: refetchExceptions } = useQuery({
    queryKey: ['admin-exceptions-list'],
    queryFn: () => api.getCalendarExceptions({ limit: 50 }),
  });

  const { data: employeesData } = useQuery({
    queryKey: ['admin-employees-select'],
    queryFn: () => api.getEmployees({ limit: 100 }),
  });

  const { data: vacationsData, refetch: refetchVacations } = useQuery({
    queryKey: ['admin-vacations-list'],
    queryFn: () => api.getVacations({ limit: 100 }),
  });

  const latestSchedule = schedulesData?.items[0];

  const handleCreateSchedule = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    try {
      setScheduleLoading(true);
      setScheduleError(null);

      const daysPayload = scheduleDays.map((d) => {
        const openMin = d.isOpen ? timeStringToMinute(d.openingTime) : null;
        const closeMin = d.isOpen ? timeStringToMinute(d.closingTime) : null;

        if (d.isOpen) {
          if (openMin === null || closeMin === null) {
            throw new Error(`Informe os horários de entrada e saída para ${d.weekday}.`);
          }
          if (closeMin <= openMin) {
            throw new Error(`Horário de saída deve ser posterior à entrada (${d.weekday}).`);
          }
          if (d.lunchEnabled && closeMin - openMin < 60) {
            throw new Error(`O expediente deve ser superior a 1 hora para permitir 1h de almoço (${d.weekday}).`);
          }
        }

        let lunchStart: number | null = null;
        let lunchEnd: number | null = null;

        if (d.isOpen && d.lunchEnabled && openMin !== null && closeMin !== null) {
          if (openMin <= 720 && closeMin >= 780) {
            lunchStart = 720;
            lunchEnd = 780;
          } else {
            const midpoint = Math.floor((openMin + closeMin) / 2);
            lunchStart = midpoint - 30;
            lunchEnd = midpoint + 30;
          }
        }

        return {
          weekday: d.weekday,
          isOpen: d.isOpen,
          openingMinute: openMin,
          closingMinute: closeMin,
          lunchEnabled: d.isOpen && d.lunchEnabled,
          lunchStartMinute: lunchStart,
          lunchEndMinute: lunchEnd,
        };
      });

      await api.createSchedule({
        effectiveDate,
        ...(scheduleNote.trim() ? { note: scheduleNote.trim() } : {}),
        days: daysPayload,
      });

      setNewScheduleModalOpen(false);
      void refetchSchedules();
      toast.success('Nova versão de jornada cadastrada com sucesso!');
    } catch (err: unknown) {
      setScheduleError(err instanceof Error ? err.message : 'Falha ao salvar versão de horários.');
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleCreateException = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    try {
      setExceptionLoading(true);
      setExceptionError(null);

      const isSpecial = exceptionKind === 'SPECIAL_HOURS';
      const openMin = isSpecial ? timeStringToMinute(exceptionOpening) : null;
      const closeMin = isSpecial ? timeStringToMinute(exceptionClosing) : null;

      let lunchStart: number | null = null;
      let lunchEnd: number | null = null;

      if (isSpecial && exceptionLunchEnabled && openMin !== null && closeMin !== null) {
        if (openMin <= 720 && closeMin >= 780) {
          lunchStart = 720;
          lunchEnd = 780;
        } else {
          const midpoint = Math.floor((openMin + closeMin) / 2);
          lunchStart = midpoint - 30;
          lunchEnd = midpoint + 30;
        }
      }

      await api.upsertCalendarException({
        businessDate: exceptionDate,
        kind: exceptionKind,
        name: exceptionName.trim(),
        openingMinute: openMin,
        closingMinute: closeMin,
        lunchEnabled: isSpecial && exceptionLunchEnabled,
        lunchStartMinute: lunchStart,
        lunchEndMinute: lunchEnd,
      });

      setExceptionModalOpen(false);
      setExceptionName('');
      setExceptionDate('');
      void refetchExceptions();
      toast.success('Exceção de calendário adicionada!');
    } catch (err: unknown) {
      setExceptionError(err instanceof Error ? err.message : 'Falha ao adicionar exceção.');
    } finally {
      setExceptionLoading(false);
    }
  };

  const handleRetractException = async (exc: CalendarException): Promise<void> => {
    const rev = exc.latestRevision ?? exc.revisions?.[0];
    const name = rev?.name ?? exc.businessDate;
    if (!confirm(`Deseja remover a exceção de "${name}"?`)) {
      return;
    }
    try {
      await api.retractCalendarException(exc.id);
      void refetchExceptions();
      toast.success('Exceção removida com sucesso!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Falha ao remover exceção.');
    }
  };

  const handleCreateVacation = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    try {
      setVacationLoading(true);
      setVacationError(null);

      if (!vacationEmployeeId) {
        throw new Error('Selecione o colaborador que entrará de férias.');
      }
      if (!vacationStartDate || !vacationEndDate) {
        throw new Error('Informe as datas de início e término das férias.');
      }
      if (vacationStartDate > vacationEndDate) {
        throw new Error('A data de início deve ser anterior ou igual à data de término.');
      }

      await api.createVacation({
        employeeId: vacationEmployeeId,
        startDate: vacationStartDate,
        endDate: vacationEndDate,
        ...(vacationNote.trim() ? { note: vacationNote.trim() } : {}),
      });

      setVacationModalOpen(false);
      setVacationNote('');
      void refetchVacations();
      toast.success('Período de férias cadastrado com sucesso!');
    } catch (err: unknown) {
      setVacationError(err instanceof Error ? err.message : 'Falha ao cadastrar férias.');
    } finally {
      setVacationLoading(false);
    }
  };

  const handleDeleteVacation = async (vacation: Vacation): Promise<void> => {
    const confirmed = window.confirm(
      `Deseja realmente cancelar as férias de ${vacation.employee.name} (${formatDateBR(vacation.startDate)} a ${formatDateBR(vacation.endDate)})?`,
    );
    if (!confirmed) return;

    try {
      await api.deleteVacation(vacation.id);
      void refetchVacations();
      toast.success('Férias canceladas com sucesso!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Falha ao cancelar férias.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center">
            <Settings className="w-7 h-7 mr-2.5 text-blue-600" />
            Configurações de Trabalho
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Gerenciamento da grade horária semanal, jornadas vigentes, feriados e férias
          </p>
        </div>
        <div className="flex items-center space-x-2.5">
          {activeTab === 'SCHEDULES' && (
            <button
              type="button"
              onClick={() => {
                setScheduleError(null);
                setNewScheduleModalOpen(true);
              }}
              className="primary-button text-sm px-4 py-2 shadow-xs"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Nova Versão de Jornada
            </button>
          )}
          {activeTab === 'EXCEPTIONS' && (
            <button
              type="button"
              onClick={() => {
                setExceptionError(null);
                setExceptionModalOpen(true);
              }}
              className="primary-button text-sm px-4 py-2 shadow-xs"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Adicionar Feriado / Exceção
            </button>
          )}
          {activeTab === 'VACATIONS' && (
            <button
              type="button"
              onClick={() => {
                setVacationError(null);
                if (
                  !vacationEmployeeId &&
                  employeesData?.items &&
                  employeesData.items.length > 0
                ) {
                  setVacationEmployeeId(employeesData.items[0]?.id ?? '');
                }
                setVacationModalOpen(true);
              }}
              className="primary-button text-sm px-4 py-2 shadow-xs"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Cadastrar Férias
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-200/70 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-300/60 dark:border-slate-700/60">
        <button
          type="button"
          onClick={() => setActiveTab('SCHEDULES')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center ${
            activeTab === 'SCHEDULES'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Clock className="w-4 h-4 mr-2" />
          Horários de Funcionamento (Semanais)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('EXCEPTIONS')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center ${
            activeTab === 'EXCEPTIONS'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4 mr-2" />
          Feriados e Exceções de Calendário
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('VACATIONS')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center ${
            activeTab === 'VACATIONS'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Palmtree className="w-4 h-4 mr-2" />
          Férias dos Colaboradores
        </button>
      </div>

      {/* Tab 1: Schedules */}
      {activeTab === 'SCHEDULES' && (
        <div className="space-y-6">
          {latestSchedule && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-blue-600">
                    Jornada Vigente
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Em vigor desde {formatScheduleEffectiveDate(latestSchedule.effectiveDate, latestSchedule.createdAt)}
                  </h2>
                  {latestSchedule.note && (
                    <p className="text-xs text-slate-500 mt-0.5">{latestSchedule.note}</p>
                  )}
                </div>
                <div className="text-xs text-slate-400">
                  Criada por {latestSchedule.createdBy.name}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
                {latestSchedule.days.map((d: ScheduleDay) => {
                  const weekdayMeta = WEEKDAYS.find((w) => w.key === d.weekday);
                  const dayMinutes = calculateDayDurationMinutes(d);
                  return (
                    <div
                      key={d.weekday}
                      className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                        d.isOpen
                          ? 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 shadow-2xs'
                          : 'bg-slate-100/60 dark:bg-slate-800/20 border-slate-200/60 dark:border-slate-800 opacity-60'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-sm text-slate-900 dark:text-white">
                            {weekdayMeta?.label ?? d.weekday}
                          </div>
                          {d.isOpen && (
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                              {formatMinutesToFriendly(dayMinutes)}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-semibold mt-1">
                          {d.isOpen ? (
                            <span className="text-emerald-600 dark:text-emerald-400">Aberto</span>
                          ) : (
                            <span className="text-slate-400">Folga</span>
                          )}
                        </div>
                      </div>

                      {d.isOpen && (
                        <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 text-xs space-y-1 font-mono">
                          <div className="text-slate-700 dark:text-slate-300 font-semibold">
                            {minuteToTimeString(d.openingMinute)} →{' '}
                            {minuteToTimeString(d.closingMinute)}
                          </div>
                          {d.lunchEnabled ? (
                            <div className="text-[11px] font-sans text-blue-600 dark:text-blue-400 font-medium">
                              1h de almoço
                            </div>
                          ) : (
                            <div className="text-[11px] font-sans text-slate-400 italic">
                              Sem almoço
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* History of schedule versions */}
          {schedulesData && schedulesData.items.length > 1 && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center">
                <History className="w-4 h-4 mr-2 text-slate-500" /> Histórico de Versões da Jornada
              </h3>
              <div className="space-y-2">
                {schedulesData.items.slice(1).map((s: ScheduleVersion) => (
                  <div
                    key={s.id}
                    className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">
                        Vigência: {formatScheduleEffectiveDate(s.effectiveDate, s.createdAt)}
                      </span>
                      {s.note && <span className="text-slate-500 ml-2">({s.note})</span>}
                    </div>
                    <div className="text-slate-400">por {s.createdBy.name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Calendar Exceptions */}
      {activeTab === 'EXCEPTIONS' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Feriados e Exceções Cadastradas
            </h2>
            <p className="text-xs text-slate-500">
              Exceções por data sobrepõem os horários semanais padrão
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 text-xs uppercase font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Nome / Descrição</th>
                  <th className="py-3 px-4">Horário</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(!exceptionsData ||
                  exceptionsData.items.length === 0 ||
                  !exceptionsData.items.some((exc) => {
                    const rev = exc.latestRevision ?? exc.revisions?.[0];
                    return rev && rev.operation !== 'RETRACT' && exc.isActive !== false;
                  })) && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 text-sm">
                      Nenhum feriado ou exceção de horário cadastrado.
                    </td>
                  </tr>
                )}
                {exceptionsData?.items.map((exc: CalendarException) => {
                  const rev = exc.latestRevision ?? exc.revisions?.[0];
                  if (!rev || rev.operation === 'RETRACT' || exc.isActive === false) return null;
                  return (
                    <tr
                      key={exc.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 dark:text-white">
                        {formatDateBR(exc.businessDate)}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={rev.kind ?? 'CLOSED'} />
                      </td>
                      <td className="py-3.5 px-4 text-slate-800 dark:text-slate-200 font-medium">
                        {rev.name ?? 'Sem nome'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-600 dark:text-slate-400">
                        {rev.kind === 'SPECIAL_HOURS'
                          ? `${minuteToTimeString(rev.openingMinute)} → ${minuteToTimeString(rev.closingMinute)}${rev.lunchEnabled ? ' (1h almoço)' : ''}`
                          : '00:00 (Fechado)'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => void handleRetractException(exc)}
                          title="Cancelar exceção"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Vacations */}
      {activeTab === 'VACATIONS' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center">
                <Palmtree className="w-5 h-5 mr-2 text-teal-600 dark:text-teal-400" />
                Férias e Recessos dos Colaboradores
              </h2>
              <p className="text-xs text-slate-500">
                Nos dias de férias cadastrados, a jornada prevista do colaborador fica zerada e não é gerada falta.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60">
              {vacationsData?.items?.length ?? 0}{' '}
              {vacationsData?.items?.length === 1 ? 'registro' : 'registros'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 text-xs uppercase font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Colaborador</th>
                  <th className="py-3 px-4">Período de Férias</th>
                  <th className="py-3 px-4">Duração</th>
                  <th className="py-3 px-4">Motivo / Observação</th>
                  <th className="py-3 px-4">Cadastrado por</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(!vacationsData || vacationsData.items.length === 0) && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 text-sm">
                      <Palmtree className="w-8 h-8 mx-auto mb-2 opacity-40 text-teal-600" />
                      Nenhum período de férias cadastrado no momento.
                    </td>
                  </tr>
                )}
                {vacationsData?.items.map((vac: Vacation) => (
                  <tr
                    key={vac.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-3">
                        <AvatarImage
                          userId={vac.employeeId}
                          name={vac.employee.name}
                          size="sm"
                        />
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {vac.employee.name}
                          </div>
                          <div className="text-xs text-slate-400">@{vac.employee.login}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 dark:text-white">
                      {formatDateBR(vac.startDate)} → {formatDateBR(vac.endDate)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60">
                        {vac.daysCount} {vac.daysCount === 1 ? 'dia' : 'dias corridos'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 text-xs">
                      {vac.note || (
                        <span className="text-slate-400 italic">Férias regulares</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500">
                      {vac.createdBy.name}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => void handleDeleteVacation(vac)}
                        title="Cancelar período de férias"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Schedule Modal */}
      <Modal
        isOpen={newScheduleModalOpen}
        onClose={() => setNewScheduleModalOpen(false)}
        title="Nova Versão de Jornada de Trabalho"
        maxWidth="3xl"
      >
        <form onSubmit={(e) => void handleCreateSchedule(e)} className="space-y-5">
          {scheduleError && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-sm flex items-start space-x-2">
              <span className="font-bold">Aviso:</span>
              <span>{scheduleError}</span>
            </div>
          )}

          {/* Clean Lunch Info Banner */}
          <div className="bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 rounded-xl p-3.5 flex items-start gap-3">
            <Utensils className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-900 dark:text-blue-200 space-y-0.5">
              <div className="font-bold">Intervalo de Almoço Flexível (1 hora)</div>
              <p className="text-blue-800/80 dark:text-blue-300/80">
                Cada funcionário cumpre 1 hora de almoço diária em seu próprio turno de intervalo.
                Ao marcar a opção de almoço, o sistema deduz automaticamente 1 hora da carga horária de trabalho daquele dia.
              </p>
            </div>
          </div>

          {/* Quick presets bar */}
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Modelos Rápidos:</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={applyPreset44h}
                className="px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg transition-colors shadow-2xs cursor-pointer"
              >
                Padrão 44h (Seg-Sex + Sáb)
              </button>
              <button
                type="button"
                onClick={applyPreset44hDirect}
                className="px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors shadow-2xs cursor-pointer"
              >
                Padrão 44h (Seg-Sex 8h48)
              </button>
              <button
                type="button"
                onClick={applyPreset40h}
                className="px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors shadow-2xs cursor-pointer"
              >
                Padrão 40h (Seg-Sex 8h)
              </button>
              <button
                type="button"
                onClick={applyPreset30h}
                className="px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors shadow-2xs cursor-pointer"
              >
                Padrão 30h (Seg-Sex 6h)
              </button>
              <button
                type="button"
                onClick={replicateMonday}
                className="px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors shadow-2xs cursor-pointer"
                title="Copia o horário de Segunda para Terça, Quarta, Quinta e Sexta"
              >
                Replicar Seg ➔ Sex
              </button>
            </div>
          </div>

          {/* Vigência e Anotação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <DateInput
                label="Data de Início da Vigência *"
                required
                value={effectiveDate}
                onChange={setEffectiveDate}
                className="w-full"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Data a partir da qual estes horários passam a valer
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Anotação / Motivo (Opcional)
              </label>
              <input
                type="text"
                value={scheduleNote}
                onChange={(e) => setScheduleNote(e.target.value)}
                placeholder="Ex.: Ajuste de escala, novo expediente..."
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Grade Semanal */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between pb-0.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Grade Semanal de Horários
              </h4>
              <span className="text-xs text-slate-500">
                {openDaysCount} {openDaysCount === 1 ? 'dia útil' : 'dias úteis'} selecionados
              </span>
            </div>

            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {scheduleDays.map((d, index) => {
                const meta = WEEKDAYS.find((w) => w.key === d.weekday);
                const dayMinutes = calculateDayMinutesFromStrings(d);

                return (
                  <div
                    key={d.weekday}
                    className={`p-3.5 rounded-xl border transition-all ${
                      !d.isOpen
                        ? 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800 opacity-60'
                        : 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 shadow-2xs'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      {/* Left: Checkbox & Name */}
                      <div className="flex items-center space-x-3 md:w-44 shrink-0">
                        <input
                          type="checkbox"
                          id={`day-open-${d.weekday}`}
                          checked={d.isOpen}
                          onChange={(e) => {
                            const updated = [...scheduleDays];
                            const item = updated[index];
                            if (item) {
                              item.isOpen = e.target.checked;
                              setScheduleDays(updated);
                            }
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <label
                          htmlFor={`day-open-${d.weekday}`}
                          className="cursor-pointer select-none"
                        >
                          <div className="font-bold text-sm text-slate-900 dark:text-white">
                            {meta?.label}
                          </div>
                          <div className="text-[11px] font-medium">
                            {d.isOpen ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                Dia de Trabalho
                              </span>
                            ) : (
                              <span className="text-slate-400">Folga</span>
                            )}
                          </div>
                        </label>
                      </div>

                      {/* Middle: Clean Time and Lunch selectors */}
                      {d.isOpen ? (
                        <div className="flex-1 flex flex-wrap items-center gap-3">
                          {/* Expediente Block */}
                          <div className="flex items-center bg-slate-50 dark:bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-200/80 dark:border-slate-700 text-xs">
                            <span className="text-slate-500 dark:text-slate-400 font-semibold mr-2">
                              Expediente:
                            </span>
                            <input
                              type="time"
                              value={d.openingTime}
                              onChange={(e) => {
                                const updated = [...scheduleDays];
                                const item = updated[index];
                                if (item) {
                                  item.openingTime = e.target.value;
                                  setScheduleDays(updated);
                                }
                              }}
                              className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded font-mono font-semibold text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500"
                            />
                            <span className="text-slate-400 mx-2 font-medium">às</span>
                            <input
                              type="time"
                              value={d.closingTime}
                              onChange={(e) => {
                                const updated = [...scheduleDays];
                                const item = updated[index];
                                if (item) {
                                  item.closingTime = e.target.value;
                                  setScheduleDays(updated);
                                }
                              }}
                              className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded font-mono font-semibold text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500"
                            />
                          </div>

                          {/* Almoço Block */}
                          <div className="flex items-center bg-slate-50 dark:bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-200/80 dark:border-slate-700 text-xs">
                            <label className="flex items-center space-x-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={d.lunchEnabled}
                                onChange={(e) => {
                                  const updated = [...scheduleDays];
                                  const item = updated[index];
                                  if (item) {
                                    item.lunchEnabled = e.target.checked;
                                    setScheduleDays(updated);
                                  }
                                }}
                                className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                1h de Almoço
                              </span>
                            </label>
                            <span className="text-[11px] text-slate-400 ml-1.5">
                              {d.lunchEnabled ? '(-1h da jornada)' : '(Sem desconto)'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 text-xs text-slate-400 dark:text-slate-500 italic py-1">
                          Sem expediente configurado (Dia de Folga)
                        </div>
                      )}

                      {/* Right: Daily calculated hours */}
                      <div className="shrink-0 text-right md:w-24">
                        {d.isOpen ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60 font-mono">
                            {formatMinutesToFriendly(dayMinutes)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            Folga
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary footer */}
          <div className="p-4 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-200 text-sm">
              <Clock className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                Carga Semanal Prevista:{' '}
                <strong className="text-blue-600 dark:text-blue-400 font-mono text-base ml-1">
                  {formatMinutesToFriendly(totalWeeklyMinutes)}
                </strong>
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {openDaysCount} {openDaysCount === 1 ? 'dia de trabalho' : 'dias de trabalho'} •{' '}
              {7 - openDaysCount} {7 - openDaysCount === 1 ? 'folga' : 'folgas'}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              disabled={scheduleLoading}
              onClick={() => setNewScheduleModalOpen(false)}
              className="secondary-button text-sm px-4 py-2"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={scheduleLoading}
              className="primary-button text-sm px-5 py-2"
            >
              {scheduleLoading ? 'Salvando...' : 'Salvar Versão'}
            </button>
          </div>
        </form>
      </Modal>

      {/* New Exception Modal */}
      <Modal
        isOpen={exceptionModalOpen}
        onClose={() => setExceptionModalOpen(false)}
        title="Adicionar Feriado ou Exceção de Horário"
      >
        <form onSubmit={(e) => void handleCreateException(e)} className="space-y-4">
          {exceptionError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-sm">
              {exceptionError}
            </div>
          )}

          <div>
            <DateInput
              label="Data da Exceção *"
              required
              value={exceptionDate}
              onChange={setExceptionDate}
              className="w-full"
            />
          </div>

          <div>
            <SelectInput
              label="Tipo de Exceção *"
              value={exceptionKind}
              onChange={(v) =>
                setExceptionKind(v as 'HOLIDAY' | 'CLOSED' | 'SPECIAL_HOURS')
              }
              options={[
                { value: 'HOLIDAY', label: 'Feriado', sublabel: 'Fechado, Previsto 00:00' },
                { value: 'CLOSED', label: 'Fechado Administrativo', sublabel: 'Suspensão de expediente' },
                { value: 'SPECIAL_HOURS', label: 'Horário Especial', sublabel: 'Turno diferenciado' },
              ]}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nome / Descrição *
            </label>
            <input
              type="text"
              required
              value={exceptionName}
              onChange={(e) => setExceptionName(e.target.value)}
              placeholder="Ex.: Natal, Confraternização, Carnaval..."
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm"
            />
          </div>

          {exceptionKind === 'SPECIAL_HOURS' && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold mb-1">Entrada</label>
                  <input
                    type="time"
                    required
                    value={exceptionOpening}
                    onChange={(e) => setExceptionOpening(e.target.value)}
                    className="w-full p-2 bg-white dark:bg-slate-800 border rounded-md font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Saída</label>
                  <input
                    type="time"
                    required
                    value={exceptionClosing}
                    onChange={(e) => setExceptionClosing(e.target.value)}
                    className="w-full p-2 bg-white dark:bg-slate-800 border rounded-md font-mono text-xs"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-xs">
                <label className="flex items-center space-x-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={exceptionLunchEnabled}
                    onChange={(e) => setExceptionLunchEnabled(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    1h de Intervalo de Almoço
                  </span>
                </label>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              disabled={exceptionLoading}
              onClick={() => setExceptionModalOpen(false)}
              className="secondary-button text-sm px-4 py-2"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={exceptionLoading}
              className="primary-button text-sm px-5 py-2"
            >
              {exceptionLoading ? 'Salvando...' : 'Adicionar Exceção'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Vacation Modal */}
      <Modal
        isOpen={vacationModalOpen}
        onClose={() => setVacationModalOpen(false)}
        title="Cadastrar Férias de Colaborador"
      >
        <form onSubmit={(e) => void handleCreateVacation(e)} className="space-y-4">
          {vacationError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-sm">
              {vacationError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Colaborador *
            </label>
            <select
              required
              value={vacationEmployeeId}
              onChange={(e) => setVacationEmployeeId(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="" disabled>
                Selecione o colaborador...
              </option>
              {employeesData?.items?.map((emp: ManagedUser) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} (@{emp.login})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <DateInput
                label="Data de Início *"
                required
                value={vacationStartDate}
                onChange={setVacationStartDate}
                className="w-full"
              />
            </div>
            <div>
              <DateInput
                label="Data de Término *"
                required
                value={vacationEndDate}
                onChange={setVacationEndDate}
                className="w-full"
              />
            </div>
          </div>

          {vacationDaysCount > 0 && (
            <div className="p-3 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 rounded-lg text-teal-800 dark:text-teal-200 text-xs flex items-center justify-between">
              <span className="font-medium flex items-center">
                <Palmtree className="w-4 h-4 mr-1.5 text-teal-600" />
                Período Selecionado:
              </span>
              <span className="font-bold font-mono text-sm">
                {vacationDaysCount} {vacationDaysCount === 1 ? 'dia' : 'dias corridos'}
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Observação / Motivo (Opcional)
            </label>
            <input
              type="text"
              value={vacationNote}
              onChange={(e) => setVacationNote(e.target.value)}
              placeholder="Ex.: Férias anuais 2026, Recesso programado..."
              maxLength={255}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              disabled={vacationLoading}
              onClick={() => setVacationModalOpen(false)}
              className="secondary-button text-sm px-4 py-2"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={vacationLoading}
              className="primary-button text-sm px-5 py-2"
            >
              {vacationLoading ? 'Cadastrando...' : 'Cadastrar Férias'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
