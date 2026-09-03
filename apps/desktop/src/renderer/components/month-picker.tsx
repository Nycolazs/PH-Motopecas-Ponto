import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

export interface MonthPickerProps {
  value: string; // "YYYY-MM" (e.g. "2026-09")
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

const MONTHS = [
  { index: '01', short: 'Jan', name: 'Janeiro' },
  { index: '02', short: 'Fev', name: 'Fevereiro' },
  { index: '03', short: 'Mar', name: 'Março' },
  { index: '04', short: 'Abr', name: 'Abril' },
  { index: '05', short: 'Mai', name: 'Maio' },
  { index: '06', short: 'Jun', name: 'Junho' },
  { index: '07', short: 'Jul', name: 'Julho' },
  { index: '08', short: 'Ago', name: 'Agosto' },
  { index: '09', short: 'Set', name: 'Setembro' },
  { index: '10', short: 'Out', name: 'Outubro' },
  { index: '11', short: 'Nov', name: 'Novembro' },
  { index: '12', short: 'Dez', name: 'Dezembro' },
];

export function MonthPicker({
  value,
  onChange,
  disabled = false,
  className = '',
}: MonthPickerProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse current value
  const [selectedYearStr, selectedMonthStr] = (value || '').split('-');
  const selectedYear = Number(selectedYearStr) || new Date().getFullYear();
  const selectedMonth = selectedMonthStr || '01';

  // State for navigating years inside the popover
  const [viewYear, setViewYear] = useState(selectedYear);

  // Sync viewYear with selectedYear when value changes or popover opens
  useEffect(() => {
    if (isOpen) {
      setViewYear(selectedYear);
    }
  }, [isOpen, selectedYear]);

  // Click outside and escape key handling
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const now = new Date();
  const currentCalYear = now.getFullYear();
  const currentCalMonth = String(now.getMonth() + 1).padStart(2, '0');

  const selectedMonthObj = MONTHS.find((m) => m.index === selectedMonth);
  const displayLabel = selectedMonthObj
    ? `${selectedMonthObj.name} de ${selectedYear}`
    : `${value}`;

  const handleSelectMonth = (monthIndex: string): void => {
    const formatted = `${viewYear}-${monthIndex}`;
    onChange(formatted);
    setIsOpen(false);
  };

  const handleSelectCurrentMonth = (): void => {
    const formatted = `${currentCalYear}-${currentCalMonth}`;
    onChange(formatted);
    setViewYear(currentCalYear);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`inline-flex items-center gap-2.5 px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-900 dark:text-white transition-colors cursor-pointer shadow-2xs ${
          isOpen ? 'ring-2 ring-blue-500/30 border-blue-500' : ''
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
        <span className="capitalize">{displayLabel}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-blue-600 dark:text-blue-400' : ''
          }`}
        />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          style={{ animation: 'modalSpring 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
          className="absolute right-0 sm:right-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-4 z-50 overflow-hidden"
        >
          {/* Header with Year Navigator */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setViewYear((y) => y - 1)}
              title="Ano anterior"
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-base font-bold text-slate-900 dark:text-white tracking-wide">
              {viewYear}
            </span>

            <button
              type="button"
              onClick={() => setViewYear((y) => y + 1)}
              title="Próximo ano"
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* 12 Months Grid */}
          <div className="grid grid-cols-3 gap-2">
            {MONTHS.map((m) => {
              const isSelected = viewYear === selectedYear && m.index === selectedMonth;
              const isCurrent = viewYear === currentCalYear && m.index === currentCalMonth;

              return (
                <button
                  key={m.index}
                  type="button"
                  onClick={() => handleSelectMonth(m.index)}
                  className={`py-2.5 px-2 rounded-xl text-xs font-semibold transition-all flex flex-col items-center justify-center cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-xs font-bold'
                      : isCurrent
                        ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60 font-bold hover:bg-blue-100 dark:hover:bg-blue-900/60'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span className="text-sm">{m.short}</span>
                  <span
                    className={`text-[10px] opacity-75 capitalize font-normal ${
                      isSelected ? 'text-white/90' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {m.name.slice(0, 3)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Footer Quick Action */}
          <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Atalho rápido:</span>
            <button
              type="button"
              onClick={handleSelectCurrentMonth}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline cursor-pointer"
            >
              Ir para Mês Atual
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
