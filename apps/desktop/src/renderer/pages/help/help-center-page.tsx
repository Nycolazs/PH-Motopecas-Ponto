import { useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Building2,
  ChevronRight,
  Clock,
  FileText,
  LifeBuoy,
  MessageCircleQuestion,
  Monitor,
  Rocket,
  Search,
  Users,
  X,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { HELP_CATEGORIES, articlesFor } from '../../help/help-content.js';
import { helpArticlePath, useHelpContext } from '../../help/help-routes.js';
import { searchHelp } from '../../help/help-search.js';
import type { HelpCategoryId } from '../../help/help-types.js';

const CATEGORY_ICONS: Record<HelpCategoryId, React.ComponentType<{ className?: string }>> = {
  comecar: Rocket,
  ponto: Clock,
  equipe: Users,
  relatorios: BookOpen,
  documentos: FileText,
  configuracoes: Building2,
  colaborador: Monitor,
  duvidas: MessageCircleQuestion,
};

const ADMIN_SUGGESTIONS = [
  'inserir ponto esquecido',
  'imprimir espelho',
  'cadastrar funcionário',
  'férias',
  'advertência',
];
const EMPLOYEE_SUGGESTIONS = ['bater ponto', 'corrigir horário', 'saldo de horas', 'trocar senha'];

/** Searchable help center: type a question and jump straight to the right guide. */
export function HelpCenterPage(): React.JSX.Element {
  const { base, audience } = useHelpContext();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const articles = useMemo(() => articlesFor(audience), [audience]);
  const results = useMemo(() => searchHelp(articles, query), [articles, query]);
  const searching = query.trim().length > 0;
  const suggestions = audience === 'admin' ? ADMIN_SUGGESTIONS : EMPLOYEE_SUGGESTIONS;
  const categories = HELP_CATEGORIES.filter((category) =>
    articles.some((article) => article.category === category.id),
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <section className="overflow-hidden rounded-2xl border border-blue-200/60 bg-gradient-to-br from-blue-600 to-indigo-700 px-6 py-8 text-white shadow-sm dark:border-blue-900">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
            <LifeBuoy className="h-3.5 w-3.5" aria-hidden="true" />
            Central de Ajuda
          </span>
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">Como podemos ajudar?</h1>
          <p className="mt-1.5 text-sm text-blue-100">
            Escreva o que você precisa fazer e vá direto para o passo a passo.
          </p>
          <form
            role="search"
            className="relative mt-5"
            onSubmit={(event) => {
              event.preventDefault();
              const first = results[0];
              if (first) navigate(helpArticlePath(base, first.article.slug, first.section?.id));
            }}
          >
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              ref={inputRef}
              type="search"
              value={query}
              autoFocus
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ex.: como inserir um ponto esquecido"
              aria-label="Pesquisar na ajuda"
              className="h-13 w-full rounded-xl border-0 bg-white pl-12 pr-11 [&::-webkit-search-cancel-button]:appearance-none text-base text-slate-900 shadow-lg placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-white/40 dark:bg-slate-900 dark:text-white"
            />
            {query && (
              <button
                type="button"
                aria-label="Limpar pesquisa"
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </form>
          {!searching && (
            <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs">
              <span className="text-blue-100">Mais procurados:</span>
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setQuery(suggestion)}
                  className="rounded-full bg-white/15 px-2.5 py-0.5 font-medium hover:bg-white/25"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {searching ? (
        <section aria-labelledby="help-results-title" aria-live="polite">
          <h2
            id="help-results-title"
            className="mb-3 text-sm font-bold text-slate-900 dark:text-white"
          >
            {results.length === 0
              ? `Nada encontrado para “${query.trim()}”`
              : `${results.length} ${results.length === 1 ? 'resultado' : 'resultados'} para “${query.trim()}”`}
          </h2>
          {results.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              Tente com outras palavras, como “corrigir ponto”, “relatório” ou “senha”, ou veja os
              assuntos abaixo.
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                >
                  Ver todos os assuntos
                </button>
              </div>
            </div>
          ) : (
            <ul className="space-y-2">
              {results.map((result) => (
                <li key={result.article.slug}>
                  <Link
                    to={helpArticlePath(base, result.article.slug, result.section?.id)}
                    className="group block rounded-xl border border-slate-200 bg-white p-4 shadow-2xs transition-colors hover:border-blue-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-slate-900 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300">
                          {result.article.title}
                        </span>
                        {result.section && (
                          <span className="mt-0.5 block text-xs font-semibold text-blue-600 dark:text-blue-400">
                            {result.section.title}
                          </span>
                        )}
                        <span className="mt-1 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                          {result.snippet}
                        </span>
                      </span>
                      <ChevronRight
                        className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <>
          {audience === 'admin' && (
            <Link
              to={helpArticlePath(base, 'primeiros-passos')}
              className="group flex items-center gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 transition-colors hover:border-emerald-400 dark:border-emerald-900 dark:bg-emerald-950/30"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                <Rocket className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-emerald-900 dark:text-emerald-200">
                  Começando agora? Siga o roteiro de primeiros passos
                </span>
                <span className="block text-xs text-emerald-800/80 dark:text-emerald-300/80">
                  Empresa, jornada, colaboradores, aplicativo e alertas, em 7 passos.
                </span>
              </span>
              <ChevronRight
                className="h-5 w-5 shrink-0 text-emerald-700 transition-transform group-hover:translate-x-0.5 dark:text-emerald-300"
                aria-hidden="true"
              />
            </Link>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {categories.map((category) => {
              const Icon = CATEGORY_ICONS[category.id];
              const items = articles.filter((article) => article.category === category.id);
              return (
                <section
                  key={category.id}
                  aria-labelledby={`help-category-${category.id}`}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300">
                      <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h2
                        id={`help-category-${category.id}`}
                        className="text-sm font-bold text-slate-900 dark:text-white"
                      >
                        {category.title}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {category.description}
                      </p>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-0.5">
                    {items.map((article) => (
                      <li key={article.slug}>
                        <Link
                          to={helpArticlePath(base, article.slug)}
                          className="group flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-300"
                        >
                          <span className="truncate">{article.title}</span>
                          <ChevronRight
                            className="h-3.5 w-3.5 shrink-0 text-slate-300 group-hover:text-blue-500"
                            aria-hidden="true"
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>

          <p className="text-center text-xs text-slate-500 dark:text-slate-400">
            Dica: pressione{' '}
            <kbd className="rounded border border-slate-300 px-1 font-mono dark:border-slate-600">
              F1
            </kbd>{' '}
            em qualquer tela para abrir a ajuda dela.
            {audience === 'employee' && ' Se ainda tiver dúvida, fale com o administrador.'}
          </p>
        </>
      )}
    </div>
  );
}
