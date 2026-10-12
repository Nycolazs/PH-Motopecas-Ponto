import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

import { HelpHint } from '../help/help-hint.js';

interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  /** Small status chips rendered next to the title. */
  badges?: React.ReactNode;
  /** Buttons aligned to the right of the header. */
  actions?: React.ReactNode;
  backTo?: string;
  backLabel?: string;
  /** "?" next to the title with a quick explanation and a link to the guide. */
  help?: { article: string; section?: string; title: string; text: string };
}

/**
 * Standard admin page header: optional back link, title with icon, short
 * description and right-aligned actions inside the same card used across pages.
 */
export function PageHeader({
  title,
  description,
  icon: Icon,
  badges,
  actions,
  backTo,
  backLabel = 'Voltar',
  help,
}: PageHeaderProps): React.JSX.Element {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      {backTo && (
        <Link
          to={backTo}
          className="mb-2 inline-flex items-center gap-1 rounded text-xs font-semibold text-slate-500 transition-colors hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-slate-400 dark:hover:text-blue-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          {backLabel}
        </Link>
      )}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
              {Icon && <Icon className="h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />}
              {title}
            </h1>
            {help && (
              <HelpHint
                article={help.article}
                {...(help.section ? { section: help.section } : {})}
                title={help.title}
              >
                {help.text}
              </HelpHint>
            )}
            {badges}
          </div>
          {description && (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:flex-nowrap">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

const BUTTON_BASE =
  'inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500';

/** Shared button styles for page-level actions. */
export const headerButton = {
  primary: `${BUTTON_BASE} bg-blue-600 text-white shadow-xs hover:bg-blue-700`,
  secondary: `${BUTTON_BASE} border border-slate-200 bg-white text-slate-700 hover:border-blue-400 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:text-blue-300`,
  danger: `${BUTTON_BASE} border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 dark:border-rose-900/60 dark:bg-slate-900 dark:text-rose-400 dark:hover:bg-rose-950/40`,
};
