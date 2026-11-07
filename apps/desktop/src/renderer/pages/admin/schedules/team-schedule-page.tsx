import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  Settings2,
  Users,
  WandSparkles,
} from 'lucide-react';

import { ApiClientError } from '../../../api/client.js';
import type {
  ScheduleCell,
  ScheduleWeekday,
  TeamScheduleRow,
} from '../../../api/schedule-contracts.js';
import { useApiClient } from '../../../auth/use-auth.js';
import { AvatarImage } from '../../../components/avatar-image.js';
import { NationalHolidaysNotice } from '../../../components/national-holidays-notice.js';
import { PageHeader } from '../../../components/page-header.js';
import { businessDateFromInstant } from '../../../lib/business-date.js';
import { formatDisplayName } from '../../../lib/format.js';
import { DayActionModal } from './day-action-modal.js';
import { ScheduleEditorModal, STANDARD_SHIFT, type DefaultShift } from './schedule-editor-modal.js';
import {
  addDays,
  dayMonth,
  hoursLabel,
  minuteToTime,
  mondayOf,
  ScheduleCellChip,
  WEEKDAY_SHORT,
} from './schedule-ui.js';
import { WorkRegimeModal } from './work-regime-modal.js';

/** First business day of the EC 141 transition (two rest days per week). */
export const TRANSITION_START = '2026-12-15';

function restDaysOf(row: TeamScheduleRow): ScheduleWeekday[] {
  return row.days
    .slice(0, 7)
    .filter((day) => day.status === 'REST')
    .map((day) => day.weekday);
}

function shiftOf(row: TeamScheduleRow): DefaultShift {
  const work = row.days.find((day) => day.status === 'WORK' && day.plannedMinutes >= 360);
  if (!work) return STANDARD_SHIFT;
  return {
    start: minuteToTime(work.startMinute),
    end: minuteToTime(work.endMinute),
    breakStart: minuteToTime(work.breakStartMinute),
    breakEnd: minuteToTime(work.breakEndMinute),
  };
}

/**
 * "Escalas da equipe": one week, one row per person, a cell per day. Clicking a day changes
 * just that day; "Montar escala" sets the person's regular week.
 */
