// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { HELP_ARTICLES, HELP_CATEGORIES, articlesFor, findArticle } from './help-content.js';
import { helpImageKeys, helpImageUrl } from './help-images.js';
import { HELP_ROUTE_ARTICLES, articleSlugForRoute, helpPathForScreen } from './help-routes.js';
import { searchHelp } from './help-search.js';

/** Source of every screen and component, to check the "?" hints they contain. */
const SCREEN_SOURCES = import.meta.glob(
  ['../pages/**/*.tsx', '../components/**/*.tsx', '!**/*.test.tsx'],
  {
    eager: true,
    query: '?raw',
    import: 'default',
  },
) as Record<string, string>;

/** Screens used by employees; every other screen is admin-only. */
const EMPLOYEE_SCREENS = [
  'employee-home-page',
  'history-page',
  'request-adjustment-modal',
  'my-adjustment-requests-modal',
  'change-password-modal',
  'employee-layout',
];

describe('help content', () => {
  it('has unique slugs, valid categories and unique section anchors', () => {
    const slugs = HELP_ARTICLES.map((article) => article.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const categories = new Set(HELP_CATEGORIES.map((category) => category.id));
    for (const article of HELP_ARTICLES) {
      expect(categories.has(article.category), article.slug).toBe(true);
      expect(article.audience.length, article.slug).toBeGreaterThan(0);
      const sectionIds = article.sections.map((section) => section.id);
      expect(new Set(sectionIds).size, article.slug).toBe(sectionIds.length);
      expect(article.sections.length, article.slug).toBeGreaterThan(0);
    }
  });

  it('links only to existing guides (the page hides those a reader cannot open)', () => {
    for (const article of HELP_ARTICLES) {
      for (const related of article.related ?? []) {
        expect(
          article.audience.some((audience) => findArticle(related, audience) !== undefined),
          `${article.slug} → ${related}`,
        ).toBe(true);
      }
    }
  });

  it('ships every screenshot it shows, and no unused screenshot', () => {
    const used = new Set(
      HELP_ARTICLES.flatMap((article) =>
        article.sections.flatMap((section) => [
          section.image?.key,
          ...(section.steps ?? []).map((step) => step.image?.key),
        ]),
      ).filter((key): key is string => key !== undefined),
    );
    for (const key of used) expect(helpImageUrl(key), key).toBeDefined();
    expect(helpImageKeys().sort()).toEqual([...used].sort());
  });

  it('maps every screen to an existing guide for the right reader', () => {
    for (const [route, slug] of HELP_ROUTE_ARTICLES) {
      const audience = route.startsWith('/admin') ? 'admin' : 'employee';
      expect(findArticle(slug, audience), `${route} → ${slug}`).toBeDefined();
    }
    expect(articleSlugForRoute('/admin/funcionarios')).toBe('colaboradores');
    expect(articleSlugForRoute('/admin/funcionarios/123')).toBe('ficha-do-colaborador');
    expect(articleSlugForRoute('/admin/documentos/disciplina')).toBe('medidas-disciplinares');
    expect(articleSlugForRoute('/admin/documentos')).toBe('documentos-emitidos');
    expect(articleSlugForRoute('/')).toBe('bater-ponto');
    expect(articleSlugForRoute('/historico')).toBe('meu-historico');
    expect(helpPathForScreen('/admin/ajuda', '/admin/ajuda/colaboradores')).toBe('/admin/ajuda');
  });

  it('points every "?" hint in the screens to an existing guide and section', () => {
    const hints = Object.entries(SCREEN_SOURCES).flatMap(([file, source]) =>
      [...source.matchAll(/<HelpHint\b([^>]*?)>/gs)].map((match) => ({
        file,
        attributes: match[1] ?? '',
      })),
    );
    expect(hints.length).toBeGreaterThan(15);
    for (const { file, attributes } of hints) {
      // Generic wrappers (PageHeader) receive the article from each screen.
      if (attributes.includes('article={')) continue;
      const article = /article="([^"]+)"/.exec(attributes)?.[1];
      const section = /section="([^"]+)"/.exec(attributes)?.[1];
      const audience = EMPLOYEE_SCREENS.some((name) => file.includes(`/${name}.tsx`))
        ? 'employee'
        : 'admin';
      const found = article ? findArticle(article, audience) : undefined;
      expect(found, `${file}: ${article}`).toBeDefined();
      if (section) {
        expect(
          found?.sections.some((item) => item.id === section),
          `${file}: ${article}#${section}`,
        ).toBe(true);
      }
    }
  });

  it('points every page-header "?" to an existing guide and section', () => {
    const headers = Object.entries(SCREEN_SOURCES).flatMap(([file, source]) =>
      [...source.matchAll(/help=\{\{\s*article: '([^']+)',\s*section: '([^']+)'/g)].map(
        (match) => ({ file, article: match[1] ?? '', section: match[2] ?? '' }),
      ),
    );
    expect(headers.length).toBeGreaterThanOrEqual(7);
    for (const { file, article, section } of headers) {
      const found = findArticle(article, 'admin');
      expect(found, `${file}: ${article}`).toBeDefined();
      expect(
        found?.sections.some((item) => item.id === section),
        `${file}: ${section}`,
      ).toBe(true);
    }
  });

  it('keeps admin-only guides away from employees', () => {
    const employeeSlugs = articlesFor('employee').map((article) => article.slug);
    expect(employeeSlugs).toContain('bater-ponto');
    expect(employeeSlugs).not.toContain('registros-de-ponto');
    expect(findArticle('administradores', 'employee')).toBeUndefined();
  });

  it('answers everyday questions with the right guide', () => {
    const top = (query: string, audience: 'admin' | 'employee' = 'admin') =>
      searchHelp(articlesFor(audience), query)[0];
    expect(top('funcionario esqueceu de bater o ponto')?.article.slug).toMatch(
      /registros-de-ponto|perguntas-frequentes/,
    );
    expect(
      searchHelp(articlesFor('admin'), 'funcionario esqueceu de bater').map((r) => r.article.slug),
    ).toEqual(expect.arrayContaining(['registros-de-ponto', 'perguntas-frequentes']));
    expect(top('imprimir espelho')?.article.slug).toBe('relatorios-e-espelho');
    expect(top('cadastrar funcionario')?.article.slug).toBe('colaboradores');
    expect(top('ferias')?.article.slug).toBe('jornadas-e-calendario');
    expect(top('advertencia')?.article.slug).toBe('medidas-disciplinares');
    expect(top('whatsapp')?.article.slug).toBe('alertas-no-whatsapp');
    expect(top('trocar senha', 'employee')?.article.slug).toBe('trocar-minha-senha');
    expect(top('bater ponto', 'employee')?.article.slug).toBe('bater-ponto');
  });
});
