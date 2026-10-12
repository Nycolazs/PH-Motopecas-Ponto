import type { HelpArticle, HelpSection } from './help-types.js';

/** Lowercase without accents, so "funcionario" finds "Funcionário". */
export function normalizeHelpText(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const STOP_WORDS = new Set([
  'a',
  'o',
  'as',
  'os',
  'de',
  'da',
  'do',
  'das',
  'dos',
  'e',
  'em',
  'no',
  'na',
  'nos',
  'nas',
  'um',
  'uma',
  'para',
  'pra',
  'por',
  'com',
  'como',
  'que',
  'eu',
  'meu',
  'minha',
  'se',
  'ao',
  'quero',
  'fazer',
  'onde',
]);

/** Everyday words that mean the same thing in the system. */
const SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ['funcionario', 'colaborador', 'empregado', 'equipe'],
  ['bater', 'registrar', 'marcar'],
  ['batida', 'ponto', 'registro'],
  ['apagar', 'excluir', 'remover', 'deletar', 'anular'],
  ['corrigir', 'ajustar', 'ajuste', 'editar', 'alterar', 'mudar', 'trocar'],
  ['demitir', 'demissao', 'desligar', 'desligamento'],
  ['imprimir', 'impressao'],
  ['planilha', 'excel', 'csv', 'exportar'],
  ['atraso', 'atrasado', 'atrasou'],
];

function variantsOf(token: string): string[] {
  const group = SYNONYM_GROUPS.find((words) => words.includes(token));
  return group ? [...group] : [token];
}

export function tokenizeHelpQuery(query: string): string[] {
  return normalizeHelpText(query)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

export interface HelpSearchResult {
  article: HelpArticle;
  /** Best matching section, used to jump straight to it. */
  section: HelpSection | null;
  score: number;
  snippet: string;
}

function sectionText(section: HelpSection): string {
  return [
    section.title,
    ...(section.paragraphs ?? []),
    ...(section.bullets ?? []),
    ...(section.steps ?? []).flatMap((step) => [step.title, step.text]),
    section.tip ?? '',
    section.warning ?? '',
  ]
    .map((part) => part.trim().replace(/[.:]$/, ''))
    .filter((part) => part.length > 0)
    .join('. ');
}

/** Matches a token at a word start ("ferias" matches "férias", not "transferias"). */
function countMatches(haystack: string, token: string): number {
  return variantsOf(token).reduce((total, variant) => total + countWord(haystack, variant), 0);
}

function countWord(haystack: string, token: string): number {
  if (haystack.length === 0) return 0;
  let count = 0;
  let index = haystack.indexOf(token);
  while (index !== -1) {
    const before = index === 0 ? ' ' : haystack[index - 1]!;
    if (!/[a-z0-9]/.test(before)) count += 1;
    index = haystack.indexOf(token, index + token.length);
  }
  return count;
}

function snippetFrom(text: string, tokens: string[]): string {
  const normalized = normalizeHelpText(text);
  const position = tokens
    .flatMap((token) => variantsOf(token).map((variant) => normalized.indexOf(variant)))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];
  if (position === undefined) return text.slice(0, 140);
  const start = Math.max(0, text.lastIndexOf(' ', Math.max(0, position - 50)) + 1);
  const excerpt = text.slice(start, start + 150).trim();
  return `${start > 0 ? '…' : ''}${excerpt}${start + 150 < text.length ? '…' : ''}`;
}

/**
 * Ranks articles for a free-text question. Every word must appear somewhere in the article;
 * titles and keywords weigh more than body text.
 */
export function searchHelp(
  articles: readonly HelpArticle[],
  query: string,
  limit = 8,
): HelpSearchResult[] {
  const tokens = tokenizeHelpQuery(query);
  if (tokens.length === 0) return [];

  const results: HelpSearchResult[] = [];
  for (const article of articles) {
    const title = normalizeHelpText(article.title);
    const keywords = normalizeHelpText(article.keywords.join(' '));
    const summary = normalizeHelpText(article.summary);
    const sections = article.sections.map((section) => ({
      section,
      title: normalizeHelpText(section.title),
      body: normalizeHelpText(sectionText(section)),
    }));

    let score = 0;
    let everyTokenFound = true;
    for (const token of tokens) {
      const inTitle = countMatches(title, token);
      const inKeywords = countMatches(keywords, token);
      const inSummary = countMatches(summary, token);
      const inSections = sections.reduce(
        (total, entry) =>
          total + countMatches(entry.title, token) * 3 + countMatches(entry.body, token),
        0,
      );
      if (inTitle + inKeywords + inSummary + inSections === 0) {
        everyTokenFound = false;
        break;
      }
      score += inTitle * 12 + inKeywords * 8 + inSummary * 4 + Math.min(inSections, 10);
    }
    if (!everyTokenFound) continue;

    let best: (typeof sections)[number] | null = null;
    let bestScore = 0;
    for (const entry of sections) {
      const entryScore = tokens.reduce(
        (total, token) =>
          total + countMatches(entry.title, token) * 3 + countMatches(entry.body, token),
        0,
      );
      if (entryScore > bestScore) {
        best = entry;
        bestScore = entryScore;
      }
    }

    results.push({
      article,
      section: best?.section ?? null,
      score,
      snippet: best ? snippetFrom(sectionText(best.section), tokens) : article.summary,
    });
  }

  return results.sort((left, right) => right.score - left.score).slice(0, limit);
}
