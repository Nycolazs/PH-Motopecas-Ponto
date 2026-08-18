import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string | undefined;
  message: string;
}

interface ToastContextValue {
  showToast: (type: ToastType, message: string, title?: string) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const STYLES = {
  success: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100',
    iconColor: 'text-emerald-500 dark:text-emerald-400',
  },
  error: {
    bg: 'bg-rose-50 dark:bg-rose-950/80 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-100',
    iconColor: 'text-rose-500 dark:text-rose-400',
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-950/80 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100',
    iconColor: 'text-blue-500 dark:text-blue-400',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-950/80 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100',
    iconColor: 'text-amber-500 dark:text-amber-400',
  },
};

export function ToastProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string, title?: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((current) => [
        ...current,
        title !== undefined ? { id, type, message, title } : { id, type, message },
      ]);
      setTimeout(() => {
        removeToast(id);
      }, 4500);
    },
    [removeToast],
  );

  const success = useCallback(
    (message: string, title?: string) => showToast('success', message, title),
    [showToast],
  );
  const error = useCallback(
    (message: string, title?: string) => showToast('error', message, title),
    [showToast],
  );
  const info = useCallback(
    (message: string, title?: string) => showToast('info', message, title),
    [showToast],
  );
  const warning = useCallback(
    (message: string, title?: string) => showToast('warning', message, title),
    [showToast],
  );

  const value = useMemo(
    () => ({ showToast, success, error, info, warning, removeToast }),
    [showToast, success, error, info, warning, removeToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-md w-full pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((toast) => {
          const Icon = ICONS[toast.type];
          const style = STYLES[toast.type];
          return (
            <div
              key={toast.id}
              role="status"
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-sm transition-all duration-300 animate-in fade-in slide-in-from-bottom-3 ${style.bg}`}
            >
              <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${style.iconColor}`} />
              <div className="flex-1 text-sm">
                {toast.title && (
                  <p className="font-bold text-xs uppercase tracking-wider mb-0.5">{toast.title}</p>
                )}
                <p className="font-medium leading-relaxed">{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="shrink-0 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                aria-label="Fechar notificação"
              >
                <X className="w-4 h-4 opacity-70 hover:opacity-100" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (context === null) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
