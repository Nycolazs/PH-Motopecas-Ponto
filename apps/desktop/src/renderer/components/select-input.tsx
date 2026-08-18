import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
}

export interface SelectInputProps {
  id?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  icon?: React.ReactNode;
  searchable?: boolean;
  clearable?: boolean;
  className?: string;
  disabled?: boolean;
}

export function SelectInput({
  id,
  label,
  placeholder = 'Selecione uma opção...',
  required = false,
  value,
  onChange,
  options,
  icon,
  searchable = false,
  clearable = false,
  className = '',
  disabled = false,
}: SelectInputProps): React.JSX.Element {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(() => {
    return options.find((opt) => opt.value === value);
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase().trim();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(query)),
    );
  }, [options, searchQuery]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      if (searchable && searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, searchable]);

  const handleSelect = (val: string): void => {
    onChange(val);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e: React.MouseEvent): void => {
    e.stopPropagation();
    onChange('');
    setSearchQuery('');
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
        >
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <button
        id={inputId}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 bg-white dark:bg-slate-800 border rounded-lg text-sm text-left transition ${
          disabled
            ? 'opacity-60 cursor-not-allowed border-slate-200 dark:border-slate-700'
            : isOpen
              ? 'border-blue-500 ring-2 ring-blue-500/20'
              : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          {icon && <span className="text-slate-400 shrink-0">{icon}</span>}
          {selectedOption ? (
            <div className="truncate">
              <span className="text-slate-900 dark:text-white font-medium">
                {selectedOption.label}
              </span>
              {selectedOption.sublabel && (
                <span className="text-xs text-slate-400 dark:text-slate-500 ml-2">
                  {selectedOption.sublabel}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 dark:text-slate-500">{placeholder}</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {clearable && value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => e.key === 'Enter' && handleClear(e as unknown as React.MouseEvent)}
              className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-sm hover:bg-slate-100 dark:hover:bg-slate-700"
              title="Limpar seleção"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-blue-500' : ''
            }`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 max-h-60 overflow-auto focus:outline-hidden animate-in fade-in zoom-in-95 duration-100">
          {searchable && (
            <div className="p-2 border-b border-slate-100 dark:border-slate-700/60 sticky top-0 bg-white dark:bg-slate-800">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          <ul role="listbox" className="py-1">
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-2 text-xs text-slate-400 text-center">
                Nenhuma opção encontrada
              </li>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = option.value === value;
                return (
                  <li
                    key={option.value}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(option.value)}
                    className={`px-3 py-2 flex items-center justify-between text-sm cursor-pointer transition ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {option.icon && <span className="shrink-0">{option.icon}</span>}
                      <span className="truncate">{option.label}</span>
                      {option.sublabel && (
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          {option.sublabel}
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 ml-2" />
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
