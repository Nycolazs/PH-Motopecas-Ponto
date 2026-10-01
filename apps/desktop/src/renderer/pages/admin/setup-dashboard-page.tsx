import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileCheck2,
  FileText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import type { JobRoleDto } from '../../api/contracts.js';
import { useAuth } from '../../auth/use-auth.js';
import { formatDateBR, formatDisplayName, formatInstantTime } from '../../lib/format.js';

function formatCNPJ(cnpj?: string | null): string {
  if (!cnpj) return '';
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return cnpj;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export function SetupDashboardPage(): React.JSX.Element {
  const { api, session } = useAuth();

  const currentHour = new Date().getHours();
  const greeting =
    currentHour >= 5 && currentHour < 12
      ? 'Bom dia'
      : currentHour >= 12 && currentHour < 18
        ? 'Boa tarde'
        : 'Boa noite';
  const adminFirstName = session?.user?.name ? session.user.name.split(' ')[0] : 'Gestor';

  const todayFormatted = (() => {
    const raw = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date());
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  })();

  // 1. Company Data
  const { data: company, refetch: refetchCompany } = useQuery({
    queryKey: ['company-data'],
    queryFn: ({ signal }) => api.getCompany(signal),
  });

  // 2. Operational Attendance Overview (today)
  const { data: overview, refetch: refetchOverview } = useQuery({
    queryKey: ['admin-overview-today'],
    queryFn: ({ signal }) => api.getAdminOverview(undefined, signal),
    refetchInterval: 30_000,
  });

  // 3. Pending Adjustments Count
  const { data: pendingData, refetch: refetchPending } = useQuery({
    queryKey: ['pending-adjustments-count'],
    queryFn: ({ signal }) => api.getPendingAdjustmentRequestsCount(signal),
    refetchInterval: 30_000,
  });

  // 4. Incomplete Punches Summary
  const { data: incompleteData, refetch: refetchIncompletes } = useQuery({
    queryKey: ['admin-incomplete-count'],
    queryFn: ({ signal }) => api.getAdminIncompleteDays(undefined, signal),
    refetchInterval: 30_000,
  });

  // 5. Job Roles & Structure
  const { data: jobRoles, refetch: refetchJobRoles } = useQuery({
    queryKey: ['job-roles-overview'],
    queryFn: ({ signal }) => api.getJobRoles(false, signal),
  });

  // 6. Acknowledgment & Compliance Status
  const { data: acknowledgmentStatus, refetch: refetchAckStatus } = useQuery({
    queryKey: ['acknowledgments-status'],
    queryFn: ({ signal }) => api.getAcknowledgmentStatus(signal),
  });

  // 7. Vacations
  const { data: vacationsData, refetch: refetchVacations } = useQuery({
    queryKey: ['admin-vacations-list'],
    queryFn: ({ signal }) => api.getVacations({ limit: 10 }, signal),
  });

  // 8. Performance Reviews
  const { data: performanceReviews, refetch: refetchReviews } = useQuery({
    queryKey: ['performance-reviews-list'],
    queryFn: ({ signal }) => api.listPerformanceReviews(undefined, signal),
  });

  const handleRefreshAll = (): void => {
    void refetchCompany();
    void refetchOverview();
    void refetchPending();
    void refetchIncompletes();
    void refetchJobRoles();
    void refetchAckStatus();
    void refetchVacations();
    void refetchReviews();
  };

  // Metrics
  const totalEmployees = overview?.totalActiveEmployees ?? 0;
  const clockedInToday = overview?.clockedInTodayCount ?? 0;
  const currentlyWorking = overview?.currentlyWorkingCount ?? 0;
  const notClockedIn = overview?.notClockedInCount ?? 0;
  const presenceRate = totalEmployees > 0 ? Math.round((clockedInToday / totalEmployees) * 100) : 0;

  const pendingRequests = pendingData?.pendingCount ?? 0;
  const incompleteDays = incompleteData?.totalIncompleteDays ?? 0;
  const totalOperationalIssues = pendingRequests + incompleteDays;

  const regulationAckCount = acknowledgmentStatus?.regulationAcknowledgedCount ?? 0;
  const regulationAckRate =
    totalEmployees > 0 ? Math.round((regulationAckCount / totalEmployees) * 100) : 0;

  const rolesCount = jobRoles?.length ?? 0;
  const recentPunches = overview?.recentPunches?.slice(0, 4) ?? [];

  // Group job roles by department
  const departmentMap = (jobRoles ?? []).reduce<Record<string, JobRoleDto[]>>((acc, role) => {
    const dept = role.department || 'Geral';
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(role);
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 rounded-2xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 space-y-4 max-w-4xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 backdrop-blur-xs text-xs font-semibold text-blue-200 border border-blue-400/30">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Painel Executivo & Metas</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 backdrop-blur-xs text-xs font-semibold text-emerald-200 border border-emerald-400/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Operação em Tempo Real</span>
            </span>
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {greeting}, {adminFirstName}! Bem-vindo ao painel do{' '}
              {company?.tradeName ?? 'PH Motopeças'}
            </h1>
            <p className="mt-1 text-blue-100 text-sm sm:text-base leading-relaxed">
              Centro de inteligência operacional, metas da equipe de colaboradores e conformidade do
              seu negócio.
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-blue-200/90 border-t border-blue-600/40">
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-blue-300" />
              <span>
                {company?.legalName ?? 'PH Motopeças LTDA'}{' '}
                {company?.cnpj ? `• CNPJ ${formatCNPJ(company.cnpj)}` : ''}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-300" />
              <span>{todayFormatted}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-300" />
              <span>
                {totalEmployees} {totalEmployees === 1 ? 'colaborador' : 'colaboradores'} no quadro
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={handleRefreshAll}
          className="absolute top-6 right-6 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white backdrop-blur-xs transition-colors"
          title="Atualizar dados do negócio"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-white/10 to-transparent pointer-events-none" />
      </div>

      {/* 2. Top Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Quadro de Colaboradores */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:border-blue-300 dark:hover:border-blue-700 transition-all flex flex-col justify-between group">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Quadro de Equipe
              </span>
              <div className="text-3xl font-extrabold text-slate-900 dark:text-white">
                {totalEmployees}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium truncate">
              {rolesCount} {rolesCount === 1 ? 'cargo formal' : 'cargos formais'}
            </span>
            <Link
              to="/admin/funcionarios"
              className="inline-flex items-center font-semibold text-blue-600 dark:text-blue-400 hover:underline shrink-0"
            >
              Ver equipe
              <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </Link>
          </div>
        </div>

        {/* Card 2: Presença no Dia */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:border-emerald-300 dark:hover:border-emerald-700 transition-all flex flex-col justify-between group">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Presença Hoje
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  {presenceRate}%
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  ({clockedInToday}/{totalEmployees})
                </span>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium truncate">
              {currentlyWorking} em jornada
            </span>
            <Link
              to="/admin/gestao"
              className="inline-flex items-center font-semibold text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
            >
              Ao vivo
              <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </Link>
          </div>
        </div>

        {/* Card 3: Regularidade Operacional */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:border-amber-300 dark:hover:border-amber-700 transition-all flex flex-col justify-between group">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Saúde Operacional
              </span>
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-3xl font-extrabold ${
                    totalOperationalIssues === 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {totalOperationalIssues === 0 ? '100%' : `${totalOperationalIssues}`}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {totalOperationalIssues === 0 ? 'em dia' : 'pendências'}
                </span>
              </div>
            </div>
            <div
              className={`p-3 rounded-xl ${
                totalOperationalIssues === 0
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
              } group-hover:scale-105 transition-transform`}
            >
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium truncate">
              {pendingRequests} ajustes • {incompleteDays} ímpares
            </span>
            <Link
              to="/admin/solicitacoes"
              className="inline-flex items-center font-semibold text-amber-600 dark:text-amber-400 hover:underline shrink-0"
            >
              Revisar
              <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </Link>
          </div>
        </div>

        {/* Card 4: Conformidade Documental */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:border-purple-300 dark:hover:border-purple-700 transition-all flex flex-col justify-between group">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Conformidade CLT
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-purple-600 dark:text-purple-400">
                  {regulationAckRate}%
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  ({regulationAckCount}/{totalEmployees})
                </span>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform">
              <FileCheck2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium truncate">
              Termos assinados
            </span>
            <Link
              to="/admin/documentos/gerar"
              className="inline-flex items-center font-semibold text-purple-600 dark:text-purple-400 hover:underline shrink-0"
            >
              Documentos
              <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* 3. Metas & Objetivos Estratégicos do RH */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Metas & Indicadores de Gestão
              </h2>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Diretrizes operacionais e metas de excelência para a equipe da PH Motopeças
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-semibold border border-blue-200 dark:border-blue-800">
              <TrendingUp className="w-3.5 h-3.5" />
              Ciclo Operacional Vigente
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Meta 1: Pontualidade & Presença */}
          <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Meta 1: Pontualidade & Assiduidade
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Presença integral da equipe no início do expediente da oficina e balcão
                </p>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                Alvo: 95%
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Assiduidade Hoje
                </span>
                <span className="font-bold text-slate-900 dark:text-white">{presenceRate}%</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-2.5 rounded-full transition-all duration-700 ${
                    presenceRate >= 90
                      ? 'bg-emerald-500'
                      : presenceRate >= 70
                        ? 'bg-amber-500'
                        : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(5, presenceRate))}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
              <span>
                {clockedInToday} presentes • {notClockedIn} não iniciados
              </span>
              <Link
                to="/admin/gestao"
                className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
              >
                Conferir horários
              </Link>
            </div>
          </div>

          {/* Meta 2: Regularidade Operacional do Ponto */}
          <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Meta 2: Regularidade de Registros
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Fechamento ágil sem batidas ímpares ou solicitações represadas
                </p>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                Alvo: 100% em dia
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Índice de Regularidade
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {totalOperationalIssues === 0
                    ? '100%'
                    : `${Math.max(0, 100 - totalOperationalIssues * 10)}%`}
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-2.5 rounded-full transition-all duration-700 ${
                    totalOperationalIssues === 0
                      ? 'bg-emerald-500'
                      : totalOperationalIssues <= 2
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                  }`}
                  style={{
                    width: `${totalOperationalIssues === 0 ? 100 : Math.max(10, 100 - totalOperationalIssues * 10)}%`,
                  }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
              <span>
                {pendingRequests} pendentes de aprovação • {incompleteDays} dias com batida ímpar
              </span>
              <Link
                to="/admin/solicitacoes"
                className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
              >
                Ajustar batidas
              </Link>
            </div>
          </div>

          {/* Meta 3: Conformidade Documental & Regimento */}
          <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Meta 3: Cobertura Documental CLT
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ciência formal do regimento interno e segurança na oficina
                </p>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                Alvo: 100%
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Termos Assinados
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {regulationAckRate}%
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-purple-600 dark:bg-purple-500 h-2.5 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, Math.max(5, regulationAckRate))}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
              <span>
                {regulationAckCount} de {totalEmployees} colaboradores com termo formal
              </span>
              <Link
                to="/admin/documentos/ciencia"
                className="text-purple-600 dark:text-purple-400 font-semibold hover:underline"
              >
                Ver termos
              </Link>
            </div>
          </div>

          {/* Meta 4: Ciclos de Feedback & Avaliação */}
          <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Meta 4: Desenvolvimento & Feedback
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Avaliações de desempenho semestrais para retenção e crescimento
                </p>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                Ciclo 2026
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Avaliações Realizadas
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {performanceReviews?.length ?? 0} registradas
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-indigo-600 dark:bg-indigo-500 h-2.5 rounded-full transition-all duration-700"
                  style={{
                    width: `${totalEmployees > 0 ? Math.min(100, Math.max(5, ((performanceReviews?.length ?? 0) / totalEmployees) * 100)) : 10}%`,
                  }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
              <span>Critérios de competência e dedicação técnica</span>
              <Link
                to="/admin/documentos/avaliacao"
                className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
              >
                Nova avaliação
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Estrutura do Negócio & Planejamento da Equipe (2 Colunas) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bloco Esquerdo: Estrutura Organizacional da PH Motopeças */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Estrutura Organizacional & Cargos
                </h3>
              </div>
              <Link
                to="/admin/cargos"
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center"
              >
                Gerenciar cargos
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Link>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Distribuição funcional entre atendimento de balcão, oficina mecânica e liderança
            </p>
          </div>

          <div className="space-y-3">
            {Object.keys(departmentMap).length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500 text-center">
                Nenhum cargo estruturado no momento.
              </div>
            ) : (
              Object.entries(departmentMap).map(([department, roles]) => (
                <div
                  key={department}
                  className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      {department}
                    </span>
                    <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                      {roles.length} {roles.length === 1 ? 'função' : 'funções'}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {roles.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between text-xs text-slate-800 dark:text-slate-200"
                      >
                        <span className="font-medium">• {r.title}</span>
                        <span className="text-2xs text-slate-400 dark:text-slate-500">
                          {r.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Base sólida para orçamentos, CBOs e contratações</span>
            <Link
              to="/admin/empresa"
              className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
            >
              Dados da Empresa
            </Link>
          </div>
        </div>

        {/* Bloco Direito: Escalas, Férias & Calendário da Equipe */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Planejamento de Escalas & Férias
                </h3>
              </div>
              <Link
                to="/admin/configuracoes"
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center"
              >
                Configurar jornadas
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Link>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Acompanhamento de afastamentos e descanso para manter a capacidade operacional
            </p>
          </div>

          <div className="space-y-3">
            {vacationsData?.items && vacationsData.items.length > 0 ? (
              vacationsData.items.map((vacation) => (
                <div
                  key={vacation.id}
                  className="p-3.5 rounded-xl border border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 flex items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      {formatDisplayName(vacation.employee.name)}
                    </div>
                    <div className="text-2xs text-slate-500 dark:text-slate-400">
                      Período: {formatDateBR(vacation.startDate)} até{' '}
                      {formatDateBR(vacation.endDate)} ({vacation.daysCount} dias)
                    </div>
                  </div>
                  <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 whitespace-nowrap">
                    Férias Programadas
                  </span>
                </div>
              ))
            ) : (
              <div className="p-4 rounded-xl border border-slate-200/60 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center gap-3 text-slate-600 dark:text-slate-300">
                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="text-xs">
                  <span className="font-semibold text-slate-900 dark:text-white block">
                    Equipe 100% escalada
                  </span>
                  Nenhum afastamento ou período de férias agendado para os próximos dias.
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Oficina e balcão com cobertura total de atendimento</span>
            <Link
              to="/admin/gestao"
              className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
            >
              Frequência ao vivo
            </Link>
          </div>
        </div>
      </div>

      {/* 5. Acesso Rápido aos Módulos de Gestão */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Ações Rápidas de Gestão
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            to="/admin/gestao"
            className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-emerald-50 dark:hover:bg-slate-800/80 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all group flex items-start gap-3.5"
          >
            <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
              <Clock className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                Painel Operacional
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Presença e batidas ao vivo no expediente
              </p>
            </div>
          </Link>

          <Link
            to="/admin/documentos/gerar"
            className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-amber-50 dark:hover:bg-slate-800/80 hover:border-amber-300 dark:hover:border-amber-700 transition-all group flex items-start gap-3.5"
          >
            <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 shrink-0 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400">
                Gerar Documento
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Termos, advertências, contratos e recibos
              </p>
            </div>
          </Link>

          <Link
            to="/admin/solicitacoes"
            className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-blue-50 dark:hover:bg-slate-800/80 hover:border-blue-300 dark:hover:border-blue-700 transition-all group flex items-start gap-3.5"
          >
            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shrink-0 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                Ajustes de Ponto
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {pendingRequests > 0
                  ? `${pendingRequests} pendências para análise`
                  : 'Revisão de solicitações da equipe'}
              </p>
            </div>
          </Link>

          <Link
            to="/admin/relatorios"
            className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-purple-50 dark:hover:bg-slate-800/80 hover:border-purple-300 dark:hover:border-purple-700 transition-all group flex items-start gap-3.5"
          >
            <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 shrink-0 group-hover:scale-105 transition-transform">
              <FileText className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400">
                Relatórios & Espelho
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Fechamento mensal e exportação de ponto
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* 6. Atividades Recentes do Time */}
      {recentPunches.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Últimos Registros da Equipe
              </h3>
            </div>
            <Link
              to="/admin/pontos"
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Ver todos os registros
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {recentPunches.map((punch) => (
              <div
                key={punch.id}
                className="p-3 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {formatDisplayName(punch.employeeName)}
                  </span>
                  <span className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-300">
                    {formatInstantTime(punch.occurredAt)}
                  </span>
                </div>
                <div className="text-2xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  <span>
                    {punch.kind === 'CLOCK_IN'
                      ? 'Entrada'
                      : punch.kind === 'CLOCK_OUT'
                        ? 'Saída'
                        : punch.kind === 'LUNCH_START'
                          ? 'Início Almoço'
                          : 'Fim Almoço'}
                  </span>
                  <span className="text-2xs text-slate-400">
                    {punch.origin === 'ADMIN_INSERTION' ? 'Ajuste manual' : 'App desktop'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
