import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Lightbulb,
  LifeBuoy,
  X,
  ZoomIn,
} from 'lucide-react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';

import { HELP_CATEGORIES, findArticle } from '../../help/help-content.js';
import { helpImageSize, helpImageUrl } from '../../help/help-images.js';
import { helpArticlePath, useHelpContext } from '../../help/help-routes.js';
import type { HelpImage, HelpSection } from '../../help/help-types.js';

function sectionAnchor(id: string): string {
  return `ajuda-${id}`;
}

function Screenshot({
  image,
  onOpen,
}: {
  image: HelpImage;
  onOpen: (image: HelpImage) => void;
}): React.JSX.Element | null {
  const url = helpImageUrl(image.key);
  if (url === undefined) return null;
  return (
    <figure className="mt-3">
      <button
        type="button"
        onClick={() => onOpen(image)}
        aria-label={`Ampliar imagem: ${image.alt}`}
        className="group relative block w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-slate-700 dark:bg-slate-800"
      >
        <img
          src={url}
          alt={image.alt}
          loading="lazy"
          {...helpImageSize(image.key)}
          className={`mx-auto block h-auto ${
            helpImageSize(image.key).width < 800 ? 'max-w-full' : 'w-full'
          }`}
        />
        <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-slate-900/70 px-2 py-1 text-[11px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
          Ampliar
        </span>
      </button>
      {image.caption && (
        <figcaption className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          {image.caption}
        </figcaption>
      )}
    </figure>
  );
}

function SectionBody({
  section,
  onOpenImage,
}: {
  section: HelpSection;
  onOpenImage: (image: HelpImage) => void;
}): React.JSX.Element {
  return (
    <>
      {section.paragraphs?.map((paragraph) => (
        <p
          key={paragraph}
          className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300"
        >
          {paragraph}
        </p>
      ))}
      {section.image && <Screenshot image={section.image} onOpen={onOpenImage} />}
      {section.bullets && (
        <ul className="mt-3 space-y-1.5">
          {section.bullets.map((bullet) => (
            <li
              key={bullet}
              className="flex gap-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300"
            >
              <span
                className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500"
                aria-hidden="true"
              />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      )}
      {section.steps && (
        <ol className="mt-4 space-y-4">
          {section.steps.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  <span className="sr-only">Passo {index + 1}: </span>
                  {step.title}
                </h3>
                <p className="mt-0.5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  {step.text}
                </p>
                {step.image && <Screenshot image={step.image} onOpen={onOpenImage} />}
              </div>
            </li>
          ))}
        </ol>
      )}
      {section.tip && (
        <p className="mt-4 flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs leading-relaxed text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <strong>Dica: </strong>
            {section.tip}
          </span>
        </p>
      )}
      {section.warning && (
        <p className="mt-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <strong>Atenção: </strong>
            {section.warning}
          </span>
        </p>
      )}
    </>
  );
}

function Lightbox({
  image,
  onClose,
}: {
  image: HelpImage;
  onClose: () => void;
}): React.JSX.Element {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={image.alt}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar imagem"
        autoFocus
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
      <img
        src={helpImageUrl(image.key)}
        alt={image.alt}
        className="max-h-full max-w-full rounded-lg shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  );
}

/** One help guide: summary, table of contents, step-by-step with screenshots, related guides. */
export function HelpArticlePage(): React.JSX.Element {
  const { slug = '' } = useParams();
  const [searchParams] = useSearchParams();
  const { base, audience } = useHelpContext();
  const [zoomed, setZoomed] = useState<HelpImage | null>(null);
  const article = findArticle(slug, audience);
  const targetSection = searchParams.get('secao');

  useEffect(() => {
    // Runs after the layout resets its scroll position on navigation.
    const timer = window.setTimeout(() => {
      const target = targetSection ? document.getElementById(sectionAnchor(targetSection)) : null;
      if (target) {
        target.scrollIntoView?.({ block: 'start' });
        target.focus({ preventScroll: true });
      } else {
        document.getElementById('ajuda-artigo')?.scrollIntoView?.({ block: 'start' });
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [slug, targetSection]);

  if (article === undefined) return <Navigate to={base} replace />;

  const category = HELP_CATEGORIES.find((item) => item.id === article.category);
  const screenAvailable =
    article.screen !== undefined &&
    (audience === 'admin'
      ? article.screen.path.startsWith('/admin')
      : !article.screen.path.startsWith('/admin'));
  const related = (article.related ?? [])
    .map((relatedSlug) => findArticle(relatedSlug, audience))
    .filter((item) => item !== undefined);

  return (
    <div id="ajuda-artigo" className="mx-auto w-full max-w-6xl scroll-mt-4">
      <nav aria-label="Caminho" className="mb-3 flex flex-wrap items-center gap-1.5 text-xs">
        <Link
          to={base}
          className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline dark:text-blue-400"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Central de Ajuda
        </Link>
        {category && (
          <>
            <span className="text-slate-400" aria-hidden="true">
              /
            </span>
            <span className="text-slate-500 dark:text-slate-400">{category.title}</span>
          </>
        )}
      </nav>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
        <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900 sm:p-8">
          <header className="border-b border-slate-100 pb-5 dark:border-slate-800">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{article.title}</h1>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{article.summary}</p>
            {screenAvailable && article.screen && (
              <Link
                to={article.screen.path}
                className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Abrir {article.screen.label}
              </Link>
            )}
          </header>

          {article.sections.map((section) => (
            <section
              key={section.id}
              id={sectionAnchor(section.id)}
              tabIndex={-1}
              aria-labelledby={`${sectionAnchor(section.id)}-titulo`}
              className={`-mx-3 mt-3 scroll-mt-4 rounded-xl px-3 pb-3 pt-3 focus:outline-none ${
                targetSection === section.id
                  ? 'bg-blue-50/70 ring-1 ring-blue-200 dark:bg-blue-950/30 dark:ring-blue-900'
                  : ''
              }`}
            >
              <h2
                id={`${sectionAnchor(section.id)}-titulo`}
                className="text-lg font-bold text-slate-900 dark:text-white"
              >
                {section.title}
              </h2>
              <SectionBody section={section} onOpenImage={setZoomed} />
            </section>
          ))}

          {related.length > 0 && (
            <footer className="mt-8 border-t border-slate-100 pt-5 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Veja também</h2>
              <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {related.map((item) => (
                  <li key={item.slug}>
                    <Link
                      to={helpArticlePath(base, item.slug)}
                      className="group flex h-full items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:border-blue-400 hover:text-blue-700 dark:border-slate-700 dark:text-slate-200 dark:hover:text-blue-300"
                    >
                      {item.title}
                      <ArrowRight
                        className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-blue-500"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </footer>
          )}
        </article>

        <aside className="hidden lg:block">
          <nav
            aria-label="Nesta página"
            className="sticky top-0 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="text-2xs font-bold uppercase tracking-wider text-slate-400">
              Nesta página
            </p>
            <ul className="mt-2 space-y-1">
              {article.sections.map((section) => (
                <li key={section.id}>
                  <Link
                    to={helpArticlePath(base, article.slug, section.id)}
                    replace
                    className={`block rounded-md px-2 py-1 text-xs hover:bg-slate-50 hover:text-blue-700 dark:hover:bg-slate-800 dark:hover:text-blue-300 ${
                      targetSection === section.id
                        ? 'font-semibold text-blue-700 dark:text-blue-300'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {section.title}
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              to={base}
              className="mt-4 flex items-center gap-1.5 border-t border-slate-100 pt-3 text-xs font-semibold text-slate-500 hover:text-blue-700 dark:border-slate-800 dark:text-slate-400"
            >
              <LifeBuoy className="h-3.5 w-3.5" aria-hidden="true" />
              Pesquisar outra dúvida
            </Link>
          </nav>
        </aside>
      </div>

      {zoomed && <Lightbox image={zoomed} onClose={() => setZoomed(null)} />}
    </div>
  );
}
