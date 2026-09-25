import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  Ban,
  Calendar as CalendarIcon,
  Camera,
  CheckCircle2,
  Clock,
  Download,
  Edit2,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  History,
  Key,
  Lock,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import {
  PERFORMANCE_CLASSIFICATION_BADGES,
  PERFORMANCE_CLASSIFICATION_LABELS,
  type DailyAttendance,
  type EffectivePunch,
  type EmployeeProfileDto,
  type EmployeeTimelineItemDto,
  type EmploymentEventTypeDto,
  type GeneratedDocumentDto,
  type JobRoleDto,
  type TerminationReasonDto,
  type TimelineCategoryDto,
  type UpdateEmployeeProfileDto,
} from '../../api/contracts.js';
import { useApiClient } from '../../auth/use-auth.js';
import { useToast } from '../../components/toast-context.js';
import { AvatarImage } from '../../components/avatar-image.js';
import { AvatarModal } from '../../components/avatar-modal.js';
import { ManualPunchModal } from '../../components/manual-punch-modal.js';
import { MonthPicker } from '../../components/month-picker.js';
import { PunchCorrectionModal } from '../../components/punch-correction-modal.js';
import { StatusBadge } from '../../components/status-badge.js';
import { Modal } from '../../components/modal.js';
import { formatDateBR } from '../../lib/format.js';
import { formatMinutesDuration } from '@ph-ponto/shared';

function formatTime(isoString?: string | null): string {
  if (!isoString) return '--:--';
  const d = new Date(isoString);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function getTodayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type ProfileTab = 'RESUMO' | 'HISTORICO' | 'DOCUMENTOS' | 'AVALIACOES' | 'PONTO' | 'ACESSO';

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  CULTURE: 'Cultura Organizacional',
  REGULATION: 'Regimento Interno',
  ROLE_MAP: 'Descrição de Cargo',
  INTERVIEW: 'Entrevista de Contratação',
  ACKNOWLEDGMENT_REGULATION: 'Ciência de Regimento',
  ACKNOWLEDGMENT_ROLE: 'Ciência de Cargo',
  DISCIPLINE_VERBAL: 'Advertência Verbal',
  DISCIPLINE_WRITTEN: 'Advertência Escrita',
  DISCIPLINE_SUSPENSION: 'Suspensão Disciplinar',
  PERFORMANCE_REVIEW: 'Avaliação de Desempenho',
};

const TERMINATION_REASONS: Array<{ value: TerminationReasonDto; label: string }> = [
  { value: 'WITHOUT_CAUSE', label: 'Demissão sem justa causa' },
  { value: 'WITH_CAUSE', label: 'Demissão com justa causa' },
  { value: 'EMPLOYEE_RESIGNATION', label: 'Pedido de demissão pelo colaborador' },
  { value: 'MUTUAL_AGREEMENT', label: 'Acordo mútuo entre as partes' },
  { value: 'CONTRACT_EXPIRATION', label: 'Término de contrato por prazo determinado' },
  { value: 'OTHER', label: 'Outro motivo formal' },
];

const EVENT_TYPE_OPTIONS: Array<{ value: EmploymentEventTypeDto; label: string }> = [
  { value: 'NOTE', label: 'Anotação / Registro Interno' },
  { value: 'ROLE_CHANGE', label: 'Alteração de Função ou Cargo' },
  { value: 'SUSPENSION', label: 'Suspensão Documental' },
  { value: 'ADMISSION', label: 'Admissão / Recontratação' },
  { value: 'TERMINATION', label: 'Desligamento' },
  { value: 'REACTIVATION', label: 'Reativação de Vínculo' },
];

