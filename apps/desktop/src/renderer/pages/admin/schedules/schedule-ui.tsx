import { ArrowLeftRight, Pencil } from 'lucide-react';

import type {
  ScheduleCell,
  ScheduleCellStatus,
  ScheduleWeekday,
} from '../../../api/schedule-contracts.js';

export const WEEKDAY_ORDER: readonly ScheduleWeekday[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

export const WEEKDAY_SHORT: Record<ScheduleWeekday, string> = {
  MONDAY: 'Seg',
  TUESDAY: 'Ter',
  WEDNESDAY: 'Qua',
  THURSDAY: 'Qui',
  FRIDAY: 'Sex',
  SATURDAY: 'Sáb',
  SUNDAY: 'Dom',
};

export const WEEKDAY_LONG: Record<ScheduleWeekday, string> = {
  MONDAY: 'Segunda',
  TUESDAY: 'Terça',
  WEDNESDAY: 'Quarta',
  THURSDAY: 'Quinta',
  FRIDAY: 'Sexta',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
};

/** 480 → "08:00". */
export function minuteToTime(minute: number | null | undefined): string {
  if (minute === null || minute === undefined) return '';
  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** "08:00" → 480; empty or invalid → null. */
export function timeToMinute(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (match === null) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 24 || minutes > 59 || (hours === 24 && minutes > 0)) return null;
  return hours * 60 + minutes;
}

/** 2400 → "40h", 2520 → "42h", 504 → "8h24". */
export function hoursLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, '0')}`;
}

export function addDays(date: string, days: number): string {
  const instant = new Date(`${date}T12:00:00Z`);
  instant.setUTCDate(instant.getUTCDate() + days);
  return instant.toISOString().slice(0, 10);
}

export function mondayOf(date: string): string {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(date, day === 0 ? -6 : 1 - day);
}

/** "2026-12-21" → "21/12". */
export function dayMonth(date: string): string {
  const [, month, day] = date.split('-');
  return `${day}/${month}`;
}

export function shiftLabel(cell: { startMinute: number | null; endMinute: number | null }): string {
  return `${minuteToTime(cell.startMinute)}–${minuteToTime(cell.endMinute)}`;
}

const STATUS_STYLE: Record<ScheduleCellStatus, { label: string; className: string }> = {
  WORK: {
    label: 'Trabalha',
    className:
      'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900',
  },
  REST: {
    label: 'Folga',
    className:
      'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  },
  HOLIDAY: {
    label: 'Feriado',
    className:
      'bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-950/40 dark:text-violet-200 dark:border-violet-900',
  },
  CLOSED: {
    label: 'Fechado',
    className:
      'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
  },
  VACATION: {
    label: 'Férias',
    className:
      'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-900',
  },
  ALLOWANCE: {
    label: 'Abono',
    className:
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900',
  },
  MEDICAL_LEAVE: {
    label: 'Atestado',
    className:
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900',
  },
  NOT_HIRED: {
    label: '—',
    className: 'bg-transparent text-slate-400 border-dashed border-slate-200 dark:border-slate-700',
  },
};

export function statusLabel(status: ScheduleCellStatus): string {
  return STATUS_STYLE[status].label;
}

/** One day in the grid: the shift, or a coloured word for folga, feriado, férias… */
export function ScheduleCellChip({
  cell,
  compact = false,
}: {
  cell: ScheduleCell;
  compact?: boolean;
}): React.JSX.Element {
  const style = STATUS_STYLE[cell.status];
  const isOverride = cell.overrideId !== null;
  return (
    <span
      className={`inline-flex w-full flex-col items-center justify-center rounded-lg border px-1.5 py-1.5 text-center leading-tight ${style.className}`}
    >
      <span className={`font-semibold ${compact ? 'text-[11px]' : 'text-xs'}`}>
        {cell.status === 'WORK' ? shiftLabel(cell) : style.label}
      </span>
      {cell.status === 'WORK' && cell.breakStartMinute !== null && !compact && (
        <span className="text-[10px] opacity-75">almoço {minuteToTime(cell.breakStartMinute)}</span>
      )}
      {cell.status === 'HOLIDAY' && cell.label && !compact && (
        <span className="max-w-full truncate text-[10px] opacity-75">{cell.label}</span>
      )}
      {isOverride && (
        <span className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-semibold opacity-90">
          {cell.overrideReason === 'SWAP' ? (
            <>
              <ArrowLeftRight className="h-3 w-3" aria-hidden="true" /> troca
            </>
          ) : (
            <>
              <Pencil className="h-3 w-3" aria-hidden="true" /> ajuste
            </>
          )}
        </span>
      )}
    </span>
  );
}
