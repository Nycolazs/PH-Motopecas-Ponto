import { useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  Briefcase,
  ChevronRight,
  ClipboardList,
  FileCheck2,
  FileText,
  FolderArchive,
  Layers,
  Search,
  ShieldAlert,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { RecentDocumentsPanel } from './recent-documents-panel.js';
import { HelpHint } from '../../help/help-hint.js';

export type TemplateCategory = 'EMPRESA' | 'ADMISSAO' | 'DISCIPLINA' | 'DESEMPENHO' | 'PONTO';

type Tone = 'blue' | 'purple' | 'amber' | 'rose' | 'emerald';

export interface DocumentTemplateCard {
  id: string;
  category: TemplateCategory;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  tone: Tone;
  /** Short verb shown on the card, e.g. "Criar" or "Abrir". */
  action: string;
  keywords?: string;
}

const TEMPLATES: DocumentTemplateCard[] = [
  {
    id: 'regimento',
    category: 'EMPRESA',
    title: 'Regimento Interno',
    description: 'Regras de jornada, conduta, uso de celular e escala disciplinar.',
    icon: BookOpen,
    href: '/admin/documentos/regimento',
    tone: 'blue',
    action: 'Editar',
    keywords: 'regulamento normas',
  },
  {
    id: 'cultura',
    category: 'EMPRESA',
    title: 'Manual de Cultura',
    description: 'Missão, visão e valores da PH Motopeças para fixar e alinhar a equipe.',
    icon: Sparkles,
    href: '/admin/documentos/cultura',
    tone: 'emerald',
    action: 'Editar',
    keywords: 'missão visão valores',
  },
  {
    id: 'mapa-funcoes',
    category: 'EMPRESA',
    title: 'Descrição de Cargos',
    description: 'Atribuições e requisitos de cada função, para evitar desvio de função.',
    icon: Briefcase,
    href: '/admin/cargos',
    tone: 'purple',
    action: 'Abrir',
    keywords: 'função mapa cbo',
  },
  {
    id: 'entrevista',
    category: 'ADMISSAO',
    title: 'Guia de Entrevista',
    description: 'Roteiro e notas por critério para avaliar candidatos a uma vaga.',
    icon: UserCheck,
    href: '/admin/documentos/entrevista',
    tone: 'blue',
    action: 'Criar',
    keywords: 'seleção candidato recrutamento',
  },
  {
    id: 'ciencia-regimento',
    category: 'ADMISSAO',
    title: 'Termo de Ciência do Regimento',
    description: 'O colaborador declara que recebeu e conhece o regimento interno.',
    icon: FileCheck2,
    href: '/admin/documentos/ciencia?tipo=REGULATION',
    tone: 'emerald',
    action: 'Criar',
    keywords: 'termo assinatura',
  },
  {
    id: 'ciencia-funcao',
    category: 'ADMISSAO',
    title: 'Termo de Ciência do Cargo',
    description: 'O colaborador recebe e assina a descrição da sua função.',
    icon: Layers,
    href: '/admin/documentos/ciencia?tipo=ROLE',
    tone: 'purple',
    action: 'Criar',
    keywords: 'termo função atribuições',
  },
  {
    id: 'adv-verbal',
    category: 'DISCIPLINA',
    title: 'Advertência Verbal',
    description: 'Registra por escrito uma orientação feita em conversa.',
    icon: ShieldAlert,
    href: '/admin/documentos/disciplina?tipo=DISCIPLINE_VERBAL',
    tone: 'amber',
    action: 'Criar',
    keywords: 'conversa orientação disciplina',
  },
  {
    id: 'adv-escrita',
    category: 'DISCIPLINA',
    title: 'Advertência Escrita',
    description: 'Notificação formal para faltas moderadas ou reincidentes.',
    icon: ShieldAlert,
    href: '/admin/documentos/disciplina?tipo=DISCIPLINE_WRITTEN',
    tone: 'amber',
    action: 'Criar',
    keywords: 'reincidência disciplina',
  },
  {
    id: 'suspensao',
    category: 'DISCIPLINA',
    title: 'Suspensão Disciplinar',
    description: 'Afastamento de 1 a 30 dias para faltas graves (Art. 474 da CLT).',
    icon: ShieldAlert,
    href: '/admin/documentos/disciplina?tipo=DISCIPLINE_SUSPENSION',
    tone: 'rose',
    action: 'Criar',
    keywords: 'suspensão afastamento disciplina',
  },
  {
    id: 'avaliacao',
    category: 'DESEMPENHO',
    title: 'Avaliação de Desempenho',
    description: '8 critérios de 1 a 5, pontos fortes e plano de desenvolvimento.',
    icon: Award,
    href: '/admin/documentos/avaliacao',
    tone: 'blue',
    action: 'Criar',
    keywords: 'feedback competências',
  },
  {
    id: 'espelho-ponto',
    category: 'PONTO',
    title: 'Espelho de Ponto',
    description: 'Fechamento do mês da equipe e espelhos individuais para assinatura.',
    icon: FileText,
    href: '/admin/relatorios',
    tone: 'blue',
    action: 'Abrir',
    keywords: 'relatório horas frequência pdf planilha',
  },
];

const SECTIONS: Array<{
  category: TemplateCategory;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    category: 'EMPRESA',
    title: 'Empresa e regras',
    description: 'Documentos institucionais, válidos para toda a equipe.',
    icon: BookOpen,
  },
  {
    category: 'ADMISSAO',
    title: 'Contratação e termos',
    description: 'Seleção de candidatos e termos assinados pelo colaborador.',
    icon: UserCheck,
  },
  {
    category: 'DISCIPLINA',
    title: 'Medidas disciplinares',
    description: 'Do mais leve ao mais grave, com histórico por colaborador.',
    icon: ShieldAlert,
  },
  {
    category: 'DESEMPENHO',
    title: 'Desempenho',
    description: 'Acompanhamento e feedback periódico.',
    icon: Award,
  },
  {
    category: 'PONTO',
    title: 'Ponto e frequência',
    description: 'Relatórios de horas para conferência e assinatura.',
    icon: ClipboardList,
  },
];

