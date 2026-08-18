import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  className = '',
}: PaginationProps): React.JSX.Element | null {
  if (total <= limit && totalPages <= 1) return null;

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div
      className={`flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-sm text-slate-600 dark:text-slate-400 ${className}`}
    >
      <div>
        Exibindo <span className="font-semibold text-slate-900 dark:text-white">{start}</span> a{' '}
        <span className="font-semibold text-slate-900 dark:text-white">{end}</span> de{' '}
        <span className="font-semibold text-slate-900 dark:text-white">{total}</span> resultados
      </div>
      <div className="flex items-center space-x-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="inline-flex items-center justify-center p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          aria-label="Página anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="px-2 font-medium">
          Página {page} de {Math.max(1, totalPages)}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="inline-flex items-center justify-center p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          aria-label="Próxima página"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