export function AdminEmployeeDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const initialDate = searchParams.get('date') ?? searchParams.get('dia');
  const initialMonth = searchParams.get('month') ?? (initialDate ? initialDate.slice(0, 7) : null);
  const initialTab = searchParams.get('tab')?.toUpperCase() as ProfileTab | undefined;

  const employeeId = id ?? '';
  const api = useApiClient();
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToast();
  const queryClient = useQueryClient();

  // Tab State
  const [activeTab, setActiveTab] = useState<ProfileTab>(() => {
    if (initialDate || initialMonth) return 'PONTO';
    if (
      initialTab &&
      ['RESUMO', 'HISTORICO', 'DOCUMENTOS', 'AVALIACOES', 'PONTO', 'ACESSO'].includes(initialTab)
    ) {
      return initialTab;
    }
    return 'RESUMO';
  });

  // Attendance Sub-tab State
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (initialMonth) return initialMonth;
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });
  const [attendanceView, setAttendanceView] = useState<'CALENDAR' | 'PUNCHES'>('CALENDAR');
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(() => initialDate ?? null);

  // Timeline Filter State
  const [timelineCategory, setTimelineCategory] = useState<TimelineCategoryDto | 'ALL'>('ALL');
  const [timelineOffset, setTimelineOffset] = useState(0);

  // Document preview state
  const [previewDoc, setPreviewDoc] = useState<{
    id: string;
    title: string;
    artifactId: string;
    isVoid: boolean;
    voidReason?: string | null | undefined;
  } | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // Modals state
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [manualPunchOpen, setManualPunchOpen] = useState(false);
  const [correctPunch, setCorrectPunch] = useState<{
    id: string;
    occurredAt: string;
    sequence: number;
  } | null>(null);

  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [terminateOpen, setTerminateOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [assignRoleOpen, setAssignRoleOpen] = useState(false);
  const [createEventOpen, setCreateEventOpen] = useState(false);
  const [enableAccessOpen, setEnableAccessOpen] = useState(false);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);

  useEffect(() => {
    const urlDate = searchParams.get('date') ?? searchParams.get('dia');
    if (urlDate) {
      setSelectedDayDate(urlDate);
      setCurrentMonth(urlDate.slice(0, 7));
      setActiveTab('PONTO');
      setAttendanceView('CALENDAR');
    }
  }, [searchParams]);

  // Queries
  const { data: employee, refetch: refetchEmployee } = useQuery({
    queryKey: ['admin-employee-detail', employeeId],
    queryFn: () => api.getEmployee(employeeId),
    enabled: Boolean(employeeId),
  });

  const { data: profile } = useQuery({
    queryKey: ['admin-employee-profile', employeeId],
    queryFn: () => api.getEmployeeProfile(employeeId),
    enabled: Boolean(employeeId),
  });

  const {
    data: monthly,
    isLoading: monthlyLoading,
    refetch: refetchMonthly,
  } = useQuery({
    queryKey: ['admin-employee-monthly', employeeId, currentMonth],
    queryFn: () => api.getAdminEmployeeMonthly(employeeId, currentMonth),
    enabled: Boolean(employeeId) && activeTab === 'PONTO',
  });

  const { data: timeline, isLoading: timelineLoading } = useQuery({
    queryKey: ['admin-employee-timeline', employeeId, timelineCategory, timelineOffset],
    queryFn: () =>
      api.getEmployeeTimeline(employeeId, {
        ...(timelineCategory === 'ALL' ? {} : { category: timelineCategory }),
        limit: 20,
        offset: timelineOffset,
      }),
    enabled: Boolean(employeeId) && activeTab === 'HISTORICO',
  });

  const { data: employeeDocuments, isLoading: documentsLoading } = useQuery({
    queryKey: ['admin-employee-documents', employeeId],
    queryFn: () => api.getDocuments({ employeeId, limit: 100 }),
    enabled: Boolean(employeeId) && activeTab === 'DOCUMENTOS',
  });

  const { data: performanceReviews, isLoading: reviewsLoading } = useQuery({
    queryKey: ['admin-employee-reviews', employeeId],
    queryFn: () => api.listPerformanceReviews({ employeeId, includeSuperseded: true }),
    enabled: Boolean(employeeId) && activeTab === 'AVALIACOES',
  });

  const { data: jobRoles } = useQuery({
    queryKey: ['admin-job-roles'],
    queryFn: () => api.getJobRoles(false),
    enabled: assignRoleOpen,
  });

  const { data: disciplinarySummary } = useQuery({
    queryKey: ['admin-employee-discipline-summary', employeeId],
    queryFn: () => api.getDisciplinarySummary(employeeId),
    enabled: Boolean(employeeId),
  });

  // Action Helpers
  const handleOpenPdfPreview = async (doc: {
    id: string;
    title: string;
    artifactId: string;
    isVoid: boolean;
    voidReason?: string | null | undefined;
  }) => {
    setPreviewDoc(doc);
    setIsPreviewLoading(true);
    try {
      const blob = await api.getArtifactPreviewBlob(doc.artifactId);
      const url = URL.createObjectURL(blob);
      setPreviewBlobUrl(url);
    } catch {
      toastError('Não foi possível carregar a visualização do documento.');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleClosePdfPreview = () => {
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }
    setPreviewDoc(null);
  };

  const handleDownloadDoc = async (docId: string) => {
    try {
      const { blob, filename } = await api.downloadDocumentBlob(docId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toastSuccess('Download concluído.');
    } catch {
      toastError('Erro ao baixar o documento PDF.');
    }
  };

  const invalidateEmployeeData = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-employee-detail', employeeId] });
    void queryClient.invalidateQueries({ queryKey: ['admin-employee-profile', employeeId] });
    void queryClient.invalidateQueries({ queryKey: ['admin-employee-timeline', employeeId] });
    void queryClient.invalidateQueries({ queryKey: ['admin-employees'] });
  };

  // Revoke Sessions mutation
  const revokeSessionsMutation = useMutation({
    mutationFn: () => api.revokeEmployeeSessions(employeeId),
    onSuccess: () => {
      toastSuccess('Todas as sessões ativas do colaborador foram encerradas.');
      invalidateEmployeeData();
    },
    onError: () => {
      toastError('Falha ao encerrar as sessões ativas.');
    },
  });

  // Disable access mutation
  const disableAccessMutation = useMutation({
    mutationFn: () => api.toggleEmployeeAccess(employeeId, false),
    onSuccess: () => {
      toastSuccess('Acesso ao aplicativo desabilitado com sucesso.');
      invalidateEmployeeData();
    },
    onError: () => {
      toastError('Falha ao desabilitar acesso do colaborador.');
    },
  });

  if (!employeeId) {
    return <div className="p-6">Colaborador não identificado.</div>;
  }

  const selectedDay =
    (selectedDayDate
      ? monthly?.days.find((d: DailyAttendance) => d.businessDate === selectedDayDate)
      : undefined) ??
    (monthly?.days && monthly.days.length > 0 ? monthly.days[monthly.days.length - 1] : undefined);

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate('/admin/funcionarios')}
          className="inline-flex items-center text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Voltar para Funcionários
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {employee?.isActive ? (
            <button
              type="button"
              onClick={() => setTerminateOpen(true)}
              className="inline-flex items-center text-xs font-semibold py-2 px-3.5 rounded-xl border border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-colors"
            >
              <UserX className="w-3.5 h-3.5 mr-1.5" />
              Desligar Colaborador
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setReactivateOpen(true)}
              className="inline-flex items-center text-xs font-semibold py-2 px-3.5 rounded-xl border border-emerald-300 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition-colors"
            >
              <UserCheck className="w-3.5 h-3.5 mr-1.5" />
              Reativar Vínculo
            </button>
          )}

          <button
            type="button"
            onClick={() => setCreateEventOpen(true)}
            className="inline-flex items-center text-xs font-semibold py-2 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Registrar Evento
          </button>

          {activeTab === 'PONTO' && (
            <button
              type="button"
              onClick={() => setManualPunchOpen(true)}
              className="primary-button text-xs py-2 px-3.5"
            >
              <Plus className="w-4 h-4 mr-1" />
              Inserir Ponto
            </button>
          )}
        </div>
      </div>

      {/* Header Card */}
      {employee && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center space-x-4">
            <div className="relative group">
              <AvatarImage
                userId={employee.id}
                name={employee.name}
                hasAvatar={employee.hasAvatar}
                size="xl"
              />
              <button
                type="button"
                onClick={() => setAvatarOpen(true)}
                title="Alterar foto"
                className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <Camera className="w-5 h-5 text-white" />
              </button>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  {employee.name}
                </h1>
                <StatusBadge isActive={employee.isActive} />
                {employee.accessEnabled ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <ShieldCheck className="w-3 h-3 mr-1" />
                    Acesso Ativo
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    <ShieldAlert className="w-3 h-3 mr-1" />
                    Acesso Desativado
                  </span>
                )}
                {profile?.roleAssignment && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    {profile.roleAssignment.roleTitle} (v{profile.roleAssignment.versionNumber})
                  </span>
                )}
              </div>
              <div className="text-sm font-mono text-slate-500 dark:text-slate-400 mt-1">
                Login: {employee.login}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {profile?.hireDate
                  ? `Admissão em ${formatDateBR(profile.hireDate)} · Cadastrado em ${formatDateBR(employee.createdAt)}`
                  : `Cadastrado em ${formatDateBR(employee.createdAt)}`}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditProfileOpen(true)}
              className="inline-flex items-center text-xs font-semibold py-2 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5 mr-1.5" />
              Editar Dados
            </button>
          </div>
        </div>
      )}

      {/* Tabs Navigation Bar */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav
          className="flex space-x-2 sm:space-x-4 overflow-x-auto pb-px"
          aria-label="Abas de Perfil"
        >
          <button
            type="button"
            onClick={() => setActiveTab('RESUMO')}
            className={`py-3 px-3.5 text-xs font-bold whitespace-nowrap border-b-2 flex items-center transition-colors ${
              activeTab === 'RESUMO'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <User className="w-4 h-4 mr-2" />
            Resumo
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('HISTORICO')}
            className={`py-3 px-3.5 text-xs font-bold whitespace-nowrap border-b-2 flex items-center transition-colors ${
              activeTab === 'HISTORICO'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <History className="w-4 h-4 mr-2" />
            Histórico
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('DOCUMENTOS')}
            className={`py-3 px-3.5 text-xs font-bold whitespace-nowrap border-b-2 flex items-center transition-colors ${
              activeTab === 'DOCUMENTOS'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <FileText className="w-4 h-4 mr-2" />
            Documentos
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('AVALIACOES')}
            className={`py-3 px-3.5 text-xs font-bold whitespace-nowrap border-b-2 flex items-center transition-colors ${
              activeTab === 'AVALIACOES'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Award className="w-4 h-4 mr-2" />
            Avaliações
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PONTO')}
            className={`py-3 px-3.5 text-xs font-bold whitespace-nowrap border-b-2 flex items-center transition-colors ${
              activeTab === 'PONTO'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Clock className="w-4 h-4 mr-2" />
            Ponto & Frequência
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ACESSO')}
            className={`py-3 px-3.5 text-xs font-bold whitespace-nowrap border-b-2 flex items-center transition-colors ${
              activeTab === 'ACESSO'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Key className="w-4 h-4 mr-2" />
            Acesso ao App
          </button>
        </nav>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: RESUMO                                                             */}
      {/* ========================================================================= */}
      {activeTab === 'RESUMO' && (
        <div className="space-y-6">
          {/* Quick Actions: Gerar para [Nome] */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Gerar para {employee?.name ?? 'o colaborador'}
                </h2>
              </div>
              <span className="text-xs text-slate-400">
                Atalhos rápidos para emissão de documentos oficiais
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <Link
                to={`/admin/documentos/ciencia?employeeId=${employeeId}&type=ACKNOWLEDGMENT_REGULATION`}
                className="group flex flex-col justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 hover:border-blue-300 dark:hover:border-blue-800 transition-all text-left"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100/60 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                      ~ 1 min
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    Ciência do Regimento
                  </div>
                </div>
                <span className="text-[11px] text-slate-500 mt-2 block">Termo de recebimento</span>
              </Link>

              <Link
                to={`/admin/documentos/ciencia?employeeId=${employeeId}&type=ACKNOWLEDGMENT_ROLE`}
                className="group flex flex-col justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 hover:border-blue-300 dark:hover:border-blue-800 transition-all text-left"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <FileCheck2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-100/60 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                      ~ 3 min
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    Ciência de Função
                  </div>
                </div>
                <span className="text-[11px] text-slate-500 mt-2 block">Descrição e mapa</span>
              </Link>

              <Link
                to={`/admin/documentos/disciplina?employeeId=${employeeId}&type=DISCIPLINE_VERBAL`}
                className="group flex flex-col justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-amber-50/50 dark:hover:bg-amber-950/30 hover:border-amber-300 dark:hover:border-amber-800 transition-all text-left"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100/60 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                      ~ 3 min
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                    Advertência Verbal
                  </div>
                </div>
                <span className="text-[11px] text-slate-500 mt-2 block">Registro formal</span>
              </Link>

              <Link
                to={`/admin/documentos/disciplina?employeeId=${employeeId}&type=DISCIPLINE_WRITTEN`}
                className="group flex flex-col justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-orange-50/50 dark:hover:bg-orange-950/30 hover:border-orange-300 dark:hover:border-orange-800 transition-all text-left"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-100/60 dark:bg-orange-950 text-orange-700 dark:text-orange-300">
                      ~ 3 min
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                    Advertência Escrita
                  </div>
                </div>
                <span className="text-[11px] text-slate-500 mt-2 block">Com 2 testemunhas</span>
              </Link>

              <Link
                to={`/admin/documentos/disciplina?employeeId=${employeeId}&type=DISCIPLINE_SUSPENSION`}
                className="group flex flex-col justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-rose-50/50 dark:hover:bg-rose-950/30 hover:border-rose-300 dark:hover:border-rose-800 transition-all text-left"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-100/60 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                      ~ 4 min
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                    Suspensão
                  </div>
                </div>
                <span className="text-[11px] text-slate-500 mt-2 block">Art. 474 da CLT</span>
              </Link>

              <Link
                to={`/admin/documentos/avaliacao?employeeId=${employeeId}`}
                className="group flex flex-col justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 hover:border-blue-300 dark:hover:border-blue-800 transition-all text-left"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100/60 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                      ~ 5 min
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    Avaliação Mensal
                  </div>
                </div>
                <span className="text-[11px] text-slate-500 mt-2 block">8 critérios e média</span>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 columns: Dados Pessoais & Vínculo */}
            <div className="lg:col-span-2 space-y-6">
              {/* Card: Dados Pessoais & Contato */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center">
                    <User className="w-4 h-4 mr-2 text-blue-600" />
                    Dados Pessoais e Contato
                  </h2>
                  <button
                    type="button"
                    onClick={() => setEditProfileOpen(true)}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center"
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1" />
                    Editar
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">CPF</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                      {profile?.cpf || 'Não informado'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">RG</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                      {profile?.rg || 'Não informado'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Data de Nascimento</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {profile?.birthDate ? formatDateBR(profile.birthDate) : 'Não informada'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Telefone</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                      {profile?.phone || 'Não informado'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block font-medium">E-mail Pessoal</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {profile?.personalEmail || 'Não informado'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block font-medium">Endereço Residencial</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {profile?.addressStreet
                        ? `${profile.addressStreet}, ${profile.addressNumber || 'S/N'}${profile.addressComplement ? ` - ${profile.addressComplement}` : ''} - ${profile.addressNeighborhood || ''}, ${profile.addressCity || ''}/${profile.addressState || ''} (CEP: ${profile.addressPostalCode || 'Não informado'})`
                        : 'Não informado'}
                    </span>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 block font-medium">Observações Internas</span>
                    <p className="text-slate-700 dark:text-slate-300 mt-1 italic leading-relaxed">
                      {profile?.notes || 'Nenhuma observação cadastrada.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Card: Vínculo & Cargo */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center">
                    <Award className="w-4 h-4 mr-2 text-indigo-600" />
                    Vínculo Empregatício e Cargo
                  </h2>
                  <button
                    type="button"
                    onClick={() => setAssignRoleOpen(true)}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Atribuir Cargo
                  </button>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block font-medium">
                        Situação Trabalhista
                      </span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 block">
                        {employee?.isActive ? 'Colaborador Ativo' : 'Colaborador Desligado'}
                      </span>
                    </div>
                    <StatusBadge isActive={employee?.isActive ?? true} />
                  </div>

                  <div>
                    <span className="text-slate-400 block font-medium">Data de Admissão</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      {profile?.hireDate
                        ? formatDateBR(profile.hireDate)
                        : employee?.createdAt
                          ? formatDateBR(employee.createdAt)
                          : '--'}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 block font-medium mb-1.5">
                      Cargo Principal Vigente
                    </span>
                    {profile?.roleAssignment ? (
                      <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 space-y-1">
                        <div className="text-sm font-bold text-blue-900 dark:text-blue-200">
                          {profile.roleAssignment.roleTitle}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 text-xs">
                          Versão do Cargo: v{profile.roleAssignment.versionNumber} · Início em{' '}
                          {formatDateBR(profile.roleAssignment.startDate)}
                        </div>
                        {profile.roleAssignment.notes && (
                          <div className="text-slate-600 dark:text-slate-300 text-xs pt-1 italic">
                            "{profile.roleAssignment.notes}"
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-slate-500">
                        Nenhum cargo formal atribuído a este colaborador.
                        <button
                          type="button"
                          onClick={() => setAssignRoleOpen(true)}
                          className="block mx-auto mt-2 text-xs font-bold text-blue-600 hover:underline"
                        >
                          Atribuir Cargo Agora
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right 1 column: Acesso ao App & Escala Disciplinar */}
            <div className="space-y-6">
              {/* Card: Acesso ao Aplicativo */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center">
                    <Key className="w-4 h-4 mr-2 text-blue-600" />
                    Acesso ao app
                  </h2>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      employee?.accessEnabled
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                    }`}
                  >
                    {employee?.accessEnabled ? 'Acesso liberado' : 'Acesso bloqueado'}
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">CPF / Login</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                      {profile?.cpf || employee?.login || 'Não cadastrado'}
                    </span>
                  </div>

                  <div className="pt-2 flex flex-col gap-2">
                    {employee?.accessEnabled ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setResetPasswordOpen(true)}
                          className="w-full inline-flex items-center justify-center py-2 px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Lock className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                          Gerar outra senha
                        </button>
                        <button
                          type="button"
                          onClick={() => disableAccessMutation.mutate()}
                          disabled={disableAccessMutation.isPending}
                          className="w-full inline-flex items-center justify-center py-2 px-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/40 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-colors"
                        >
                          <UserX className="w-3.5 h-3.5 mr-1.5" />
                          {disableAccessMutation.isPending ? 'Desativando...' : 'Tirar o acesso'}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEnableAccessOpen(true)}
                        className="w-full inline-flex items-center justify-center py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
                      >
                        <Key className="w-3.5 h-3.5 mr-1.5" />
                        Liberar Acesso ao App
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Card: Escala Disciplinar */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center">
                    <ShieldAlert className="w-4 h-4 mr-2 text-amber-600" />
                    Escala disciplinar
                  </h2>
                  <Link
                    to={`/admin/documentos/disciplina?employeeId=${employeeId}`}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Gerenciar
                  </Link>
                </div>

                <div className="space-y-3">
                  {[
                    {
                      level: 1,
                      name: '1. Conversa individual',
                      desc: 'Alinhamento verbal e orientação',
                      isCompleted:
                        (disciplinarySummary?.verbalCount ?? 0) > 0 ||
                        (disciplinarySummary?.writtenCount ?? 0) > 0 ||
                        (disciplinarySummary?.suspensionCount ?? 0) > 0 ||
                        !employee?.isActive,
                      isNext: false,
                    },
                    {
                      level: 2,
                      name: '2. Advertência verbal',
                      desc: 'Registro formal com orientações',
                      isCompleted:
                        (disciplinarySummary?.verbalCount ?? 0) > 0 ||
                        (disciplinarySummary?.writtenCount ?? 0) > 0 ||
                        (disciplinarySummary?.suspensionCount ?? 0) > 0 ||
                        !employee?.isActive,
                      isNext:
                        disciplinarySummary?.nextSuggestedStage === 'VERBAL_WARNING' &&
                        (disciplinarySummary?.verbalCount ?? 0) === 0 &&
                        Boolean(employee?.isActive),
                    },
                    {
                      level: 3,
                      name: '3. Advertência escrita',
                      desc: 'Ciência formal com 2 testemunhas',
                      isCompleted:
                        (disciplinarySummary?.writtenCount ?? 0) > 0 ||
                        (disciplinarySummary?.suspensionCount ?? 0) > 0 ||
                        !employee?.isActive,
                      isNext:
                        disciplinarySummary?.nextSuggestedStage === 'WRITTEN_WARNING' &&
                        Boolean(employee?.isActive),
                    },
                    {
                      level: 4,
                      name: '4. Suspensão disciplinar',
                      desc: 'Afastamento CLT (máx. 30 dias)',
                      isCompleted:
                        (disciplinarySummary?.suspensionCount ?? 0) > 0 || !employee?.isActive,
                      isNext:
                        disciplinarySummary?.nextSuggestedStage === 'SUSPENSION' &&
                        Boolean(employee?.isActive),
                    },
                    {
                      level: 5,
                      name: '5. Desligamento',
                      desc: 'Revisão jurídica e rescisão',
                      isCompleted: !employee?.isActive,
                      isNext:
                        disciplinarySummary?.nextSuggestedStage === 'DISMISSAL_REVIEW' &&
                        Boolean(employee?.isActive),
                    },
                  ].map((step) => (
                    <div
                      key={step.level}
                      className={`flex items-start justify-between p-2.5 rounded-xl border transition-colors ${
                        step.isNext
                          ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/60'
                          : step.isCompleted
                            ? 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                            : 'bg-transparent border-slate-100 dark:border-slate-800/60 text-slate-400'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5">
                          {step.isCompleted ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          ) : (
                            <div
                              className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] font-bold ${
                                step.isNext
                                  ? 'border-blue-600 text-blue-600 bg-blue-100 dark:bg-blue-900/50'
                                  : 'border-slate-300 dark:border-slate-700 text-slate-400'
                              }`}
                            >
                              {step.level}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            {step.name}
                          </div>
                          <div className="text-[11px] text-slate-500">{step.desc}</div>
                        </div>
                      </div>

                      {step.isNext && (
                        <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-blue-600 text-white shadow-xs">
                          Próxima
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: HISTÓRICO (UNIFIED TIMELINE)                                       */}
      {/* ========================================================================= */}
      {activeTab === 'HISTORICO' && (
        <div className="space-y-6">
          {/* Timeline Header & Filter Pills */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-2 flex items-center">
                <Filter className="w-3.5 h-3.5 mr-1" />
                Filtrar:
              </span>
              {[
                { key: 'ALL', label: 'Todos' },
                { key: 'EMPLOYMENT', label: 'Vínculo & Eventos' },
                { key: 'ROLE', label: 'Cargos' },
                { key: 'DOCUMENT', label: 'Documentos' },
                { key: 'ACCESS', label: 'Acesso' },
                { key: 'VACATION', label: 'Férias' },
                { key: 'DISCIPLINE', label: 'Disciplina' },
              ].map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => {
                    setTimelineCategory(c.key as TimelineCategoryDto | 'ALL');
                    setTimelineOffset(0);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    timelineCategory === c.key
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto">
              <Link
                to={`/admin/documentos/disciplina?employeeId=${id}`}
                className="inline-flex items-center text-xs font-semibold py-2 px-3.5 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
              >
                <ShieldAlert className="w-3.5 h-3.5 mr-1.5" />
                Medida Disciplinar
              </Link>
              <button
                type="button"
                onClick={() => setCreateEventOpen(true)}
                className="inline-flex items-center text-xs font-semibold py-2 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Novo Registro / Anotação
              </button>
            </div>
          </div>

          {/* Timeline Stream */}
          {timelineLoading ? (
            <div className="p-12 flex flex-col items-center justify-center space-y-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
              <p className="text-sm font-medium">Carregando histórico do colaborador...</p>
            </div>
          ) : timeline && timeline.items.length > 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6">
              <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-4 space-y-8">
                {timeline.items.map((item: EmployeeTimelineItemDto) => {
                  let badgeColor = 'bg-blue-500';
                  let icon = <Clock className="w-3.5 h-3.5 text-white" />;

                  if (item.category === 'EMPLOYMENT') {
                    badgeColor = 'bg-emerald-600';
                    icon = <UserCheck className="w-3.5 h-3.5 text-white" />;
                  } else if (item.category === 'ROLE') {
                    badgeColor = 'bg-indigo-600';
                    icon = <Award className="w-3.5 h-3.5 text-white" />;
                  } else if (item.category === 'DOCUMENT') {
                    badgeColor = 'bg-amber-600';
                    icon = <FileText className="w-3.5 h-3.5 text-white" />;
                  } else if (item.category === 'ACCESS') {
                    badgeColor = 'bg-slate-700';
                    icon = <Key className="w-3.5 h-3.5 text-white" />;
                  } else if (item.category === 'VACATION') {
                    badgeColor = 'bg-teal-600';
                    icon = <CalendarIcon className="w-3.5 h-3.5 text-white" />;
                  } else if (item.category === 'DISCIPLINE') {
                    badgeColor = 'bg-rose-600';
                    icon = <AlertTriangle className="w-3.5 h-3.5 text-white" />;
                  }

                  return (
                    <div key={item.id} className="relative pl-6">
                      {/* Timeline Dot */}
                      <span
                        className={`absolute -left-3 top-1 flex items-center justify-center w-6 h-6 rounded-full ${badgeColor} ring-4 ring-white dark:ring-slate-900`}
                      >
                        {icon}
                      </span>

                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b border-slate-200/60 dark:border-slate-700 pb-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                              {item.category}
                            </span>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                              {item.title}
                            </h3>
                          </div>
                          <span className="text-xs font-mono text-slate-400">
                            {formatDateBR(item.occurredAt)} {formatTime(item.occurredAt)}
                          </span>
                        </div>

                        {item.description && (
                          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                            {item.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                          <span>
                            Registrado por:{' '}
                            <strong className="text-slate-600 dark:text-slate-300 font-semibold">
                              {item.actorName || 'Sistema'}
                            </strong>
                          </span>

                          {item.documentId && (
                            <button
                              type="button"
                              onClick={() =>
                                void handleOpenPdfPreview({
                                  id: item.documentId!,
                                  title: item.title,
                                  artifactId:
                                    (item.metadata?.artifactId as string) || item.documentId!,
                                  isVoid: false,
                                })
                              }
                              className="inline-flex items-center text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" />
                              Ver Documento
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination controls */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
                <span className="text-slate-500">
                  Total de registros:{' '}
                  <strong className="text-slate-800 dark:text-slate-200">{timeline.total}</strong>
                </span>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setTimelineOffset((prev) => Math.max(0, prev - 20))}
                    disabled={timelineOffset === 0}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimelineOffset((prev) => prev + 20)}
                    disabled={timelineOffset + 20 >= timeline.total}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-500">
              <History className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-semibold">Nenhum evento registrado no histórico.</p>
              <p className="text-xs text-slate-400 mt-1">
                Eventos de admissão, cargos, documentos, férias e acessos aparecerão aqui em ordem
                cronológica.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DOCUMENTOS                                                         */}
      {/* ========================================================================= */}
      {activeTab === 'DOCUMENTOS' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Documentos Emitidos para o Colaborador
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Termos de ciência, fichas e documentos oficiais gerados com validade jurídica e
                  assinatura física.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/admin/documentos/ciencia')}
                className="inline-flex items-center text-xs font-semibold py-2 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Emitir Novo Termo
              </button>
            </div>

            {documentsLoading ? (
              <div className="p-12 flex flex-col items-center justify-center space-y-3 text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                <p className="text-sm font-medium">Carregando documentos...</p>
              </div>
            ) : employeeDocuments && employeeDocuments.items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Documento</th>
                      <th className="py-3 px-3">Tipo</th>
                      <th className="py-3 px-3">Versão</th>
                      <th className="py-3 px-3">Data de Emissão</th>
                      <th className="py-3 px-3">Emitido Por</th>
                      <th className="py-3 px-3">Situação</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {employeeDocuments.items.map((doc: GeneratedDocumentDto) => (
                      <tr
                        key={doc.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                          {doc.title}
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                          {DOCUMENT_TYPE_LABELS[doc.documentType] || doc.documentType}
                        </td>
                        <td className="py-3 px-3 font-mono font-semibold text-slate-500">
                          v{doc.version}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-500">
                          {formatDateBR(doc.createdAt)}
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                          {doc.authorName || 'Administrador'}
                        </td>
                        <td className="py-3 px-3">
                          {doc.isVoid ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <Ban className="w-3 h-3 mr-1" />
                              Anulado
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Válido
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() =>
                              void handleOpenPdfPreview({
                                id: doc.id,
                                title: doc.title,
                                artifactId: doc.artifactId,
                                isVoid: doc.isVoid,
                                voidReason: doc.voidReason,
                              })
                            }
                            className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 font-semibold"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            Visualizar
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDownloadDoc(doc.id)}
                            className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-semibold"
                          >
                            <Download className="w-3.5 h-3.5 mr-1" />
                            Baixar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-500">
                <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-semibold">
                  Nenhum documento gerado para este colaborador.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Você pode gerar termos de ciência de regimento interno ou de descrição de cargo.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: AVALIAÇÕES (FASE HR-7)                                             */}
      {/* ========================================================================= */}
      {activeTab === 'AVALIACOES' && (
        <div className="space-y-6">
          {/* Header & Quick Action */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Avaliações de Desempenho e Competências
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Acompanhamento periódico do colaborador com base nos 8 critérios canônicos da{' '}
                <strong>PH Motopeças</strong>.
              </p>
            </div>

            <Link
              to={`/admin/documentos/avaliacao?employeeId=${employeeId}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              Nova Avaliação de Desempenho
            </Link>
          </div>

          {reviewsLoading ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" /> Carregando avaliações de desempenho...
            </div>
          ) : performanceReviews && performanceReviews.length > 0 ? (
            <div className="space-y-6">
              {/* Highlight Latest Active Review */}
              {(() => {
                const latestReview =
                  performanceReviews.find((r) => !r.isSuperseded) ?? performanceReviews[0]!;
                return (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Avaliação Mais Recente
                          </span>
                          {latestReview.isSuperseded && (
                            <span className="text-[10px] bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded font-bold border border-amber-200 dark:border-amber-800">
                              Substituída
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                          Período: {latestReview.evaluationPeriod}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Realizada em {formatDateBR(latestReview.evaluationDate)} por{' '}
                          <strong>{latestReview.evaluatorName ?? 'Avaliador'}</strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                            {latestReview.meanScore.toFixed(2)}
                            <span className="text-xs font-normal text-slate-400"> / 5.00</span>
                          </div>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              PERFORMANCE_CLASSIFICATION_BADGES[latestReview.classification]
                            }`}
                          >
                            {PERFORMANCE_CLASSIFICATION_LABELS[latestReview.classification].label}
                          </span>
                        </div>

                        {latestReview.generatedDocumentId && (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const doc = await api.getDocument(
                                  latestReview.generatedDocumentId!,
                                );
                                void handleOpenPdfPreview(doc);
                              } catch {
                                toastError('Não foi possível carregar o laudo PDF da avaliação.');
                              }
                            }}
                            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                            title="Visualizar laudo PDF"
                          >
                            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 8 Criteria Grid */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                        Desempenho por Critério Canônico
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {latestReview.scores.map((cs) => (
                          <div
                            key={cs.criterionKey}
                            className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                                {cs.criterionTitle}
                              </span>
                              <span className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center font-mono">
                                {cs.score}
                              </span>
                            </div>
                            {cs.feedback && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 italic">
                                "{cs.feedback}"
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Qualitative Summary */}
                    {(latestReview.strengths ||
                      latestReview.improvements ||
                      latestReview.actionPlan ||
                      latestReview.evaluatorComments) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                        {latestReview.strengths && (
                          <div className="space-y-1">
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                              Pontos Fortes:
                            </span>
                            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                              {latestReview.strengths}
                            </p>
                          </div>
                        )}
                        {latestReview.improvements && (
                          <div className="space-y-1">
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                              Oportunidades de Melhoria:
                            </span>
                            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                              {latestReview.improvements}
                            </p>
                          </div>
                        )}
                        {latestReview.actionPlan && (
                          <div className="space-y-1">
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                              Plano de Ação:
                            </span>
                            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                              {latestReview.actionPlan}
                            </p>
                          </div>
                        )}
                        {latestReview.evaluatorComments && (
                          <div className="space-y-1">
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                              Parecer do Avaliador:
                            </span>
                            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                              {latestReview.evaluatorComments}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* History Table */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Histórico de Todas as Avaliações
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                        <th className="py-2.5 px-3">Data</th>
                        <th className="py-2.5 px-3">Período</th>
                        <th className="py-2.5 px-3 text-center">Nota Média</th>
                        <th className="py-2.5 px-3">Classificação</th>
                        <th className="py-2.5 px-3">Avaliador</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Laudo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {performanceReviews.map((rev) => (
                        <tr
                          key={rev.id}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {formatDateBR(rev.evaluationDate)}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                            {rev.evaluationPeriod}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold font-mono text-slate-900 dark:text-white">
                            {rev.meanScore.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                PERFORMANCE_CLASSIFICATION_BADGES[rev.classification]
                              }`}
                            >
                              {PERFORMANCE_CLASSIFICATION_LABELS[rev.classification].label}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                            {rev.evaluatorName ?? 'Avaliador'}
                          </td>
                          <td className="py-2.5 px-3">
                            {rev.isSuperseded ? (
                              <span
                                className="text-[10px] text-amber-600 font-semibold bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800"
                                title={rev.supersessionReason ?? 'Substituída'}
                              >
                                Substituída
                              </span>
                            ) : (
                              <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                                Vigente
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {rev.generatedDocumentId && (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    const doc = await api.getDocument(rev.generatedDocumentId!);
                                    void handleOpenPdfPreview(doc);
                                  } catch {
                                    toastError('Não foi possível carregar o laudo PDF.');
                                  }
                                }}
                                className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded transition-colors"
                                title="Ver laudo PDF"
                              >
                                <FileText className="w-4 h-4 inline" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-xs text-center max-w-2xl mx-auto space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-inner border border-blue-100 dark:border-blue-900">
                <Award className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Nenhuma avaliação registrada ainda
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                As avaliações de desempenho consolidam os 8 critérios canônicos da{' '}
                <strong>PH Motopeças</strong> com notas de 1 a 5, cálculo automático da média e
                emissão do laudo em PDF para assinatura física.
              </p>
              <div className="pt-2">
                <Link
                  to={`/admin/documentos/avaliacao?employeeId=${employeeId}`}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Realizar Primeira Avaliação
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: PONTO (ATTENDANCE & TIME TRACKING)                                  */}
      {/* ========================================================================= */}
      {activeTab === 'PONTO' && (
        <div className="space-y-6">
          {/* Month Navigator & Summary Cards */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center space-x-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Mês de Referência:
              </span>
              <MonthPicker
                value={currentMonth}
                onChange={(newMonth) => {
                  setCurrentMonth(newMonth);
                  setSelectedDayDate(null);
                }}
              />
            </div>

            {monthly && (
              <div className="grid grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0 w-full md:w-auto">
                <div className="text-center px-2">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase">
                    Trabalhado
                  </div>
                  <div className="text-base font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                    {formatMinutesDuration(monthly.totals.workedMinutes)}
                  </div>
                </div>
                <div className="text-center px-2 border-x border-slate-200 dark:border-slate-700">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase">Esperado</div>
                  <div className="text-base font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                    {formatMinutesDuration(monthly.totals.expectedMinutes)}
                  </div>
                </div>
                <div className="text-center px-2">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase">
                    Saldo Mês
                  </div>
                  <div
                    className={`text-base font-bold font-mono mt-0.5 ${
                      monthly.totals.balanceMinutes >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {formatMinutesDuration(monthly.totals.balanceMinutes)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sub-tabs: Calendar vs Punches Table */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setAttendanceView('CALENDAR')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center ${
                attendanceView === 'CALENDAR'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <CalendarIcon className="w-4 h-4 mr-2" />
              Calendário Mensal
            </button>
            <button
              type="button"
              onClick={() => setAttendanceView('PUNCHES')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center ${
                attendanceView === 'PUNCHES'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <History className="w-4 h-4 mr-2" />
              Extrato de Batidas
            </button>
          </div>

          {monthlyLoading && (
            <div className="p-12 flex flex-col items-center justify-center space-y-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
              <p className="text-sm font-medium">Carregando espelho de ponto...</p>
            </div>
          )}

          {/* Attendance View 1: Calendar Grid & Selected Day */}
          {attendanceView === 'CALENDAR' && monthly && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
                  Dias Trabalhados no Mês
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                  {monthly.days.map((day: DailyAttendance) => {
                    const dayNumber = day.businessDate.split('-')[2];
                    const isSelected = selectedDay?.businessDate === day.businessDate;

                    return (
                      <button
                        key={day.businessDate}
                        type="button"
                        onClick={() => setSelectedDayDate(day.businessDate)}
                        className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                          isSelected
                            ? 'border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/40 dark:bg-blue-950/30'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-base font-bold text-slate-900 dark:text-white">
                            {dayNumber}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {day.punchCount} pts
                          </span>
                        </div>

                        <div className="mt-2 space-y-1">
                          <StatusBadge
                            status={day.status}
                            workState={day.workState}
                            className="text-[10px] py-0 px-1.5"
                          />
                          <div className="text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-300">
                            {formatMinutesDuration(day.workedMinutes)}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected Day Punch Detail */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-5">
                {selectedDay ? (
                  <>
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Detalhes do Dia {formatDateBR(selectedDay.businessDate)}
                        </h4>
                        <div className="mt-1">
                          <StatusBadge
                            status={selectedDay.status}
                            workState={selectedDay.workState}
                          />
                        </div>
                      </div>
                      <div className="text-right font-mono text-xs">
                        <div className="text-slate-500">Saldo do dia</div>
                        <div
                          className={`font-bold text-sm ${
                            selectedDay.balanceMinutes !== null && selectedDay.balanceMinutes >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {selectedDay.balanceMinutes !== null
                            ? formatMinutesDuration(selectedDay.balanceMinutes)
                            : '--:--'}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Batidas Registradas
                      </h5>
                      {selectedDay.chronology.punches.length === 0 ? (
                        <p className="text-xs text-slate-500 py-4 text-center">
                          Nenhuma batida registrada nesta data.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {selectedDay.chronology.punches.map(
                            (punch: EffectivePunch, idx: number) => (
                              <div
                                key={punch.id}
                                className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-sm"
                              >
                                <div className="flex items-center space-x-3">
                                  <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold">
                                    {idx + 1}
                                  </span>
                                  <div>
                                    <div className="font-mono font-bold text-slate-900 dark:text-white">
                                      {formatTime(punch.effectiveOccurredAt)}
                                    </div>
                                    <div className="text-[10px] text-slate-500">
                                      {punch.kind === 'CLOCK_IN' ? 'Entrada' : 'Saída'}
                                      {punch.appliedAdjustmentCount > 0 && (
                                        <span className="text-blue-600 ml-1">
                                          ({punch.appliedAdjustmentCount} ajuste(s))
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() =>
                                    setCorrectPunch({
                                      id: punch.id,
                                      occurredAt: punch.effectiveOccurredAt,
                                      sequence: punch.appliedAdjustmentCount,
                                    })
                                  }
                                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 hover:underline flex items-center"
                                >
                                  <Edit2 className="w-3.5 h-3.5 mr-1" />
                                  Corrigir
                                </button>
                              </div>
                            ),
                          )}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 space-y-1">
                      <div>
                        Horas previstas na jornada:{' '}
                        {formatMinutesDuration(selectedDay.expectedMinutes)}
                      </div>
                      <div>Intervalos completos: {selectedDay.completedIntervalCount}</div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-8">
                    Selecione um dia no calendário ao lado.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Attendance View 2: Full Extrato Table */}
          {attendanceView === 'PUNCHES' && monthly && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Data</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Previsto</th>
                      <th className="py-3 px-3">Trabalhado</th>
                      <th className="py-3 px-3">Saldo</th>
                      <th className="py-3 px-4">Batidas Efetivas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {monthly.days.map((day: DailyAttendance) => (
                      <tr
                        key={day.businessDate}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                          {formatDateBR(day.businessDate)}
                        </td>
                        <td className="py-3 px-3">
                          <StatusBadge status={day.status} workState={day.workState} />
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400">
                          {formatMinutesDuration(day.expectedMinutes)}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                          {formatMinutesDuration(day.workedMinutes)}
                        </td>
                        <td
                          className={`py-3 px-3 font-mono font-bold ${
                            day.balanceMinutes !== null && day.balanceMinutes >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {day.balanceMinutes !== null
                            ? formatMinutesDuration(day.balanceMinutes)
                            : '--:--'}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                          {day.chronology.punches.length === 0 ? (
                            <span className="text-slate-400">Sem registros</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {day.chronology.punches.map((p: EffectivePunch) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() =>
                                    setCorrectPunch({
                                      id: p.id,
                                      occurredAt: p.effectiveOccurredAt,
                                      sequence: p.appliedAdjustmentCount,
                                    })
                                  }
                                  title="Clique para corrigir este horário"
                                  className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-950/50 dark:hover:text-blue-300 border border-slate-200 dark:border-slate-700 transition-colors"
                                >
                                  {formatTime(p.effectiveOccurredAt)}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: ACESSO AO APLICATIVO                                               */}
      {/* ========================================================================= */}
      {activeTab === 'ACESSO' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card: Status do Acesso */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center">
              <Key className="w-4 h-4 mr-2 text-blue-600" />
              Controle de Acesso ao Sistema
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              O acesso ao aplicativo permite que o colaborador faça login no PH-Ponto para registrar
              ponto e consultar seu espelho mensal. O vínculo de emprego permanece ativo mesmo com o
              acesso desabilitado.
            </p>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                  Status Atual
                </span>
                <span className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 block">
                  {employee?.accessEnabled ? 'Acesso Liberado para Login' : 'Acesso Bloqueado'}
                </span>
              </div>
              {employee?.accessEnabled ? (
                <button
                  type="button"
                  onClick={() => disableAccessMutation.mutate()}
                  disabled={disableAccessMutation.isPending}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition-colors"
                >
                  {disableAccessMutation.isPending ? 'Desativando...' : 'Desativar Acesso'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setEnableAccessOpen(true)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                >
                  Habilitar Acesso
                </button>
              )}
            </div>
          </div>

          {/* Card: Credenciais & Sessões */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center">
              <ShieldAlert className="w-4 h-4 mr-2 text-rose-600" />
              Segurança e Sessões Ativas
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Gerencie a redefinição de senha e encerramento de conexões ativas do colaborador em
              computadores e dispositivos.
            </p>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    Redefinir Senha
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    Define uma nova senha e encerra as sessões ativas do colaborador.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setResetPasswordOpen(true)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  Redefinir
                </button>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20">
                <div>
                  <span className="text-xs font-bold text-rose-900 dark:text-rose-200 block">
                    Encerrar Todas as Sessões
                  </span>
                  <span className="text-[11px] text-rose-700 dark:text-rose-400 block mt-0.5">
                    Desconecta imediatamente o colaborador de todos os dispositivos.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => revokeSessionsMutation.mutate()}
                  disabled={revokeSessionsMutation.isPending}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors"
                >
                  {revokeSessionsMutation.isPending ? 'Encerrando...' : 'Encerrar Sessões'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS                                                                    */}
      {/* ========================================================================= */}

      {/* Edit Profile Modal */}
      {editProfileOpen && (
        <EditProfileModal
          isOpen={editProfileOpen}
          onClose={() => setEditProfileOpen(false)}
          profile={profile}
          onSuccess={() => {
            setEditProfileOpen(false);
            invalidateEmployeeData();
          }}
          employeeId={employeeId}
        />
      )}

      {/* Terminate Modal */}
      {terminateOpen && (
        <TerminateEmployeeModal
          isOpen={terminateOpen}
          onClose={() => setTerminateOpen(false)}
          employeeName={employee?.name ?? ''}
          employeeId={employeeId}
          onSuccess={() => {
            setTerminateOpen(false);
            invalidateEmployeeData();
          }}
        />
      )}

      {/* Reactivate Modal */}
      {reactivateOpen && (
        <ReactivateEmployeeModal
          isOpen={reactivateOpen}
          onClose={() => setReactivateOpen(false)}
          employeeName={employee?.name ?? ''}
          employeeId={employeeId}
          onSuccess={() => {
            setReactivateOpen(false);
            invalidateEmployeeData();
          }}
        />
      )}

      {/* Assign Role Modal */}
      {assignRoleOpen && (
        <AssignRoleModal
          isOpen={assignRoleOpen}
          onClose={() => setAssignRoleOpen(false)}
          employeeId={employeeId}
          roles={jobRoles ?? []}
          onSuccess={() => {
            setAssignRoleOpen(false);
            invalidateEmployeeData();
          }}
        />
      )}

      {/* Create Employment Event Modal */}
      {createEventOpen && (
        <CreateEmploymentEventModal
          isOpen={createEventOpen}
          onClose={() => setCreateEventOpen(false)}
          employeeId={employeeId}
          onSuccess={() => {
            setCreateEventOpen(false);
            invalidateEmployeeData();
          }}
        />
      )}

      {/* Enable Access Modal */}
      {enableAccessOpen && (
        <EnableAccessModal
          isOpen={enableAccessOpen}
          onClose={() => setEnableAccessOpen(false)}
          employeeId={employeeId}
          onSuccess={() => {
            setEnableAccessOpen(false);
            invalidateEmployeeData();
          }}
        />
      )}

      {/* Reset Password Modal */}
      {resetPasswordOpen && (
        <ResetPasswordModal
          isOpen={resetPasswordOpen}
          onClose={() => setResetPasswordOpen(false)}
          employeeId={employeeId}
          onSuccess={() => {
            setResetPasswordOpen(false);
            invalidateEmployeeData();
          }}
        />
      )}

      {/* PDF Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {previewDoc.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleClosePdfPreview}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-2 overflow-hidden flex justify-center items-center">
              {isPreviewLoading ? (
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
                  <span className="text-xs">Carregando visualização do PDF...</span>
                </div>
              ) : previewBlobUrl ? (
                <iframe
                  src={previewBlobUrl}
                  title={previewDoc.title}
                  className="w-full h-full rounded-lg border border-slate-300 dark:border-slate-800 shadow-inner bg-white"
                />
              ) : (
                <div className="text-xs text-rose-500">Erro ao carregar prévia do PDF.</div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-900">
              <span className="text-xs text-slate-500">
                {previewDoc.isVoid ? (
                  <span className="text-rose-600 font-semibold flex items-center gap-1">
                    <Ban className="w-3.5 h-3.5" />
                    Documento Anulado: {previewDoc.voidReason}
                  </span>
                ) : (
                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Documento Oficial
                  </span>
                )}
              </span>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleDownloadDoc(previewDoc.id)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Baixar PDF
                </button>
                <button
                  type="button"
                  onClick={handleClosePdfPreview}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Avatar Modal */}
      {employee && (
        <AvatarModal
          isOpen={avatarOpen}
          onClose={() => setAvatarOpen(false)}
          userId={employee.id}
          userName={employee.name}
          hasAvatar={employee.hasAvatar}
          onAvatarUpdated={() => void refetchEmployee()}
        />
      )}

      {/* Manual Punch Modal */}
      {employee && (
        <ManualPunchModal
          isOpen={manualPunchOpen}
          onClose={() => setManualPunchOpen(false)}
          employees={[employee]}
          initialEmployeeId={employee.id}
          initialDate={selectedDay?.businessDate}
          existingDays={monthly?.days}
          onSuccess={() => void refetchMonthly()}
        />
      )}

      {/* Punch Correction Modal */}
      {correctPunch && employee && (
        <PunchCorrectionModal
          isOpen={true}
          onClose={() => setCorrectPunch(null)}
          punchId={correctPunch.id}
          employeeName={employee.name}
          originalOccurredAt={correctPunch.occurredAt}
          currentSequence={correctPunch.sequence}
          onSuccess={() => void refetchMonthly()}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// SUBCOMPONENTS / MODALS
// -----------------------------------------------------------------------------

function EditProfileModal({
  isOpen,
  onClose,
  profile,
  employeeId,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  profile?: EmployeeProfileDto | null | undefined;
  employeeId: string;
  onSuccess: () => void;
}): React.JSX.Element {
  const api = useApiClient();
  const { success, error: toastError } = useToast();

  const [cpf, setCpf] = useState(profile?.cpf ?? '');
  const [rg, setRg] = useState(profile?.rg ?? '');
  const [birthDate, setBirthDate] = useState(profile?.birthDate ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [personalEmail, setPersonalEmail] = useState(profile?.personalEmail ?? '');
  const [hireDate, setHireDate] = useState(profile?.hireDate ?? '');
  const [addressStreet, setAddressStreet] = useState(profile?.addressStreet ?? '');
  const [addressNumber, setAddressNumber] = useState(profile?.addressNumber ?? '');
  const [addressComplement, setAddressComplement] = useState(profile?.addressComplement ?? '');
  const [addressNeighborhood, setAddressNeighborhood] = useState(
    profile?.addressNeighborhood ?? '',
  );
  const [addressCity, setAddressCity] = useState(profile?.addressCity ?? '');
  const [addressState, setAddressState] = useState(profile?.addressState ?? '');
  const [addressPostalCode, setAddressPostalCode] = useState(profile?.addressPostalCode ?? '');
  const [notes, setNotes] = useState(profile?.notes ?? '');

  const mutation = useMutation({
    mutationFn: () => {
      const payload: UpdateEmployeeProfileDto = {
        cpf: cpf.trim() || null,
        rg: rg.trim() || null,
        birthDate: birthDate.trim() || null,
        phone: phone.trim() || null,
        personalEmail: personalEmail.trim() || null,
        hireDate: hireDate.trim() || null,
        addressStreet: addressStreet.trim() || null,
        addressNumber: addressNumber.trim() || null,
        addressComplement: addressComplement.trim() || null,
        addressNeighborhood: addressNeighborhood.trim() || null,
        addressCity: addressCity.trim() || null,
        addressState: addressState.trim().toUpperCase() || null,
        addressPostalCode: addressPostalCode.trim() || null,
        notes: notes.trim() || null,
      };
      return api.updateEmployeeProfile(employeeId, payload);
    },
    onSuccess: () => {
      success('Dados cadastrais atualizados com sucesso.');
      onSuccess();
    },
    onError: () => {
      toastError('Erro ao atualizar os dados cadastrais.');
    },
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Editar Dados Cadastrais e Contato"
      maxWidth="2xl"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="p-6 space-y-4 text-xs overflow-y-auto max-h-[75vh]"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">CPF</label>
            <input
              type="text"
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              placeholder="000.000.000-00"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">RG</label>
            <input
              type="text"
              value={rg}
              onChange={(e) => setRg(e.target.value)}
              placeholder="00.000.000-0"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Data de Nascimento
            </label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Telefone
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(00) 00000-0000"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              E-mail Pessoal
            </label>
            <input
              type="email"
              value={personalEmail}
              onChange={(e) => setPersonalEmail(e.target.value)}
              placeholder="colaborador@email.com"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Data de Admissão
            </label>
            <input
              type="date"
              value={hireDate}
              onChange={(e) => setHireDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
          <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-2">
            Endereço Residencial
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-3">
              <label className="font-medium text-slate-500 block mb-1">Logradouro / Rua</label>
              <input
                type="text"
                value={addressStreet}
                onChange={(e) => setAddressStreet(e.target.value)}
                placeholder="Rua das Peças"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="font-medium text-slate-500 block mb-1">Número</label>
              <input
                type="text"
                value={addressNumber}
                onChange={(e) => setAddressNumber(e.target.value)}
                placeholder="123"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="font-medium text-slate-500 block mb-1">Complemento</label>
              <input
                type="text"
                value={addressComplement}
                onChange={(e) => setAddressComplement(e.target.value)}
                placeholder="Apto 101"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="font-medium text-slate-500 block mb-1">Bairro</label>
              <input
                type="text"
                value={addressNeighborhood}
                onChange={(e) => setAddressNeighborhood(e.target.value)}
                placeholder="Centro"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="font-medium text-slate-500 block mb-1">Cidade</label>
              <input
                type="text"
                value={addressCity}
                onChange={(e) => setAddressCity(e.target.value)}
                placeholder="São Paulo"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="font-medium text-slate-500 block mb-1">UF (Estado)</label>
              <input
                type="text"
                maxLength={2}
                value={addressState}
                onChange={(e) => setAddressState(e.target.value.toUpperCase())}
                placeholder="SP"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white uppercase"
              />
            </div>
            <div>
              <label className="font-medium text-slate-500 block mb-1">CEP</label>
              <input
                type="text"
                value={addressPostalCode}
                onChange={(e) => setAddressPostalCode(e.target.value)}
                placeholder="00000-000"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
          <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
            Observações Internas
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anotações internas sobre o colaborador..."
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 font-semibold text-white disabled:opacity-50"
          >
            {mutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function TerminateEmployeeModal({
  isOpen,
  onClose,
  employeeName,
  employeeId,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  employeeName: string;
  employeeId: string;
  onSuccess: () => void;
}): React.JSX.Element {
  const api = useApiClient();
  const { success, error: toastError } = useToast();

  const [effectiveDate, setEffectiveDate] = useState(getTodayString());
  const [reason, setReason] = useState<TerminationReasonDto>('WITHOUT_CAUSE');
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      api.terminateEmployee(employeeId, {
        effectiveDate,
        reason,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      success('Colaborador desligado com sucesso.');
      onSuccess();
    },
    onError: () => {
      toastError('Erro ao registrar desligamento.');
    },
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Registrar Desligamento de Colaborador">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="p-6 space-y-4 text-xs"
      >
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 leading-relaxed">
          Você está prestes a desligar <strong>{employeeName}</strong>. Esta ação desativará o
          usuário, encerrará todas as sessões ativas no aplicativo e registrará o evento na linha do
          tempo.
        </div>

        <div>
          <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
            Data de Desligamento *
          </label>
          <input
            type="date"
            required
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
          />
        </div>

        <div>
          <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
            Motivo da Rescisão / Desligamento *
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as TerminationReasonDto)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
          >
            {TERMINATION_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
            Observações / Justificativa
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Detalhes ou justificativa formal do desligamento..."
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 font-semibold text-white disabled:opacity-50"
          >
            {mutation.isPending ? 'Desligando...' : 'Confirmar Desligamento'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ReactivateEmployeeModal({
  isOpen,
  onClose,
  employeeName,
  employeeId,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  employeeName: string;
  employeeId: string;
  onSuccess: () => void;
}): React.JSX.Element {
  const api = useApiClient();
  const { success, error: toastError } = useToast();

  const [effectiveDate, setEffectiveDate] = useState(getTodayString());
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      api.reactivateEmployee(employeeId, {
        effectiveDate,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      success('Vínculo do colaborador reativado com sucesso.');
      onSuccess();
    },
    onError: () => {
      toastError('Erro ao reativar colaborador.');
    },
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reativar Vínculo Empregatício">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="p-6 space-y-4 text-xs"
      >
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300 leading-relaxed">
          Você está reativando o colaborador <strong>{employeeName}</strong>. O vínculo de emprego
          será restabelecido. Por segurança, o acesso ao aplicativo permanecerá bloqueado até ser
          habilitado manualmente.
        </div>

        <div>
          <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
            Data de Reativação *
          </label>
          <input
            type="date"
            required
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
          />
        </div>

        <div>
          <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
            Observações da Reativação
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Detalhes ou anotação sobre a reativação..."
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 font-semibold text-white disabled:opacity-50"
          >
            {mutation.isPending ? 'Reativando...' : 'Confirmar Reativação'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AssignRoleModal({
  isOpen,
  onClose,
  employeeId,
  roles,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  roles: JobRoleDto[];
  onSuccess: () => void;
}): React.JSX.Element {
  const api = useApiClient();
  const { success, error: toastError } = useToast();

  const [jobRoleId, setJobRoleId] = useState(roles[0]?.id ?? '');
  const [startDate, setStartDate] = useState(getTodayString());
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      api.assignEmployeeRole(employeeId, {
        jobRoleId,
        startDate,
        isPrincipal: true,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      success('Cargo atribuído ao colaborador com sucesso.');
      onSuccess();
    },
    onError: () => {
      toastError('Erro ao atribuir cargo.');
    },
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Atribuir Cargo ao Colaborador">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="p-6 space-y-4 text-xs"
      >
        <div>
          <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
            Selecione o Cargo *
          </label>
          <select
            required
            value={jobRoleId}
            onChange={(e) => setJobRoleId(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title} {r.department ? `(${r.department})` : ''} - v
                {r.currentVersion?.versionNumber ?? 1}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
            Data de Início no Cargo *
          </label>
          <input
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
          />
        </div>

        <div>
          <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
            Observações
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anotações sobre a atribuição do cargo..."
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={mutation.isPending || !jobRoleId}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 font-semibold text-white disabled:opacity-50"
          >
            {mutation.isPending ? 'Atribuindo...' : 'Confirmar Atribuição'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CreateEmploymentEventModal({
  isOpen,
  onClose,
  employeeId,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  onSuccess: () => void;
}): React.JSX.Element {
  const api = useApiClient();
  const { success, error: toastError } = useToast();

  const [eventType, setEventType] = useState<EmploymentEventTypeDto>('NOTE');
  const [effectiveDate, setEffectiveDate] = useState(getTodayString());
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      api.createEmploymentEvent(employeeId, {
        eventType,
        effectiveDate,
        title: title.trim(),
        description: description.trim() || undefined,
      }),
    onSuccess: () => {
      success('Evento registrado na linha do tempo com sucesso.');
      onSuccess();
    },
    onError: () => {
      toastError('Erro ao registrar evento.');
    },
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Registrar Evento ou Anotação">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="p-6 space-y-4 text-xs"
      >
        <div>
          <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
            Tipo de Registro *
          </label>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value as EmploymentEventTypeDto)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
          >
            {EVENT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
            Data de Vigência *
          </label>
          <input
            type="date"
            required
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
          />
        </div>

        <div>
          <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
            Título do Registro *
          </label>
          <input
            type="text"
            required
            placeholder="Ex.: Troca de turno acordada com a chefia"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
          />
        </div>

        <div>
          <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
            Descrição / Detalhes
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descreva detalhes relevantes deste evento..."
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={mutation.isPending || title.trim().length < 2}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 font-semibold text-white disabled:opacity-50"
          >
            {mutation.isPending ? 'Salvando...' : 'Salvar Registro'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EnableAccessModal({
  isOpen,
  onClose,
  employeeId,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  onSuccess: () => void;
}): React.JSX.Element {
  const api = useApiClient();
  const { success, error: toastError } = useToast();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.toggleEmployeeAccess(employeeId, true, password),
    onSuccess: () => {
      success('Acesso ao aplicativo habilitado com sucesso.');
      onSuccess();
    },
    onError: () => {
      toastError('Erro ao habilitar acesso.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setErrorMsg('A senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('As senhas digitadas não coincidem.');
      return;
    }
    setErrorMsg('');
    mutation.mutate();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Habilitar Acesso ao Aplicativo">
      <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
          Defina uma senha de acesso inicial para que o colaborador possa realizar login no
          aplicativo PH-Ponto e registrar sua frequência.
        </p>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
            {errorMsg}
          </div>
        )}

        <div>
          <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
            Senha de Acesso (mínimo 8 caracteres) *
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
          />
        </div>

        <div>
          <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
            Confirmar Senha *
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 font-semibold text-white disabled:opacity-50"
          >
            {mutation.isPending ? 'Habilitando...' : 'Habilitar Acesso'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({
  isOpen,
  onClose,
  employeeId,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  onSuccess: () => void;
}): React.JSX.Element {
  const api = useApiClient();
  const { success, error: toastError } = useToast();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.resetEmployeePassword(employeeId, password),
    onSuccess: () => {
      success('Senha redefinida com sucesso. Sessões ativas foram encerradas.');
      onSuccess();
    },
    onError: () => {
      toastError('Erro ao redefinir senha.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setErrorMsg('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('As senhas digitadas não coincidem.');
      return;
    }
    setErrorMsg('');
    mutation.mutate();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Redefinir Senha do Colaborador">
      <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
          Defina uma nova senha para o colaborador. Por segurança, todas as sessões ativas deste
          colaborador serão imediatamente revogadas.
        </p>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
            {errorMsg}
          </div>
        )}

        <div>
          <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
            Nova Senha (mínimo 8 caracteres) *
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
          />
        </div>

        <div>
          <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
            Confirmar Nova Senha *
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 font-semibold text-white disabled:opacity-50"
          >
            {mutation.isPending ? 'Redefinindo...' : 'Salvar Nova Senha'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
