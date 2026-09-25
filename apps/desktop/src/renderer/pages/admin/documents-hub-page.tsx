import { useState } from 'react';
import {
  Award,
  BookOpen,
  Briefcase,
  Clock,
  FileCheck2,
  FolderArchive,
  Layers,
  ShieldAlert,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface DocumentTemplateCard {
  id: string;
  category: 'FUNDACAO' | 'CONTRATACAO' | 'DISCIPLINA' | 'DESEMPENHO';
  title: string;
  description: string;
  estimatedTime: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  colorScheme: 'blue' | 'purple' | 'amber' | 'rose' | 'emerald';
}

const TEMPLATES: DocumentTemplateCard[] = [
  // 01 Fundação
  {
    id: 'regimento',
    category: 'FUNDACAO',
    title: 'Regimento Interno',
    description:
      'As regras da sua empresa em minutos: horários, conduta, uso de celular e escala disciplinar. Personalizado e pronto para imprimir.',
    estimatedTime: '~ 5 min',
    icon: BookOpen,
    href: '/admin/documentos/regimento',
    colorScheme: 'blue',
  },
  {
    id: 'mapa-funcoes',
    category: 'FUNDACAO',
    title: 'Mapa de Funções (Descrição de Cargo)',
    description:
      'O que cada cargo faz e o que NÃO faz na sua empresa. Protege contra desvios de função e formaliza responsabilidades.',
    estimatedTime: '~ 3 min por cargo',
    icon: Briefcase,
    href: '/admin/cargos',
    colorScheme: 'purple',
  },
  {
    id: 'cultura',
    category: 'FUNDACAO',
    title: 'Quadro de Cultura da Empresa',
    description:
      'Missão, visão, valores e lema num quadro para expor na empresa. Comunica com clareza os princípios inegociáveis.',
    estimatedTime: '~ 5 min',
    icon: Sparkles,
    href: '/admin/documentos/cultura',
    colorScheme: 'emerald',
  },

  // 02 Contratação
  {
    id: 'entrevista',
    category: 'CONTRATACAO',
    title: 'Guia de Entrevista (Seleção)',
    description:
      'Perguntas estratégicas que revelam o candidato em minutos. Avalie competências técnicas e comportamentais com clareza.',
    estimatedTime: '~ 2 min por candidato',
    icon: UserCheck,
    href: '/admin/documentos/entrevista',
    colorScheme: 'blue',
  },
  {
    id: 'ciencia-regimento',
    category: 'CONTRATACAO',
    title: 'Termo de Ciência do Regimento Interno',
    description:
      'Formalize que o colaborador recebeu, leu e entendeu o Regimento Interno. Segurança jurídica fundamental perante a Justiça.',
    estimatedTime: '~ 1 min',
    icon: FileCheck2,
    href: '/admin/documentos/ciencia',
    colorScheme: 'emerald',
  },
  {
    id: 'ciencia-funcao',
    category: 'CONTRATACAO',
    title: 'Termo de Ciência de Cargo e Função',
    description:
      'O colaborador assina que tem ciência de suas atribuições, limites de atuação e indicadores de avaliação de desempenho.',
    estimatedTime: '~ 3 min',
    icon: Layers,
    href: '/admin/documentos/ciencia',
    colorScheme: 'purple',
  },

  // 03 Disciplina
  {
    id: 'adv-verbal',
    category: 'DISCIPLINA',
    title: 'Registro de Advertência Verbal',
    description:
      'A conversa aconteceu? Registre imediatamente no prontuário. Advertência verbal sem papel não tem valor comprobatório.',
    estimatedTime: '~ 3 min',
    icon: ShieldAlert,
    href: '/admin/documentos/disciplina?tipo=DISCIPLINE_VERBAL',
    colorScheme: 'amber',
  },
  {
    id: 'adv-escrita',
    category: 'DISCIPLINA',
    title: 'Advertência Escrita',
    description:
      'Reincidiu ou cometeu falta moderada? Documento formal com histórico anterior puxado automaticamente do prontuário.',
    estimatedTime: '~ 3 min',
    icon: ShieldAlert,
    href: '/admin/documentos/disciplina?tipo=DISCIPLINE_WRITTEN',
    colorScheme: 'amber',
  },
  {
    id: 'suspensao',
    category: 'DISCIPLINA',
    title: 'Suspensão Disciplinar',
    description:
      'Falta grave ou reincidência contínua. Registro formal com dias de afastamento e total amparo no Art. 474 da CLT.',
    estimatedTime: '~ 4 min',
    icon: ShieldAlert,
    href: '/admin/documentos/disciplina?tipo=DISCIPLINE_SUSPENSION',
    colorScheme: 'rose',
  },

  // 04 Desempenho
  {
    id: 'avaliacao',
    category: 'DESEMPENHO',
    title: 'Avaliação de Desempenho Periódica',
    description:
      'Critérios objetivos com notas de 1 a 5, feedback estruturado e plano de ação. Acompanhe a evolução da equipe sem achismos.',
    estimatedTime: '~ 5 min',
    icon: Award,
    href: '/admin/documentos/avaliacao',
    colorScheme: 'blue',
  },
];

const CATEGORIES = [
  { id: 'ALL', label: 'Todos os Modelos' },
  { id: 'FUNDACAO', label: '01 Fundação' },
  { id: 'CONTRATACAO', label: '02 Contratação' },
  { id: 'DISCIPLINA', label: '03 Disciplina' },
  { id: 'DESEMPENHO', label: '04 Desempenho' },
] as const;

export function DocumentsHubPage(): React.JSX.Element {
  const [activeCategory, setActiveCategory] = useState<string>('ALL');

  const filteredTemplates =
    activeCategory === 'ALL'
      ? TEMPLATES
      : TEMPLATES.filter((template) => template.category === activeCategory);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div className="space-y-1">
          <div className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Documentos Oficiais & RH
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            O que você precisa gerar hoje?
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Preencha, veja o documento pronto na hora e baixe em PDF oficial. Tudo fica salvo no
            prontuário da sua empresa.
          </p>
        </div>

        <Link
          to="/admin/documentos"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors shadow-2xs shrink-0"
        >
          <FolderArchive className="w-4 h-4 text-slate-500" />
          Ver Arquivo de Documentos
        </Link>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCategory(cat.id)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeCategory === cat.id
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template) => {
          const Icon = template.icon;
          return (
            <Link
              key={template.id}
              to={template.href}
              className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs hover:shadow-md hover:border-blue-500 dark:hover:border-blue-500 transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div
                    className={`p-2.5 rounded-xl ${
                      template.colorScheme === 'blue'
                        ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                        : template.colorScheme === 'purple'
                          ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400'
                          : template.colorScheme === 'amber'
                            ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
                            : template.colorScheme === 'rose'
                              ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400'
                              : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>

                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {template.estimatedTime}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {template.title}
                </h3>

                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {template.description}
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform">
                <span>Preencher e Gerar</span>
                <span className="text-slate-400 group-hover:text-blue-600">→</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
