import { useState, useMemo } from 'react';
import {
  Award,
  BookOpen,
  Briefcase,
  Clock,
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

export type TemplateCategory = 'PONTO' | 'EMPRESA' | 'ADMISSAO' | 'DISCIPLINA' | 'DESEMPENHO';

export interface DocumentTemplateCard {
  id: string;
  category: TemplateCategory;
  title: string;
  description: string;
  estimatedTime: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  colorScheme: 'blue' | 'purple' | 'amber' | 'rose' | 'emerald';
}

const TEMPLATES: DocumentTemplateCard[] = [
  // Ponto & Relatórios
  {
    id: 'espelho-ponto',
    category: 'PONTO',
    title: 'Espelho de Ponto Individual',
    description:
      'Emissão oficial do espelho de ponto eletrônico mensal ou por período, com cálculo consolidado de horas previstas, trabalhadas, extras, faltas e folha para assinatura.',
    estimatedTime: 'Imediato',
    badge: 'PDF Oficial & CSV',
    icon: FileText,
    href: '/admin/relatorios',
    colorScheme: 'blue',
  },

  // Empresa & Regras
  {
    id: 'regimento',
    category: 'EMPRESA',
    title: 'Regimento Interno de Trabalho',
    description:
      'Normas internas da empresa em minutos: jornadas, conduta, uso de ferramentas, celulares e escala disciplinar com segurança jurídica.',
    estimatedTime: '~ 5 min',
    badge: 'Diretriz Geral',
    icon: BookOpen,
    href: '/admin/documentos/regimento',
    colorScheme: 'blue',
  },
  {
    id: 'cultura',
    category: 'EMPRESA',
    title: 'Quadro de Cultura Organizacional',
    description:
      'Missão, visão, valores inegociáveis e lema corporativo da PH Motopeças formatados para fixação e alinhamento do time.',
    estimatedTime: '~ 5 min',
    badge: 'Identidade',
    icon: Sparkles,
    href: '/admin/documentos/cultura',
    colorScheme: 'emerald',
  },
  {
    id: 'mapa-funcoes',
    category: 'EMPRESA',
    title: 'Descrição e Mapa de Cargos',
    description:
      'Atribuições formais, limites operacionais e requisitos de cada função para prevenção de desvio funcional perante a CLT.',
    estimatedTime: '~ 3 min por cargo',
    badge: 'Estrutura',
    icon: Briefcase,
    href: '/admin/cargos',
    colorScheme: 'purple',
  },

  // Admissão & Termos
  {
    id: 'entrevista',
    category: 'ADMISSAO',
    title: 'Guia de Entrevista e Seleção',
    description:
      'Roteiro estratégico para entrevistar candidatos sem criar vínculo preliminar indevido, avaliando competências técnicas e culturais.',
    estimatedTime: '~ 2 min por candidato',
    badge: 'Recrutamento',
    icon: UserCheck,
    href: '/admin/documentos/entrevista',
    colorScheme: 'blue',
  },
  {
    id: 'ciencia-regimento',
    category: 'ADMISSAO',
    title: 'Termo de Ciência do Regimento Interno',
    description:
      'Declaração formal assinada pelo colaborador atestando o recebimento e ciência do regulamento interno da empresa.',
    estimatedTime: '~ 1 min',
    badge: 'Conformidade CLT',
    icon: FileCheck2,
    href: '/admin/documentos/ciencia?tipo=REGULATION',
    colorScheme: 'emerald',
  },
  {
    id: 'ciencia-funcao',
    category: 'ADMISSAO',
    title: 'Termo de Ciência da Descrição de Cargo',
    description:
      'Comprovante de que o colaborador está ciente de suas atribuições e responsabilidades específicas de sua função na empresa.',
    estimatedTime: '~ 2 min',
    badge: 'Responsabilidades',
    icon: Layers,
    href: '/admin/documentos/ciencia?tipo=ROLE',
    colorScheme: 'purple',
  },

  // Medidas Disciplinares
  {
    id: 'adv-verbal',
    category: 'DISCIPLINA',
    title: 'Registro de Advertência Verbal',
    description:
      'Formalização documental de orientação ou admoestação verbal imediata para arquivamento comprobatório no prontuário do colaborador.',
    estimatedTime: '~ 3 min',
    badge: 'Falta Leve',
    icon: ShieldAlert,
    href: '/admin/documentos/disciplina?tipo=DISCIPLINE_VERBAL',
    colorScheme: 'amber',
  },
  {
    id: 'adv-escrita',
    category: 'DISCIPLINA',
    title: 'Aplicação de Advertência Escrita',
    description:
      'Notificação formal para infrações reincidentes ou moderadas, com histórico de penalidades anteriores e fundamentação legal.',
    estimatedTime: '~ 3 min',
    badge: 'Reincidência',
    icon: ShieldAlert,
    href: '/admin/documentos/disciplina?tipo=DISCIPLINE_WRITTEN',
    colorScheme: 'amber',
  },
  {
    id: 'suspensao',
    category: 'DISCIPLINA',
    title: 'Aplicação de Suspensão Disciplinar',
    description:
      'Penalidade disciplinar para faltas graves ou reiterações contínuas, estipulando dias de afastamento com amparo no Art. 474 da CLT.',
    estimatedTime: '~ 4 min',
    badge: 'Afastamento Legal',
    icon: ShieldAlert,
    href: '/admin/documentos/disciplina?tipo=DISCIPLINE_SUSPENSION',
    colorScheme: 'rose',
  },

  // Avaliação & Feedback
  {
    id: 'avaliacao',
    category: 'DESEMPENHO',
    title: 'Avaliação de Desempenho e Competências',
    description:
      'Formulário com 8 critérios objetivos de 1 a 5, feedback estruturado e plano de ação individual para acompanhamento contínuo.',
    estimatedTime: '~ 5 min',
    badge: 'Ciclo Semestral',
    icon: Award,
    href: '/admin/documentos/avaliacao',
    colorScheme: 'blue',
  },
];

const CATEGORIES: { id: string; label: string; category?: TemplateCategory }[] = [
  { id: 'ALL', label: 'Todos os Modelos' },
  { id: 'PONTO', label: 'Ponto & Relatórios', category: 'PONTO' },
  { id: 'EMPRESA', label: 'Empresa & Regras', category: 'EMPRESA' },
  { id: 'ADMISSAO', label: 'Admissão & Termos', category: 'ADMISSAO' },
  { id: 'DISCIPLINA', label: 'Medidas Disciplinares', category: 'DISCIPLINA' },
  { id: 'DESEMPENHO', label: 'Avaliação & Feedback', category: 'DESEMPENHO' },
];

export function DocumentsHubPage(): React.JSX.Element {
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredTemplates = useMemo(() => {
    return TEMPLATES.filter((template) => {
      const matchesCategory =
        activeCategory === 'ALL' ? true : template.category === activeCategory;
      if (!matchesCategory) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        template.title.toLowerCase().includes(q) ||
        template.description.toLowerCase().includes(q) ||
        template.badge.toLowerCase().includes(q)
      );
    });
  }, [activeCategory, searchQuery]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div className="space-y-1">
          <div className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Documentos Oficiais & Relatórios • PH Motopeças
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Central de Documentos e Relatórios
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-3xl">
            Selecione o modelo desejado para emitir relatórios de ponto, regulamentos, termos de
            ciência e medidas disciplinares com padrão visual executivo e segurança jurídica perante
            a CLT.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/admin/relatorios"
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/40 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors shadow-2xs"
          >
            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Espelho de Ponto
          </Link>
          <Link
            to="/admin/documentos"
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors shadow-2xs"
          >
            <FolderArchive className="w-4 h-4 text-slate-500" />
            Arquivo Emitido
          </Link>
        </div>
      </div>

      {/* Search and Category Filter Toolbar */}
      <div className="space-y-4">
        {/* Search Input */}
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar modelo de documento ou relatório..."
            className="w-full pl-9 pr-9 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              aria-label="Limpar busca"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
          {CATEGORIES.map((cat) => {
            const count =
              cat.id === 'ALL'
                ? TEMPLATES.length
                : TEMPLATES.filter((t) => t.category === cat.id).length;

            const isActive = activeCategory === cat.id;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>{cat.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Nenhum modelo encontrado para o termo &ldquo;{searchQuery}&rdquo;.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setActiveCategory('ALL');
            }}
            className="text-xs text-blue-600 hover:underline font-semibold"
          >
            Limpar filtros e ver todos os modelos
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => {
            const Icon = template.icon;
            return (
              <Link
                key={template.id}
                to={template.href}
                className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs hover:shadow-md hover:border-blue-500 dark:hover:border-blue-500 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div
                      className={`p-2.5 rounded-xl ${
                        template.colorScheme === 'blue'
                          ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                          : template.colorScheme === 'purple'
                            ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400'
                            : template.colorScheme === 'amber'
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                              : template.colorScheme === 'rose'
                                ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                                : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                        {template.badge}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-2 py-0.5 rounded-md border border-slate-100 dark:border-slate-800">
                        <Clock className="w-2.5 h-2.5 text-slate-400" />
                        {template.estimatedTime}
                      </span>
                    </div>
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
      )}
    </div>
  );
}