export function TeamSchedulePage(): React.JSX.Element {
  const api = useApiClient();
  const today = businessDateFromInstant();
  const [weekStart, setWeekStart] = useState(() => mondayOf(today));
  const weekEnd = addDays(weekStart, 6);
  const [editing, setEditing] = useState<TeamScheduleRow | null>(null);
  const [dayAction, setDayAction] = useState<{ row: TeamScheduleRow; cell: ScheduleCell } | null>(
    null,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Two weeks are loaded so a rest day can be moved into the next week.
  const query = useQuery({
    queryKey: ['team-schedule', weekStart],
    queryFn: () => api.getTeamSchedule(weekStart, addDays(weekStart, 13)),
  });

  const data = query.data;
  const visibleDates = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );
  const rows = data?.employees ?? [];
  const peopleWithIssues = rows.filter((row) =>
    row.issues.some((issue) => issue.businessDate <= weekEnd && issue.severity === 'ERROR'),
  );
  // Who still has no own escala starting by the transition date.
  const pendingTransition =
    today < TRANSITION_START
      ? rows.filter((row) => row.ownScheduleFrom === null || row.ownScheduleFrom > TRANSITION_START)
          .length
      : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Escalas da Equipe"
        icon={CalendarRange}
        description="Veja quem trabalha e quem folga em cada dia. Clique em um dia para trocar uma folga ou mudar só aquele dia."
        help={{
          article: 'escalas-e-folgas',
          section: 'grade',
          title: 'Como usar a grade',
          text: 'Cada linha é uma pessoa. Clique em um dia para trocar a folga ou mudar só aquele dia; use Montar escala para definir a semana dela.',
        }}
        actions={
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Settings2 className="h-4 w-4" aria-hidden="true" />
            Regras da empresa
          </button>
        }
      />

      <NationalHolidaysNotice compact />

      {pendingTransition > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <strong className="block">Escala 5x2 obrigatória a partir de 15/12/2026</strong>
            Cada pessoa passa a ter 2 folgas por semana. {pendingTransition}{' '}
            {pendingTransition === 1 ? 'colaborador ainda não tem' : 'colaboradores ainda não têm'}{' '}
            escala a partir dessa data. Use <strong>Montar escala</strong> na linha de cada um e
            escolha a data 15/12/2026.
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Semana anterior"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            className="rounded-lg border border-slate-300 p-2 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <strong className="min-w-[190px] text-center text-sm text-slate-800 dark:text-slate-100">
            Semana de {dayMonth(weekStart)} a {dayMonth(weekEnd)}
          </strong>
          <button
            type="button"
            aria-label="Próxima semana"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            className="rounded-lg border border-slate-300 p-2 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {weekStart !== mondayOf(today) && (
            <button
              type="button"
              onClick={() => setWeekStart(mondayOf(today))}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/40"
            >
              Esta semana
            </button>
          )}
        </div>
        {data && (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Regra em vigor nesta semana:{' '}
            <strong>{rows[0]?.weeks[0]?.regimeLabel ?? data.regimeToday}</strong>
          </span>
        )}
      </div>

      {query.isLoading && (
        <p className="flex items-center gap-2 p-6 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Carregando escalas…
        </p>
      )}
      {query.error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-red-800 dark:bg-red-950/40 dark:text-red-200"
        >
          {query.error instanceof ApiClientError
            ? query.error.message
            : 'Não foi possível carregar as escalas.'}
        </p>
      )}
      {data && rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500 dark:border-slate-700">
          <Users className="mx-auto mb-2 h-8 w-8" aria-hidden="true" />
          Nenhum colaborador ativo. Cadastre a equipe em <strong>Colaboradores</strong>.
        </div>
      )}

      {data && rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full min-w-[920px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-semibold dark:bg-slate-900">
                  Colaborador
                </th>
                {visibleDates.map((date) => {
                  const cell = rows[0]!.days.find((day) => day.businessDate === date);
                  return (
                    <th
                      key={date}
                      className={`px-1.5 py-2 text-center font-semibold ${date === today ? 'text-blue-700 dark:text-blue-300' : ''}`}
                    >
                      {cell ? WEEKDAY_SHORT[cell.weekday] : ''}
                      <span className="block text-[11px] font-normal">{dayMonth(date)}</span>
                    </th>
                  );
                })}
                <th className="px-3 py-2 text-right font-semibold">Semana</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const week = row.weeks.find((item) => item.weekStart === weekStart);
                const over = week !== undefined && week.plannedMinutes > week.weeklyLimitMinutes;
                const hasErrors = row.issues.some(
                  (issue) => issue.severity === 'ERROR' && issue.businessDate <= weekEnd,
                );
                return (
                  <tr
                    key={row.employeeId}
                    className="border-b border-slate-100 dark:border-slate-800"
                  >
                    <td className="sticky left-0 z-10 bg-white px-3 py-2 dark:bg-slate-900">
                      <div className="flex items-center gap-2.5">
                        <AvatarImage
                          userId={row.employeeId}
                          name={row.name}
                          hasAvatar={row.hasAvatar}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-900 dark:text-white">
                            {formatDisplayName(row.name)}
                          </div>
                          {row.ownScheduleFrom !== null && row.ownScheduleFrom > today && (
                            <span className="block text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                              Nova escala a partir de {dayMonth(row.ownScheduleFrom)}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setEditing(row)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300"
                          >
                            <WandSparkles className="h-3 w-3" aria-hidden="true" />
                            {row.hasOwnSchedule || row.ownScheduleFrom !== null
                              ? 'Alterar escala'
                              : 'Montar escala'}
                          </button>
                        </div>
                      </div>
                    </td>
                    {visibleDates.map((date) => {
                      const cell = row.days.find((day) => day.businessDate === date);
                      return (
                        <td
                          key={date}
                          className={`px-1 py-1.5 ${date === today ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''}`}
                        >
                          {cell && (
                            <button
                              type="button"
                              onClick={() => setDayAction({ row, cell })}
                              aria-label={`${formatDisplayName(row.name)}, ${dayMonth(date)}: alterar este dia`}
                              className="block w-full rounded-lg focus-visible:outline-2 focus-visible:outline-blue-500"
                            >
                              <ScheduleCellChip cell={cell} />
                            </button>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right">
                      {week && (
                        <span
                          className={`inline-flex items-center gap-1 font-bold tabular-nums ${over ? 'text-red-700 dark:text-red-300' : 'text-slate-800 dark:text-slate-100'}`}
                          title={`Limite: ${hoursLabel(week.weeklyLimitMinutes)} (${week.regimeLabel})`}
                        >
                          {hasErrors ? (
                            <AlertTriangle
                              className="h-3.5 w-3.5 text-red-600"
                              aria-label="Fora das regras"
                            />
                          ) : (
                            <CheckCircle2
                              className="h-3.5 w-3.5 text-emerald-600"
                              aria-label="Dentro das regras"
                            />
                          )}
                          {hoursLabel(week.plannedMinutes)}
                        </span>
                      )}
                      {week && (
                        <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                          {week.restDays} {week.restDays === 1 ? 'folga' : 'folgas'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 text-xs dark:bg-slate-800/60">
                <td className="sticky left-0 z-10 bg-slate-50 px-3 py-2 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  Pessoas trabalhando
                </td>
                {visibleDates.map((date) => {
                  const coverage = data.coverage.find((item) => item.businessDate === date);
                  return (
                    <td
                      key={date}
                      className={`px-1 py-2 text-center font-bold tabular-nums ${coverage?.belowMinimum ? 'text-red-700 dark:text-red-300' : 'text-slate-700 dark:text-slate-200'}`}
                      title={
                        coverage?.belowMinimum
                          ? `Abaixo do mínimo de ${data.settings.minimumStaff}`
                          : undefined
                      }
                    >
                      {coverage?.storeOpen === false && coverage.working === 0
                        ? '—'
                        : coverage?.working}
                      {coverage?.belowMinimum && ' ⚠'}
                    </td>
                  );
                })}
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {data && peopleWithIssues.length > 0 && (
        <section className="rounded-xl border border-red-200 bg-white p-4 shadow-xs dark:border-red-900 dark:bg-slate-900">
          <h2 className="mb-2 flex items-center gap-2 font-bold text-red-800 dark:text-red-200">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />O que precisa de atenção
          </h2>
          <ul className="space-y-2 text-sm">
            {peopleWithIssues.map((row) => (
              <li key={row.employeeId}>
                <strong className="text-slate-900 dark:text-white">
                  {formatDisplayName(row.name)}:
                </strong>{' '}
                <span className="text-slate-700 dark:text-slate-300">
                  {row.issues
                    .filter((issue) => issue.severity === 'ERROR' && issue.businessDate <= weekEnd)
                    .slice(0, 3)
                    .map((issue) => issue.message)
                    .join(' ')}
                </span>{' '}
                <button
                  type="button"
                  onClick={() => setEditing(row)}
                  className="font-semibold text-blue-700 hover:underline dark:text-blue-300"
                >
                  Corrigir escala
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data && (
        <p className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Quem não tem escala própria segue o horário da loja (Jornadas &amp; Regras). Feriados e
          férias aparecem automaticamente.
        </p>
      )}

      {editing && (
        <ScheduleEditorModal
          isOpen={editing !== null}
          onClose={() => setEditing(null)}
          employee={{ id: editing.employeeId, name: editing.name }}
          currentRestDays={restDaysOf(editing)}
          defaultShift={shiftOf(editing)}
        />
      )}
      <DayActionModal
        isOpen={dayAction !== null}
        onClose={() => setDayAction(null)}
        employee={
          dayAction
            ? { id: dayAction.row.employeeId, name: dayAction.row.name }
            : { id: '', name: '' }
        }
        cell={dayAction?.cell ?? null}
        otherDays={dayAction?.row.days ?? []}
      />
      {data && (
        <WorkRegimeModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={data.settings}
        />
      )}
    </div>
  );
}
