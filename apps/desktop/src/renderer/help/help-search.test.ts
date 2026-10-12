// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { normalizeHelpText, searchHelp, tokenizeHelpQuery } from './help-search.js';
import type { HelpArticle } from './help-types.js';

const articles: HelpArticle[] = [
  {
    slug: 'ferias',
    title: 'Férias da equipe',
    summary: 'Cadastre os períodos de descanso.',
    category: 'configuracoes',
    audience: ['admin'],
    keywords: ['descanso'],
    sections: [
      { id: 'cadastrar', title: 'Cadastrar', paragraphs: ['Escolha o colaborador e as datas.'] },
      {
        id: 'cancelar',
        title: 'Cancelar férias',
        paragraphs: ['Use o botão de cancelar na linha do período.'],
      },
    ],
  },
  {
    slug: 'ponto',
    title: 'Inserir ponto',
    summary: 'Registre uma batida esquecida.',
    category: 'ponto',
    audience: ['admin'],
    keywords: ['esqueceu', 'transferias'],
    sections: [{ id: 'inserir', title: 'Inserir', paragraphs: ['Informe o horário.'] }],
  },
];

describe('help search', () => {
  it('ignores accents, case and filler words', () => {
    expect(normalizeHelpText('Férias AÇÃO')).toBe('ferias acao');
    expect(tokenizeHelpQuery('Como eu faço para cancelar as Férias?')).toEqual([
      'faco',
      'cancelar',
      'ferias',
    ]);
  });

  it('finds the article and the section that answers the question', () => {
    const [first] = searchHelp(articles, 'cancelar ferias');
    expect(first?.article.slug).toBe('ferias');
    expect(first?.section?.id).toBe('cancelar');
    expect(first?.snippet).toContain('cancelar');
  });

  it('matches whole word starts only and requires every word', () => {
    // "transferias" must not count as "ferias".
    expect(searchHelp(articles, 'ferias').map((result) => result.article.slug)).toEqual(['ferias']);
    expect(searchHelp(articles, 'ferias horário')).toEqual([]);
    expect(searchHelp(articles, '   ')).toEqual([]);
  });

  it('understands everyday synonyms', () => {
    // "funcionário" is written "colaborador" in the guides.
    expect(searchHelp(articles, 'colaborador datas')[0]?.article.slug).toBe('ferias');
    expect(searchHelp(articles, 'funcionario datas')[0]?.article.slug).toBe('ferias');
  });

  it('weighs titles and keywords above body text', () => {
    expect(searchHelp(articles, 'esqueceu')[0]?.article.slug).toBe('ponto');
  });
});
