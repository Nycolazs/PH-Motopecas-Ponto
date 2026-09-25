import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../auth/use-auth.js';

export function SetupDashboardPage(): React.JSX.Element {
  const { api } = useAuth();

  const {
    data: setupStatus,
    isLoading: isSetupLoading,
    error: setupError,
    refetch: refetchSetup,
  } = useQuery({
    queryKey: ['company-setup-status'],
    queryFn: ({ signal }) => api.getSetupStatus(signal),
  });

  const { data: company } = useQuery({
    queryKey: ['company-data'],
    queryFn: ({ signal }) => api.getCompany(signal),
  });

  const percentage = setupStatus?.completionPercentage ?? 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 rounded-2xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 space-y-3 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 backdrop-blur-xs text-xs font-semibold text-blue-200 border border-blue-400/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Sistema Integrado de RH e Ponto Eletrônico</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Bem-vindo ao painel do {company?.tradeName ?? 'PH Motopeças'}
          </h1>
          <p className="text-blue-100 text-sm sm:text-base leading-relaxed">
            Acompanhe a implantação das políticas de RH, dados da empresa, estrutura de cargos e
            gerencie o controle de frequência de forma ágil e segura.
          </p>
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-white/10 to-transparent pointer-events-none" />
      </div>

      {/* Progress & Quick Stats Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Progress Indicator */}
        <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Progresso de Implantação
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Requisitos fundamentais para a maturidade do setor de RH da empresa
              </p>
            </div>
            <button
              onClick={() => void refetchSetup()}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Atualizar status"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4 my-2">
            <div className="flex items-end justify-between">
              <span className="text-4xl font-extrabold text-blue-600 dark:text-blue-400 tracking-tight">
                {percentage}%
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {percentage === 100 ? 'Implantação Completa' : 'Em andamento'}
              </span>
            </div>

            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
              <div
                className="bg-blue-600 dark:bg-blue-500 h-3 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>
              {setupStatus?.items.filter((i) => i.isCompleted).length ?? 0} de{' '}
              {setupStatus?.items.length ?? 6} requisitos concluídos
            </span>
            <Link
              to="/admin/gestao"
              className="inline-flex items-center text-blue-600 dark:text-blue-400 font-semibold hover:underline"
            >
              Ir para Painel de Gestão Operacional
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>
        </div>

        {/* Quick Links / Highlights */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Acesso Rápido
          </h3>
          <div className="space-y-2">
            <Link
              to="/admin/empresa"
              className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-blue-50 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    Dados da Empresa
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Razão social, CNPJ e contato
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-transform group-hover:translate-x-1" />
            </Link>

            <Link
              to="/admin/cargos"
              className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-blue-50 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400">
                    Cargos e Funções
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Estrutura organizacional
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-transform group-hover:translate-x-1" />
            </Link>

            <Link
              to="/admin/gestao"
              className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-blue-50 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                    Controle de Ponto
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Jornadas, espelho e presença
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>

      {/* Checklist Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          Itens de Conformidade e Configuração
        </h3>

        {isSetupLoading ? (
          <div className="py-12 flex justify-center items-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            <span>Carregando status da implantação...</span>
          </div>
        ) : setupError ? (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>Não foi possível carregar o status de implantação.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {setupStatus?.items.map((item) => (
              <div
                key={item.id}
                className={`p-4 rounded-xl border flex items-start gap-4 transition-colors ${
                  item.isCompleted
                    ? 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60'
                    : 'bg-white dark:bg-slate-900 border-amber-200/80 dark:border-amber-900/40 shadow-2xs'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {item.isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-amber-500 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4
                      className={`text-sm font-semibold ${
                        item.isCompleted
                          ? 'text-slate-900 dark:text-white line-through opacity-80'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {item.label}
                    </h4>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        item.isCompleted
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                      }`}
                    >
                      {item.isCompleted ? 'Concluído' : 'Pendente'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {item.description}
                  </p>
                  {item.actionUrl && !item.isCompleted ? (
                    <div className="pt-2">
                      <Link
                        to={item.actionUrl}
                        className="inline-flex items-center text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Configurar agora
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </Link>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
