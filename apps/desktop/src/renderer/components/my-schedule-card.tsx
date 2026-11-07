import { useQuery } from '@tanstack/react-query';
import { CalendarRange } from 'lucide-react';

import { useApiClient } from '../auth/use-auth.js';
import { dayMonth, ScheduleCellChip, WEEKDAY_SHORT } from '../pages/admin/schedules/schedule-ui.js';

/** The employee's next seven days: shift or folga, with swaps and holidays marked. */
export function MyScheduleCard(): React.JSX.Element | null {
  const api = useApiClient();
  const schedule = useQuery({ queryKey: ['my-schedule'], queryFn: () => api.getMySchedule() });

  if (schedule.isPending) return null;
  return (
    <section
      aria-labelledby="my-schedule-title"
      className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900"
    >
      <h2
        id="my-schedule-title"
        className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white"
      >
        <CalendarRange className="h-4 w-4 text-blue-600" aria-hidden="true" />
        Minha escala nos próximos dias
      </h2>
      {schedule.isError ? (
        <p className="text-sm text-slate-500">
          Não foi possível carregar sua escala agora.{' '}
          <button
            type="button"
            className="font-semibold text-blue-700 underline"
            onClick={() => void schedule.refetch()}
          >
            Tentar de novo
          </button>
        </p>
      ) : (
        <ol className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {schedule.data.days.slice(0, 7).map((day, index) => (
            <li key={day.businessDate} className="text-center">
              <span className="mb-1 block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {index === 0 ? 'Hoje' : WEEKDAY_SHORT[day.weekday]} {dayMonth(day.businessDate)}
              </span>
              <ScheduleCellChip cell={day} compact />
            </li>
          ))}
        </ol>
      )}
      {schedule.data?.nextChange && (
        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/40">
          <p className="mb-2 text-sm font-semibold text-blue-900 dark:text-blue-100">
            Sua escala muda a partir de {dayMonth(schedule.data.nextChange.effectiveDate)}. A
            primeira semana fica assim:
          </p>
          <ol className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {schedule.data.nextChange.days.map((day) => (
              <li key={day.businessDate} className="text-center">
                <span className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  {WEEKDAY_SHORT[day.weekday]} {dayMonth(day.businessDate)}
                </span>
                <ScheduleCellChip cell={day} compact />
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
