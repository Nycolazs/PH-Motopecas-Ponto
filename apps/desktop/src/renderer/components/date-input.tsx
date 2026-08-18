import React, { useRef } from 'react';
import { Calendar } from 'lucide-react';
import { formatDateBR } from '../lib/format.js';

export interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  id?: string;
  name?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
  required?: boolean;
  'aria-label'?: string;
}

export function DateInput({
  value,
  onChange,
  label,
  id,
  name,
  min,
  max,
  disabled,
  className = '',
  compact = false,
  required,
  'aria-label': ariaLabel,
}: DateInputProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);

  const formattedDisplay = value ? formatDateBR(value) : 'DD/MM/AAAA';

  const handleClick = (): void => {
    if (disabled) return;
    if (inputRef.current) {
      if (typeof inputRef.current.showPicker === 'function') {
        try {
          inputRef.current.showPicker();
        } catch {
          inputRef.current.focus();
        }
      } else {
        inputRef.current.focus();
      }
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`relative inline-flex items-center gap-2 bg-slate-50 dark:bg-slate-800/90 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-lg px-3 py-1.5 cursor-pointer transition-all duration-200 focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:border-blue-500 group select-none ${
        compact ? 'py-1 px-2.5 text-xs' : 'text-sm'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      <Calendar
        className={`${
          compact ? 'w-3.5 h-3.5' : 'w-4 h-4'
        } text-slate-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors shrink-0`}
      />

      <div className="flex flex-col flex-1 min-w-0">
        {label && (
          <label
            htmlFor={id}
            className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 tracking-wider block leading-none mb-0.5"
          >
            {label}
          </label>
        )}
        <span
          className={`font-medium truncate ${
            value ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          {formattedDisplay}
        </span>
      </div>

      <input
        ref={inputRef}
        id={id}
        name={name}
        type="date"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        required={required}
        aria-label={ariaLabel || label || 'Selecionar data'}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer -z-0 pointer-events-auto"
        tabIndex={0}
      />
    </div>
  );
}
