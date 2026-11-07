import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, Loader2 } from 'lucide-react';
import { nationalHolidaysBetween, type NationalHoliday } from '@ph-ponto/shared';

import { useApiClient } from '../auth/use-auth.js';
import { businessDateFromInstant } from '../lib/business-date.js';
import { useToast } from './toast-context.js';

const QUERY_KEY = ['national-holidays-check'] as const;

function dayMonth(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

/**
 * National holidays from today to the end of next year that have no entry in the calendar.
 * A date with any entry (even one the admin removed) counts as decided and is never re-offered.
 */
export function useMissingNationalHolidays(): {
  missing: NationalHoliday[];
  isLoading: boolean;
} {
  const api = useApiClient();
  const today = businessDateFromInstant();
  const horizon = `${Number(today.slice(0, 4)) + 1}-12-31`;
  const query = useQuery({
    queryKey: [...QUERY_KEY, today],
    queryFn: async () => {
      const decided = new Set<string>();
      for (let page = 1; page <= 10; page += 1) {
        const list = await api.getCalendarExceptions({
          from: today,
          to: horizon,
          limit: 100,
          page,
        });
        for (const item of list.items) decided.add(item.businessDate);
        if (page >= list.pagination.totalPages) break;
      }
      return nationalHolidaysBetween(today, horizon).filter(
        (holiday) => !decided.has(holiday.businessDate),
      );
    },
    staleTime: 60_000,
  });
  return { missing: query.data ?? [], isLoading: query.isLoading };
}

export function useAddNationalHolidays() {
  const api = useApiClient();
  const toast = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (holidays: NationalHoliday[]) => {
      for (const holiday of holidays) {
        await api.upsertCalendarException({
          businessDate: holiday.businessDate,
          kind: 'HOLIDAY',
          name: holiday.name,
        });
      }
      return holidays.length;
    },
    onSuccess: async (count) => {
      toast.success(
        count === 1 ? '1 feriado nacional cadastrado.' : `${count} feriados nacionais cadastrados.`,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ['admin-exceptions-list'] }),
        queryClient.invalidateQueries({ queryKey: ['team-schedule'] }),
        queryClient.invalidateQueries({ queryKey: ['employee-schedule'] }),
      ]);
    },
    onError: async () => {
      toast.error('Nem todos os feriados foram cadastrados. Tente de novo.');
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

/** Amber notice with a one-click button; renders nothing when every holiday is registered. */
export function NationalHolidaysNotice({
  compact = false,
}: {
  /** Only speak up when one of the missing holidays falls in the next 90 days. */
  compact?: boolean;
}): React.JSX.Element | null {
  const { missing } = useMissingNationalHolidays();
  const add = useAddNationalHolidays();
  if (missing.length === 0) return null;
  const today = businessDateFromInstant();
  const soonLimit = new Date(`${today}T12:00:00Z`);
  soonLimit.setUTCDate(soonLimit.getUTCDate() + 90);
  const soon = missing.filter(
    (holiday) => holiday.businessDate <= soonLimit.toISOString().slice(0, 10),
  );
  if (compact && soon.length === 0) return null;
  const highlight = (soon.length > 0 ? soon : missing).slice(0, 3);
  const others = missing.length - highlight.length;

  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <div className="flex items-start gap-3">
        <CalendarPlus className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div>
          <strong className="block">Feriados nacionais fora do calendário</strong>
          {highlight
            .map((holiday) => `${holiday.name} (${dayMonth(holiday.businessDate)})`)
            .join(', ')}
          {others > 0 ? ` e mais ${others}` : ''} ainda não estão cadastrados. Sem eles, o sistema
          espera que a equipe trabalhe nesses dias.
        </div>
      </div>
      <button
        type="button"
        disabled={add.isPending}
        onClick={() => add.mutate(missing)}
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
      >
        {add.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Cadastrar {missing.length === 1 ? 'o feriado' : `os ${missing.length} feriados`}
      </button>
    </div>
  );
}
