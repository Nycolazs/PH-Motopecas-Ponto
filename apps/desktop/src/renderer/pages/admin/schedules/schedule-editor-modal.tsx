import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Info, Loader2, RotateCcw, Sparkles } from 'lucide-react';

import { ApiClientError } from '../../../api/client.js';
import type {
  ScheduleDraftInput,
  ScheduleWeekday,
  ShiftInput,
} from '../../../api/schedule-contracts.js';
import { useApiClient } from '../../../auth/use-auth.js';
import { DateInput } from '../../../components/date-input.js';
import { Modal } from '../../../components/modal.js';
import { useToast } from '../../../components/toast-context.js';
import { businessDateFromInstant } from '../../../lib/business-date.js';
import { formatDisplayName } from '../../../lib/format.js';
import {
  addDays,
  dayMonth,
  hoursLabel,
  minuteToTime,
  mondayOf,
  timeToMinute,
  WEEKDAY_LONG,
  WEEKDAY_ORDER,
} from './schedule-ui.js';

interface DayDraft {
  isWorkday: boolean;
  start: string;
  end: string;
  breakStart: string;
  breakEnd: string;
}
type WeekDraft = Record<ScheduleWeekday, DayDraft>;

export interface DefaultShift {
  start: string;
  end: string;
  breakStart: string;
  breakEnd: string;
}

export const STANDARD_SHIFT: DefaultShift = {
  start: '08:00',
  end: '17:00',
  breakStart: '12:00',
  breakEnd: '13:00',
};

function buildWeek(rest: readonly ScheduleWeekday[], shift: DefaultShift): WeekDraft {
  return Object.fromEntries(
    WEEKDAY_ORDER.map((weekday) => [
      weekday,
      rest.includes(weekday)
        ? { isWorkday: false, start: '', end: '', breakStart: '', breakEnd: '' }
        : { isWorkday: true, ...shift },
    ]),
  ) as WeekDraft;
}

function dayMinutes(day: DayDraft): number {
  if (!day.isWorkday) return 0;
  const start = timeToMinute(day.start);
  const end = timeToMinute(day.end);
  if (start === null || end === null || end <= start) return 0;
  const breakStart = timeToMinute(day.breakStart);
  const breakEnd = timeToMinute(day.breakEnd);
  const pause =
    breakStart !== null && breakEnd !== null && breakEnd > breakStart ? breakEnd - breakStart : 0;
  return end - start - pause;
}

function toShiftInput(day: DayDraft): ShiftInput {
  if (!day.isWorkday) return { isWorkday: false };
  return {
    isWorkday: true,
    startMinute: timeToMinute(day.start),
    endMinute: timeToMinute(day.end),
    breakStartMinute: timeToMinute(day.breakStart),
    breakEndMinute: timeToMinute(day.breakEnd),
  };
}

export interface ScheduleEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: { id: string; name: string };
  /** Rest days the person has today (pre-fills the custom model). */
  currentRestDays?: readonly ScheduleWeekday[];
  defaultShift?: DefaultShift;
  /** First day to offer (e.g. the Monday of the 5x2 transition week); defaults to next Monday. */
  suggestedDate?: string | undefined;
}

type Mode = 'FIXED' | 'ROTATING' | 'COMPANY';

/**
 * "Montar escala": the administrator picks the rest days and the hours; the system sums the
 * week, checks the labour rules for the next weeks and explains any problem before saving.
 */
