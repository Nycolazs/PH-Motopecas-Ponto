interface StatusBadgeProps {
  status?: string | null;
  workState?: string | null;
  isActive?: boolean | null;
  className?: string;
}

const STATUS_LABELS: Record<string, { label: string; className: string; dotClass: string }> = {
  NORMAL: {
    label: 'Normal',
    className:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    dotClass: 'bg-emerald-500',
  },
  OVERTIME: {
    label: 'Hora extra',
    className:
      'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    dotClass: 'bg-blue-500',
  },
  MISSING_HOURS: {
    label: 'Horas faltantes',
    className:
      'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    dotClass: 'bg-amber-500',
  },
  INCOMPLETE: {
    label: 'Ponto incompleto',
    className:
      'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    dotClass: 'bg-rose-500',
  },
  HOLIDAY: {
    label: 'Feriado',
    className:
      'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    dotClass: 'bg-purple-500',
  },
  SPECIAL_HOURS: {
    label: 'Horário especial',
    className:
      'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    dotClass: 'bg-indigo-500',
  },
  DAY_OFF: {
    label: 'Folga',
    className:
      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    dotClass: 'bg-slate-400',
  },
  CLOSED: {
    label: 'Fechado',
    className:
      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
    dotClass: 'bg-slate-400',
  },
  VACATION: {
    label: 'Férias',
    className:
      'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 border-teal-200 dark:border-teal-800',
    dotClass: 'bg-teal-500',
  },
  WORKING: {
    label: 'Trabalhando',
    className:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 font-medium',
    dotClass: 'bg-emerald-500 ring-2 ring-emerald-400/40 animate-pulse',
  },
  LUNCH: {
    label: 'Almoço',
    className:
      'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800 font-medium',
    dotClass: 'bg-amber-500',
  },
  NOT_STARTED: {
    label: 'Não iniciado',
    className:
      'bg-slate-100 text-slate-600 dark:bg-slate-800/80 dark:text-slate-400 border-slate-200 dark:border-slate-700',
    dotClass: 'bg-slate-400 dark:bg-slate-500',
  },
  OFF_DUTY: {
    label: 'Fechado',
    className:
      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
    dotClass: 'bg-slate-400',
  },
  ACTIVE: {
    label: 'Ativo',
    className:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    dotClass: 'bg-emerald-500',
  },
  INACTIVE: {
    label: 'Inativo',
    className:
      'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    dotClass: 'bg-rose-500',
  },
  SUCCESS: {
    label: 'Sucesso',
    className:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    dotClass: 'bg-emerald-500',
  },
  FAILURE: {
    label: 'Falha',
    className:
      'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    dotClass: 'bg-rose-500',
  },
  CLOCK_IN: {
    label: 'Entrada',
    className:
      'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    dotClass: 'bg-blue-500',
  },
  CLOCK_OUT: {
    label: 'Saída',
    className:
      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    dotClass: 'bg-slate-400',
  },
  EMPLOYEE: {
    label: 'Colaborador',
    className:
      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    dotClass: 'bg-slate-400',
  },
  ADMIN_INSERTION: {
    label: 'Inserção manual',
    className:
      'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    dotClass: 'bg-amber-500',
  },
};

export function StatusBadge({
  status,
  workState,
  isActive,
  className = '',
}: StatusBadgeProps): React.JSX.Element {
  let key = '';

  if (isActive !== undefined && isActive !== null) {
    key = isActive ? 'ACTIVE' : 'INACTIVE';
  } else if (workState === 'WORKING') {
    key = 'WORKING';
  } else if (workState === 'LUNCH') {
    key = 'LUNCH';
  } else if (status === 'VACATION') {
    key = 'VACATION';
  } else if (status === 'HOLIDAY') {
    key = 'HOLIDAY';
  } else if (status === 'DAY_OFF') {
    key = 'DAY_OFF';
  } else if (status === 'INCOMPLETE') {
    key = 'INCOMPLETE';
  } else if (workState === 'NOT_STARTED') {
    key = 'NOT_STARTED';
  } else if (workState === 'OFF_DUTY') {
    key = 'CLOSED';
  } else if (status) {
    key = status;
  } else if (workState) {
    key = workState;
  }

  const meta = STATUS_LABELS[key] ?? {
    label: key || 'Desconhecido',
    className:
      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    dotClass: 'bg-slate-400',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${meta.className} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dotClass}`} />
      <span>{meta.label}</span>
    </span>
  );
}
