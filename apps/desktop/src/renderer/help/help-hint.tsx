import { useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, CircleHelp, X } from 'lucide-react';
import { Link, useInRouterContext } from 'react-router-dom';

import { helpArticlePath, useHelpContext } from './help-routes.js';

interface HelpHintProps {
  /** Short question shown as the popover title, e.g. "Como inserir um ponto manual?". */
  title: string;
  /** One or two sentences answering it. */
  children: React.ReactNode;
  /** Article (and optional section) with the full step-by-step. */
  article: string;
  section?: string;
  /** Which side the popover opens towards. */
  align?: 'left' | 'right';
  className?: string;
}

/**
 * Small "?" next to a feature: a quick explanation and a link to the full guide.
 * Opens on click (works with touch and keyboard); Esc or a click outside closes it.
 */
export function HelpHint({
  title,
  children,
  article,
  section,
  align = 'left',
  className = '',
}: HelpHintProps): React.JSX.Element {
  const { base } = useHelpContext();
  const inRouter = useInRouterContext();
  const guidePath = helpArticlePath(base, article, section);
  const linkClassName =
    'mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400';
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent): void => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <span ref={wrapperRef} className={`relative inline-flex align-middle ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Ajuda: ${title}`}
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
          open
            ? 'bg-blue-600 text-white'
            : 'text-slate-400 hover:bg-blue-50 hover:text-blue-600 dark:text-slate-500 dark:hover:bg-blue-950/60 dark:hover:text-blue-300'
        }`}
      >
        <CircleHelp className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && (
        <span
          id={popoverId}
          role="dialog"
          aria-label={title}
          className={`absolute top-full z-40 mt-2 block w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-4 text-left font-normal normal-case tracking-normal shadow-xl dark:border-slate-700 dark:bg-slate-900 ${
            align === 'left' ? 'left-0' : 'right-0'
          }`}
        >
          <span className="flex items-start justify-between gap-2">
            <span className="text-sm font-bold text-slate-900 dark:text-white">{title}</span>
            <button
              type="button"
              aria-label="Fechar ajuda"
              onClick={() => setOpen(false)}
              className="-mr-1 -mt-1 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </span>
          <span className="mt-1.5 block text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {children}
          </span>
          {inRouter ? (
            <Link to={guidePath} onClick={() => setOpen(false)} className={linkClassName}>
              Ver passo a passo
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          ) : (
            // The app uses a hash router; this fallback keeps the hint usable anywhere.
            <a href={`#${guidePath}`} onClick={() => setOpen(false)} className={linkClassName}>
              Ver passo a passo
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
        </span>
      )}
    </span>
  );
}