export function ScheduleEditorModal({
  isOpen,
  onClose,
  employee,
  currentRestDays,
  defaultShift = STANDARD_SHIFT,
  suggestedDate,
}: ScheduleEditorModalProps): React.JSX.Element | null {
  const api = useApiClient();
  const toast = useToast();
  const queryClient = useQueryClient();
  const today = businessDateFromInstant();
  const [effectiveDate, setEffectiveDate] = useState(today);
  const [mode, setMode] = useState<Mode>('FIXED');
  const [shift, setShift] = useState<DefaultShift>(defaultShift);
  const [weeks, setWeeks] = useState<WeekDraft[]>([
    buildWeek(['SUNDAY', 'SATURDAY'], defaultShift),
  ]);
  const [activeWeek, setActiveWeek] = useState(0);
  const [secondRestDay, setSecondRestDay] = useState<ScheduleWeekday>('SATURDAY');
  const [note, setNote] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const nextMonday = mondayOf(today) === today ? today : addDays(mondayOf(today), 7);
    setEffectiveDate(
      suggestedDate !== undefined && suggestedDate >= today ? suggestedDate : nextMonday,
    );
    setMode('FIXED');
    setShift(defaultShift);
    const rest =
      currentRestDays && currentRestDays.length >= 2
        ? currentRestDays
        : (['SATURDAY', 'SUNDAY'] as const);
    setWeeks([buildWeek(rest, defaultShift)]);
    setSecondRestDay(rest.find((day) => day !== 'SUNDAY') ?? 'SATURDAY');
    setActiveWeek(0);
    setNote('');
    setAcknowledged(false);
    setSaveError(null);
  }, [isOpen, employee.id]);

  const draft: ScheduleDraftInput = useMemo(
    () =>
      mode === 'COMPANY'
        ? { effectiveDate, usesCompanySchedule: true }
        : {
            effectiveDate,
            weeks: weeks.map((week) => ({
              days: WEEKDAY_ORDER.map((weekday) => ({ weekday, ...toShiftInput(week[weekday]) })),
            })),
          },
    [effectiveDate, mode, weeks],
  );
  const [debouncedDraft, setDebouncedDraft] = useState(draft);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedDraft(draft), 350);
    return () => window.clearTimeout(timer);
  }, [draft]);

  const preview = useQuery({
    queryKey: ['schedule-preview', employee.id, debouncedDraft],
    queryFn: () => api.previewEmployeeSchedule(employee.id, debouncedDraft),
    enabled: isOpen && /^\d{4}-\d{2}-\d{2}$/.test(debouncedDraft.effectiveDate),
    retry: false,
    staleTime: 60_000,
  });

  const errors = preview.data?.issues.filter((issue) => issue.severity === 'ERROR') ?? [];
  const warnings = preview.data?.issues.filter((issue) => issue.severity === 'WARNING') ?? [];
  const previewError =
    preview.error instanceof ApiClientError
      ? preview.error.message
      : preview.error
        ? 'Não foi possível verificar a escala.'
        : null;

  const save = useMutation({
    mutationFn: () =>
      api.publishEmployeeSchedule(employee.id, {
        ...draft,
        note: note.trim() || null,
        confirmIssues: acknowledged,
      }),
    onSuccess: async () => {
      toast.success(`Escala de ${formatDisplayName(employee.name)} salva.`);
      await queryClient.invalidateQueries({ queryKey: ['team-schedule'] });
      await queryClient.invalidateQueries({ queryKey: ['employee-schedule', employee.id] });
      onClose();
    },
    onError: (error) => {
      setSaveError(
        error instanceof ApiClientError ? error.message : 'Não foi possível salvar a escala.',
      );
    },
  });

  const applyPreset = (preset: 'SUNDAY_PLUS' | 'WEEKEND' | 'ROTATING') => {
    setMode(preset === 'ROTATING' ? 'ROTATING' : 'FIXED');
    setActiveWeek(0);
    if (preset === 'WEEKEND') setWeeks([buildWeek(['SATURDAY', 'SUNDAY'], shift)]);
    if (preset === 'SUNDAY_PLUS') setWeeks([buildWeek(['SUNDAY', secondRestDay], shift)]);
    if (preset === 'ROTATING') {
      setWeeks([
        buildWeek(['SATURDAY', 'SUNDAY'], shift),
        buildWeek(['SUNDAY', secondRestDay === 'SATURDAY' ? 'MONDAY' : secondRestDay], shift),
      ]);
    }
  };

  const applyShiftToAll = () => {
    setWeeks((current) =>
      current.map(
        (week) =>
          Object.fromEntries(
            WEEKDAY_ORDER.map((weekday) => [
              weekday,
              week[weekday].isWorkday ? { isWorkday: true, ...shift } : week[weekday],
            ]),
          ) as WeekDraft,
      ),
    );
  };

  const updateDay = (weekday: ScheduleWeekday, patch: Partial<DayDraft>) => {
    setWeeks((current) =>
      current.map((week, index) => {
        if (index !== activeWeek) return week;
        const next = { ...week[weekday], ...patch };
        if (patch.isWorkday === true && next.start === '') Object.assign(next, shift);
        if (patch.isWorkday === false)
          Object.assign(next, { start: '', end: '', breakStart: '', breakEnd: '' });
        return { ...week, [weekday]: next };
      }),
    );
  };

  const name = formatDisplayName(employee.name);
  const week = weeks[activeWeek] ?? weeks[0]!;
  const weekTotal = WEEKDAY_ORDER.reduce((sum, weekday) => sum + dayMinutes(week[weekday]), 0);
  const restCount = WEEKDAY_ORDER.filter((weekday) => !week[weekday].isWorkday).length;
  const canSave =
    !save.isPending &&
    !preview.isFetching &&
    preview.data !== undefined &&
    (errors.length === 0 || acknowledged);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Escala de ${name}`} maxWidth="4xl">
      <div className="space-y-5 text-sm">
        {/* 1. When */}
        <section className="grid gap-4 sm:grid-cols-[220px_1fr] sm:items-end">
          <label className="block">
            <span className="mb-1 block font-semibold text-slate-700 dark:text-slate-200">
              1. Vale a partir de
            </span>
            <DateInput value={effectiveDate} onChange={setEffectiveDate} min={today} />
          </label>
          <p className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {effectiveDate === suggestedDate && suggestedDate !== undefined
                ? `A escala 5x2 é obrigatória a partir de 15/12/2026, uma terça. Começar na segunda, ${dayMonth(suggestedDate)}, garante 2 folgas já na semana da mudança.`
                : 'O ponto já registrado não muda. A escala nova vale do dia escolhido em diante; até lá continua valendo a atual.'}
            </span>
          </p>
        </section>

        {/* 2. Model */}
        <section>
          <span className="mb-2 block font-semibold text-slate-700 dark:text-slate-200">
            2. Escolha um modelo
          </span>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <PresetButton
              active={
                mode === 'FIXED' &&
                weeks.length === 1 &&
                !weeks[0]!.SUNDAY.isWorkday &&
                !weeks[0]!.SATURDAY.isWorkday
              }
              title="Sábado e domingo"
              text="Folga fixa no fim de semana (5x2)."
              onClick={() => applyPreset('WEEKEND')}
            />
            <div
              className={`rounded-xl border p-3 ${mode === 'FIXED' && !(!weeks[0]!.SATURDAY.isWorkday && !weeks[0]!.SUNDAY.isWorkday) ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-900' : 'border-slate-200 dark:border-slate-700'}`}
            >
              <button
                type="button"
                className="w-full text-left"
                onClick={() => applyPreset('SUNDAY_PLUS')}
              >
                <strong className="block text-slate-900 dark:text-white">Domingo + 1 dia</strong>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Loja aberta no sábado.
                </span>
              </button>
              <select
                aria-label="Segundo dia de folga"
                value={secondRestDay}
                onChange={(event) => {
                  const day = event.target.value as ScheduleWeekday;
                  setSecondRestDay(day);
                  setMode('FIXED');
                  setActiveWeek(0);
                  setWeeks([buildWeek(['SUNDAY', day], shift)]);
                }}
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800"
              >
                {WEEKDAY_ORDER.filter((day) => day !== 'SUNDAY').map((day) => (
                  <option key={day} value={day}>
                    + {WEEKDAY_LONG[day]}
                  </option>
                ))}
              </select>
            </div>
            <PresetButton
              active={mode === 'ROTATING'}
              title="Rodízio de 2 semanas"
              text="Uma semana folga sáb+dom, na outra dom + outro dia."
              onClick={() => applyPreset('ROTATING')}
            />
            <PresetButton
              active={mode === 'COMPANY'}
              title="Horário da empresa"
              text="Sem escala própria: segue o horário da loja."
              onClick={() => setMode('COMPANY')}
            />
          </div>
        </section>

        {mode !== 'COMPANY' && (
          <>
            {/* 3. Hours */}
            <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <div className="mb-3 flex flex-wrap items-end gap-3">
                <span className="w-full font-semibold text-slate-700 dark:text-slate-200">
                  3. Horário de trabalho
                </span>
                <TimeField
                  label="Entrada"
                  value={shift.start}
                  onChange={(start) => setShift({ ...shift, start })}
                />
                <TimeField
                  label="Saída"
                  value={shift.end}
                  onChange={(end) => setShift({ ...shift, end })}
                />
                <TimeField
                  label="Almoço de"
                  value={shift.breakStart}
                  onChange={(breakStart) => setShift({ ...shift, breakStart })}
                />
                <TimeField
                  label="até"
                  value={shift.breakEnd}
                  onChange={(breakEnd) => setShift({ ...shift, breakEnd })}
                />
                <button
                  type="button"
                  onClick={applyShiftToAll}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  Usar em todos os dias de trabalho
                </button>
              </div>

              {weeks.length > 1 && (
                <div className="mb-3 flex gap-2" role="tablist" aria-label="Semanas do rodízio">
                  {weeks.map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      role="tab"
                      aria-selected={activeWeek === index}
                      onClick={() => setActiveWeek(index)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${activeWeek === index ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}
                    >
                      Semana {index + 1}
                      {index === 0 && ` (começa em ${dayMonth(mondayOf(effectiveDate || today))})`}
                    </button>
                  ))}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-xs">
                  <thead>
                    <tr className="text-left text-slate-500 dark:text-slate-400">
                      <th className="py-1.5 font-semibold">Dia</th>
                      <th className="py-1.5 font-semibold">Trabalha?</th>
                      <th className="py-1.5 font-semibold">Entrada</th>
                      <th className="py-1.5 font-semibold">Saída</th>
                      <th className="py-1.5 font-semibold">Almoço</th>
                      <th className="py-1.5 text-right font-semibold">Horas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {WEEKDAY_ORDER.map((weekday) => {
                      const day = week[weekday];
                      return (
                        <tr
                          key={weekday}
                          className="border-t border-slate-100 dark:border-slate-800"
                        >
                          <td className="py-1.5 font-semibold text-slate-800 dark:text-slate-100">
                            {WEEKDAY_LONG[weekday]}
                          </td>
                          <td className="py-1.5">
                            <div className="inline-flex overflow-hidden rounded-lg border border-slate-300 dark:border-slate-600">
                              <button
                                type="button"
                                aria-pressed={day.isWorkday}
                                onClick={() => updateDay(weekday, { isWorkday: true })}
                                className={`px-2.5 py-1 font-semibold ${day.isWorkday ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
                              >
                                Sim
                              </button>
                              <button
                                type="button"
                                aria-pressed={!day.isWorkday}
                                onClick={() => updateDay(weekday, { isWorkday: false })}
                                className={`px-2.5 py-1 font-semibold ${!day.isWorkday ? 'bg-slate-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
                              >
                                Folga
                              </button>
                            </div>
                          </td>
                          {day.isWorkday ? (
                            <>
                              <td className="py-1.5">
                                <TimeInput
                                  label={`Entrada de ${WEEKDAY_LONG[weekday]}`}
                                  value={day.start}
                                  onChange={(start) => updateDay(weekday, { start })}
                                />
                              </td>
                              <td className="py-1.5">
                                <TimeInput
                                  label={`Saída de ${WEEKDAY_LONG[weekday]}`}
                                  value={day.end}
                                  onChange={(end) => updateDay(weekday, { end })}
                                />
                              </td>
                              <td className="py-1.5">
                                <span className="inline-flex items-center gap-1">
                                  <TimeInput
                                    label={`Início do almoço de ${WEEKDAY_LONG[weekday]}`}
                                    value={day.breakStart}
                                    onChange={(breakStart) => updateDay(weekday, { breakStart })}
                                  />
                                  <span className="text-slate-400">–</span>
                                  <TimeInput
                                    label={`Fim do almoço de ${WEEKDAY_LONG[weekday]}`}
                                    value={day.breakEnd}
                                    onChange={(breakEnd) => updateDay(weekday, { breakEnd })}
                                  />
                                </span>
                              </td>
                            </>
                          ) : (
                            <td colSpan={3} className="py-1.5 text-slate-400">
                              Folga
                            </td>
                          )}
                          <td className="py-1.5 text-right font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                            {day.isWorkday ? hoursLabel(dayMinutes(day)) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 dark:border-slate-700">
                      <td
                        colSpan={5}
                        className="py-2 font-semibold text-slate-700 dark:text-slate-200"
                      >
                        Total da semana{weeks.length > 1 ? ` ${activeWeek + 1}` : ''} · {restCount}{' '}
                        {restCount === 1 ? 'folga' : 'folgas'}
                      </td>
                      <td className="py-2 text-right text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                        {hoursLabel(weekTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          </>
        )}

        {/* 4. Check */}
        <section
          className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
          aria-live="polite"
        >
          <span className="mb-2 block font-semibold text-slate-700 dark:text-slate-200">
            {mode === 'COMPANY' ? '3.' : '4.'} Conferência das regras (próximas 8 semanas)
          </span>
          {preview.isFetching && (
            <p className="flex items-center gap-2 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Conferindo…
            </p>
          )}
          {!preview.isFetching && previewError && (
            <p className="flex items-start gap-2 text-red-700 dark:text-red-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {previewError}
            </p>
          )}
          {!preview.isFetching && preview.data && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {preview.data.weeks.slice(0, 4).map((item) => {
                  const over = item.plannedMinutes > item.weeklyLimitMinutes;
                  return (
                    <span
                      key={item.weekStart}
                      title={item.regimeLabel}
                      className={`rounded-lg border px-2.5 py-1 text-xs ${over ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200' : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}
                    >
                      Semana {dayMonth(item.weekStart)}:{' '}
                      <strong>{hoursLabel(item.plannedMinutes)}</strong> de{' '}
                      {hoursLabel(item.weeklyLimitMinutes)} · {item.restDays}{' '}
                      {item.restDays === 1 ? 'folga' : 'folgas'}
                    </span>
                  );
                })}
              </div>
              {errors.length === 0 && warnings.length === 0 && (
                <p className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Tudo certo com as regras
                  de jornada.
                </p>
              )}
              <IssueList
                title="Precisa corrigir"
                tone="error"
                items={errors.map((issue) => issue.message)}
              />
              <IssueList
                title="Atenção"
                tone="warning"
                items={warnings.map((issue) => issue.message)}
              />
              {errors.length > 0 && (
                <label className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-900 dark:bg-red-950/40 dark:text-red-200">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(event) => setAcknowledged(event.target.checked)}
                    className="mt-0.5"
                  />
                  Entendo os problemas acima e quero salvar mesmo assim (por exemplo, há acordo com
                  o sindicato que ainda não foi informado nas regras).
                </label>
              )}
            </div>
          )}
        </section>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
            Observação (opcional)
          </span>
          <input
            value={note}
            maxLength={240}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ex.: Combinado com a colaboradora em 10/12"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
          />
        </label>

        {saveError && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-red-800 dark:bg-red-950/40 dark:text-red-200"
          >
            {saveError}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => {
              setSaveError(null);
              save.mutate();
            }}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {save.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            )}
            Salvar escala
          </button>
        </div>
      </div>
    </Modal>
  );
}

function PresetButton({
  active,
  title,
  text,
  onClick,
}: {
  active: boolean;
  title: string;
  text: string;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-xl border p-3 text-left transition-colors hover:border-blue-400 ${active ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-900' : 'border-slate-200 dark:border-slate-700'}`}
    >
      <strong className="block text-slate-900 dark:text-white">{title}</strong>
      <span className="text-xs text-slate-500 dark:text-slate-400">{text}</span>
    </button>
  );
}

function TimeInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}): React.JSX.Element {
  return (
    <input
      type="time"
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-[7.5rem] rounded-md border border-slate-300 bg-white px-1.5 py-1 tabular-nums dark:border-slate-600 dark:bg-slate-800"
    />
  );
}

function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}): React.JSX.Element {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">{label}</span>
      <input
        type="time"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-[8rem] rounded-lg border border-slate-300 bg-white px-2 py-1.5 tabular-nums dark:border-slate-600 dark:bg-slate-800"
      />
    </label>
  );
}

export function IssueList({
  title,
  tone,
  items,
}: {
  title: string;
  tone: 'error' | 'warning';
  items: readonly string[];
}): React.JSX.Element | null {
  if (items.length === 0) return null;
  const style =
    tone === 'error'
      ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200'
      : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200';
  const shown = items.slice(0, 6);
  return (
    <div className={`rounded-lg border p-3 text-xs ${style}`}>
      <strong className="mb-1 flex items-center gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> {title}
      </strong>
      <ul className="list-disc space-y-0.5 pl-5">
        {shown.map((item, index) => (
          <li key={`${index}-${item}`}>{item}</li>
        ))}
      </ul>
      {items.length > shown.length && <p className="mt-1">e mais {items.length - shown.length}.</p>}
    </div>
  );
}

export { minuteToTime };
