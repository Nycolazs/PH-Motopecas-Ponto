import { ADMIN_DOCUMENT_ARTICLES } from './content/admin-documentos.js';
import { ADMIN_SETTINGS_ARTICLES, ADMIN_TEAM_ARTICLES } from './content/admin-equipe.js';
import { ADMIN_PUNCH_ARTICLES, ADMIN_START_ARTICLES } from './content/admin-ponto.js';
import { EMPLOYEE_ARTICLES } from './content/employee.js';
import { FAQ_ARTICLES } from './content/faq.js';
import type { HelpArticle, HelpAudience, HelpCategory } from './help-types.js';

export const HELP_CATEGORIES: readonly HelpCategory[] = [
  {
    id: 'comecar',
    title: 'Primeiros passos',
    description: 'Configurar o sistema e conhecer o painel.',
  },
  {
    id: 'ponto',
    title: 'Ponto do dia a dia',
    description: 'Acompanhar, inserir e corrigir batidas.',
  },
  {
    id: 'equipe',
    title: 'Colaboradores',
    description: 'Cadastro, ficha e acesso ao aplicativo.',
  },
  {
    id: 'relatorios',
    title: 'Relatórios e fechamento',
    description: 'Espelho de ponto, planilhas e impressão.',
  },
  {
    id: 'documentos',
    title: 'Documentos & RH',
    description: 'Regimento, termos, advertências e avaliações.',
  },
  {
    id: 'configuracoes',
    title: 'Empresa e sistema',
    description: 'Jornadas, cargos, administradores e alertas.',
  },
  {
    id: 'colaborador',
    title: 'Aplicativo do colaborador',
    description: 'Bater ponto, histórico e pedidos de ajuste.',
  },
  {
    id: 'duvidas',
    title: 'Perguntas frequentes',
    description: 'Respostas rápidas para o dia a dia.',
  },
];

export const HELP_ARTICLES: readonly HelpArticle[] = [
  ...ADMIN_START_ARTICLES,
  ...ADMIN_PUNCH_ARTICLES,
  ...ADMIN_TEAM_ARTICLES,
  ...ADMIN_DOCUMENT_ARTICLES,
  ...ADMIN_SETTINGS_ARTICLES,
  ...EMPLOYEE_ARTICLES,
  ...FAQ_ARTICLES,
];

export function articlesFor(audience: HelpAudience): HelpArticle[] {
  return HELP_ARTICLES.filter((article) => article.audience.includes(audience));
}

export function findArticle(slug: string, audience: HelpAudience): HelpArticle | undefined {
  return articlesFor(audience).find((article) => article.slug === slug);
}
