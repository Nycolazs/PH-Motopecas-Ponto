interface StatusBadgeProps {
  status?: string | null;
  workState?: string | null;
  isActive?: boolean | null;
  className?: string;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  NORMAL: {
    label: 'Normal',
    className:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  },
  OVERTIME: {
    label: 'Hora extra',
    className:
      'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  },
  MISSING_HOURS: {
    label: 'Horas faltantes',
    className:
      'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  },
  INCOMPLETE: {
    label: 'Ponto incompleto',
    className:
      'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  },
  HOLIDAY: {
    label: 'Feriado',
    className:
      'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  },
  DAY_OFF: {
    label: 'Folga',
    className:
      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  },
  CLOSED: {
    label: 'Fechado',
    className:
      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
  },
  WORKING: {
    label: 'Trabalhando',
    className:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 animate-pulse',
  },
  NOT_STARTED: {
    label: 'Não iniciado',
    className:
      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
  },
  OFF_DUTY: {
    label: 'Fora do expediente',
    className:
      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  },
  ACTIVE: {
    label: 'Ativo',
    className:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  },
  INACTIVE: {
    label: 'Inativo',
    className:
      'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  },
  SUCCESS: {
    label: 'Sucesso',
    className:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  },
  FAILURE: {
    label: 'Falha',
    className:
      'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  },
  CLOCK_IN: {
    label: 'Entrada',
    className:
      'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  },
  CLOCK_OUT: {
    label: 'Saída',
    className:
      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  },
  EMPLOYEE: {
    label: 'Colaborador',
    className:
      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  },
  ADMIN_INSERTION: {
    label: 'Inserção manual',
    className:
      'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  },
};

export function StatusBadge({
  status,
  workState,
  isActive,
  className = '',
}: StatusBadgeProps): React.JSX.Element {
  let key = status ?? workState ?? '';
  if (isActive !== undefined && isActive !== null) {
    key = isActive ? 'ACTIVE' : 'INACTIVE';
  }

  const meta = STATUS_LABELS[key] ?? {
    label: key || 'Desconhecido',
    className:
      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${meta.className} ${className}`}
    >
      {meta.label}
    </span>
  );
}