const TONE_CLASSES: Record<Tone, string> = {
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400',
  purple: 'bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
};

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function DocumentsHubPage(): React.JSX.Element {
  const [searchQuery, setSearchQuery] = useState('');

  const visibleTemplates = useMemo(() => {
    const query = normalize(searchQuery);
    if (!query) return TEMPLATES;
    return TEMPLATES.filter((template) =>
      normalize(`${template.title} ${template.description} ${template.keywords ?? ''}`).includes(
        query,
      ),
    );
  }, [searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
              <FolderArchive className="h-5 w-5 text-blue-600" aria-hidden="true" />
              Documentos & RH
            </h1>
            <HelpHint
              article="documentos-e-rh"
              section="previa"
              title="Como funcionam os documentos?"
            >
              Preencha o modelo, clique em Visualizar para ver a prévia e depois salve ou use
              Imprimir e Salvar. Só o que você salva fica no arquivo criptografado.
            </HelpHint>
          </div>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Escolha o documento que deseja criar. Tudo o que for emitido fica guardado em Documentos
            emitidos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Buscar documento..."
              aria-label="Buscar documento"
              className="h-9 w-60 rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Limpar busca"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Link
            to="/admin/documentos"
            className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-400 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:text-blue-300"
          >
            <FolderArchive className="h-4 w-4" aria-hidden="true" />
            Documentos emitidos
          </Link>
        </div>
      </div>

      {searchQuery.trim() === '' && <RecentDocumentsPanel />}

      {visibleTemplates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Nenhum documento encontrado para “{searchQuery}”.
          </p>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="mt-2 text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
          >
            Ver todos os documentos
          </button>
        </div>
      ) : (
        SECTIONS.map((section) => {
          const items = visibleTemplates.filter(
            (template) => template.category === section.category,
          );
          if (items.length === 0) return null;
          const SectionIcon = section.icon;
          return (
            <section key={section.category} aria-labelledby={`section-${section.category}`}>
              <div className="mb-3 flex items-baseline gap-2">
                <SectionIcon
                  className="h-4 w-4 shrink-0 self-center text-slate-400"
                  aria-hidden="true"
                />
                <h2
                  id={`section-${section.category}`}
                  className="text-sm font-bold text-slate-900 dark:text-white"
                >
                  {section.title}
                </h2>
                <span className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {section.description}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {items.map((template) => {
                  const Icon = template.icon;
                  return (
                    <Link
                      key={template.id}
                      to={template.href}
                      className="group flex items-center gap-3.5 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs transition-all hover:border-blue-400 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500"
                    >
                      <div className={`shrink-0 rounded-lg p-2.5 ${TONE_CLASSES[template.tone]}`}>
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300">
                          {template.title}
                        </h3>
                        <p className="mt-0.5 text-xs leading-snug text-slate-500 dark:text-slate-400">
                          {template.description}
                        </p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                        {template.action}
                        <ChevronRight
                          className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
