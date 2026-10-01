import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  Award,
  CheckCircle2,
  Eye,
  FileText,
  History,
  RefreshCw,
  RotateCcw,
  Save,
  Star,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

import {
  CANONICAL_PERFORMANCE_CRITERIA,
  PERFORMANCE_CLASSIFICATION_BADGES,
  PERFORMANCE_CLASSIFICATION_DESCRIPTIONS,
  PERFORMANCE_CLASSIFICATION_LABELS,
  calculatePerformanceMean,
  type DocumentDraftDto,
  type DocumentTypeDto,
  type PerformanceCriterionScoreDto,
  type PerformanceReviewDto,
  type PerformanceReviewPayloadDto,
} from '../../api/contracts.js';
import { useAuth } from '../../auth/use-auth.js';
import { useToast } from '../../components/toast-context.js';
import { Modal } from '../../components/modal.js';
import { SelectInput } from '../../components/select-input.js';
import { formatDateBR, formatDisplayName } from '../../lib/format.js';

interface PerformanceFormData {
  evaluationPeriod: string;
  evaluationDate: string;
  evaluatorId: string;
  evaluatorName: string;
  evaluatorRole: string;
  criteriaScores: PerformanceCriterionScoreDto[];
  strengths: string;
  improvements: string;
  actionPlan: string;
  evaluatorComments: string;
  employeeComments: string;
  supersedesReviewId: string | null;
  supersessionReason: string;
}

export function PerformanceReviewPage(): React.JSX.Element {
  const { session, api } = useAuth();
  const { success, error, info } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const preselectedEmployeeId = searchParams.get('employeeId') ?? '';
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(preselectedEmployeeId);

  const initialScores: PerformanceCriterionScoreDto[] = CANONICAL_PERFORMANCE_CRITERIA.map((c) => ({
    criterionKey: c.key,
    criterionTitle: c.title,
    score: 3,
    feedback: '',
  }));

  const [form, setForm] = useState<PerformanceFormData>({
    evaluationPeriod: '1º Semestre / 2026',
    evaluationDate: new Date().toISOString().slice(0, 10),
    evaluatorId: session?.user.id ?? '',
    evaluatorName: session?.user.name ?? '',
    evaluatorRole: 'Avaliador RH',
    criteriaScores: initialScores,
    strengths: '',
    improvements: '',
    actionPlan: '',
    evaluatorComments: '',
    employeeComments: '',
    supersedesReviewId: null,
    supersessionReason: '',
  });

  const [activeDraft, setActiveDraft] = useState<DocumentDraftDto | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false);
  const [isSupersedeModalOpen, setIsSupersedeModalOpen] = useState(false);
  const [reviewToSupersede, setReviewToSupersede] = useState<PerformanceReviewDto | null>(null);
  const [manualSupersedeReason, setManualSupersedeReason] = useState('');
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [historyFilterEmployee, setHistoryFilterEmployee] = useState<string>('ALL');

  // Cleanup preview blob
  useEffect(() => {
    return () => {
      if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
    };
  }, [previewBlobUrl]);

  // Load employees
  const { data: employeesData } = useQuery({
    queryKey: ['employees-list-all'],
    queryFn: ({ signal }) => api.getEmployees({ status: 'ACTIVE', limit: 100 }, signal),
    enabled: Boolean(session),
  });

  const activeEmployees = employeesData?.items.filter((e) => e.isActive) ?? [];
  const selectedEmployee = activeEmployees.find((e) => e.id === selectedEmployeeId);

  // Load employee profile & role
  const { data: employeeProfile } = useQuery({
    queryKey: ['employee-profile', selectedEmployeeId],
    queryFn: ({ signal }) => api.getEmployeeProfile(selectedEmployeeId, signal),
    enabled: Boolean(selectedEmployeeId),
  });

  const { data: employeeRoles } = useQuery({
    queryKey: ['employee-roles', selectedEmployeeId],
    queryFn: ({ signal }) => api.getEmployeeRoleAssignments(selectedEmployeeId, signal),
    enabled: Boolean(selectedEmployeeId),
  });

  const principalRole = employeeRoles?.find((r) => r.isPrincipal && !r.endDate);

  // Load active draft for this employee
  const { data: draftData } = useQuery({
    queryKey: ['performance-draft', selectedEmployeeId],
    queryFn: ({ signal }) =>
      api.getDraft('PERFORMANCE_REVIEW', selectedEmployeeId || undefined, signal),
    enabled: Boolean(session && selectedEmployeeId),
  });

  // Populate from draft if present
  useEffect(() => {
    if (draftData) {
      setActiveDraft(draftData);
      const payload = draftData.payload as Partial<PerformanceReviewPayloadDto>;
      if (payload.criteriaScores && Array.isArray(payload.criteriaScores)) {
        setForm((prev) => ({
          ...prev,
          evaluationPeriod: payload.evaluationPeriod ?? prev.evaluationPeriod,
          evaluationDate: payload.evaluationDate ?? prev.evaluationDate,
          evaluatorName: payload.evaluatorName ?? prev.evaluatorName,
          evaluatorRole: payload.evaluatorRole ?? prev.evaluatorRole,
          criteriaScores: payload.criteriaScores ?? prev.criteriaScores,
          strengths: payload.strengths ?? '',
          improvements: payload.improvements ?? '',
          actionPlan: payload.actionPlan ?? '',
          evaluatorComments: payload.evaluatorComments ?? '',
          employeeComments: payload.employeeComments ?? '',
          supersedesReviewId: payload.supersedesReviewId ?? null,
          supersessionReason: payload.supersessionReason ?? '',
        }));
      }
    } else {
      setActiveDraft(null);
    }
  }, [draftData]);

  // Load reviews history
  const { data: reviewsHistory } = useQuery({
    queryKey: ['performance-reviews-history', historyFilterEmployee],
    queryFn: ({ signal }) =>
      api.listPerformanceReviews(
        {
          ...(historyFilterEmployee !== 'ALL' ? { employeeId: historyFilterEmployee } : {}),
          includeSuperseded: true,
        },
        signal,
      ),
    enabled: Boolean(session),
  });

  // Load candidate reviews that can be superseded for the selected employee
  const activeReviewsForEmployee =
    reviewsHistory?.filter((r) => r.employeeId === selectedEmployeeId && !r.isSuperseded) ?? [];

  // Live mean score computation
  const scoring = calculatePerformanceMean(form.criteriaScores);

  const handleScoreChange = (index: number, score: number) => {
    setForm((prev) => {
      const updated = [...prev.criteriaScores];
      if (updated[index]) {
        updated[index] = { ...updated[index], score };
      }
      return { ...prev, criteriaScores: updated };
    });
  };

  const handleFeedbackChange = (index: number, feedback: string) => {
    setForm((prev) => {
      const updated = [...prev.criteriaScores];
      if (updated[index]) {
        updated[index] = { ...updated[index], feedback };
      }
      return { ...prev, criteriaScores: updated };
    });
  };

  // Build payload
  const buildPayload = (): PerformanceReviewPayloadDto | null => {
    if (!selectedEmployee) return null;

    return {
      employeeId: selectedEmployee.id,
      employeeName: selectedEmployee.name,
      employeeCpf: employeeProfile?.cpf ?? null,
      employeeRole: principalRole?.roleTitle ?? null,
      evaluationPeriod: form.evaluationPeriod.trim(),
      evaluationDate: form.evaluationDate,
      evaluatorId: form.evaluatorId || (session?.user.id ?? ''),
      evaluatorName: form.evaluatorName.trim(),
      evaluatorRole: form.evaluatorRole.trim() || null,
      criteriaScores: form.criteriaScores,
      strengths: form.strengths.trim() || null,
      improvements: form.improvements.trim() || null,
      actionPlan: form.actionPlan.trim() || null,
      evaluatorComments: form.evaluatorComments.trim() || null,
      employeeComments: form.employeeComments.trim() || null,
      supersedesReviewId: form.supersedesReviewId || null,
      supersessionReason: form.supersessionReason.trim() || null,
    };
  };

  const validateForm = (): boolean => {
    const errs: string[] = [];
    if (!selectedEmployeeId) {
      errs.push('Selecione o colaborador a ser avaliado.');
    }
    if (!form.evaluationPeriod.trim()) {
      errs.push('Informe o período avaliado (ex: 1º Semestre / 2026).');
    }
    if (!form.evaluationDate) {
      errs.push('Informe a data da avaliação.');
    }
    if (!form.evaluatorName.trim()) {
      errs.push('Informe o nome do avaliador.');
    }
    if (form.criteriaScores.length !== 8) {
      errs.push('A avaliação deve conter exatamente 8 critérios canônicos.');
    }
    for (const c of form.criteriaScores) {
      if (c.score < 1 || c.score > 5) {
        errs.push(`A nota do critério "${c.criterionTitle}" deve ser entre 1 e 5.`);
      }
    }
    if (form.supersedesReviewId && !form.supersessionReason.trim()) {
      errs.push('Ao substituir uma avaliação anterior, informe a justificativa da revisão.');
    }

    setFormErrors(errs);
    return errs.length === 0;
  };

  // Save draft mutation
  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      const payload = buildPayload();
      if (!payload) throw new Error('Selecione um colaborador antes de salvar o rascunho.');

      const title = `Avaliação de Desempenho (${form.evaluationPeriod}) - ${selectedEmployee?.name}`;
      return api.saveDraft({
        documentType: 'PERFORMANCE_REVIEW' as DocumentTypeDto,
        employeeId: selectedEmployeeId,
        title,
        expectedRevision: activeDraft?.revision,
        payload: payload as unknown as Record<string, unknown>,
      });
    },
    onSuccess: (saved) => {
      setActiveDraft(saved);
      success('Rascunho da avaliação salvo com sucesso!');
      void queryClient.invalidateQueries({ queryKey: ['performance-draft', selectedEmployeeId] });
    },
    onError: (err: unknown) => {
      error(err instanceof Error ? err.message : 'Falha ao salvar rascunho.');
    },
  });

  // Prepare & Preview mutation
  const prepareMutation = useMutation({
    mutationFn: async () => {
      if (!validateForm()) {
        throw new Error('Por favor, corrija os erros do formulário antes de visualizar a prévia.');
      }

      const payload = buildPayload()!;
      const title = `Avaliação de Desempenho (${form.evaluationPeriod}) - ${selectedEmployee?.name}`;

      // 1. Save draft
      const savedDraft = await api.saveDraft({
        documentType: 'PERFORMANCE_REVIEW' as DocumentTypeDto,
        employeeId: selectedEmployeeId,
        title,
        expectedRevision: activeDraft?.revision,
        payload: payload as unknown as Record<string, unknown>,
      });

      setActiveDraft(savedDraft);

      // 2. Prepare draft
      const prepared = await api.prepareDraft(savedDraft.id, {
        expectedRevision: savedDraft.revision,
      });

      setActiveDraft(prepared);

      // 3. Load preview blob
      if (prepared.preparedArtifactId) {
        const blob = await api.getArtifactPreviewBlob(prepared.preparedArtifactId);
        if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
        const url = URL.createObjectURL(blob);
        setPreviewBlobUrl(url);
        setIsPreviewOpen(true);
      }
    },
    onError: (err: unknown) => {
      error(err instanceof Error ? err.message : 'Falha ao gerar prévia da avaliação.');
    },
  });

  // Confirm draft mutation
  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!activeDraft?.preparedArtifactId) {
        throw new Error('O documento precisa ser preparado e visualizado antes de confirmar.');
      }

      await api.confirmDraft(activeDraft.id, {
        expectedRevision: activeDraft.revision,
        preparedArtifactId: activeDraft.preparedArtifactId,
      });
    },
    onSuccess: () => {
      success('Avaliação de desempenho concluída e registrada com sucesso!');
      setIsPreviewOpen(false);
      setActiveDraft(null);
      setForm((prev) => ({
        ...prev,
        strengths: '',
        improvements: '',
        actionPlan: '',
        evaluatorComments: '',
        employeeComments: '',
        supersedesReviewId: null,
        supersessionReason: '',
      }));
      void queryClient.invalidateQueries({ queryKey: ['performance-draft', selectedEmployeeId] });
      void queryClient.invalidateQueries({ queryKey: ['performance-reviews-history'] });
      void queryClient.invalidateQueries({ queryKey: ['documents-list'] });
    },
    onError: (err: unknown) => {
      error(err instanceof Error ? err.message : 'Falha ao confirmar avaliação.');
    },
  });

  // Discard draft mutation
  const discardDraftMutation = useMutation({
    mutationFn: async () => {
      if (!activeDraft) return;
      await api.discardDraft(activeDraft.id);
    },
    onSuccess: () => {
      setActiveDraft(null);
      setIsDiscardConfirmOpen(false);
      info('Rascunho descartado.');
      void queryClient.invalidateQueries({ queryKey: ['performance-draft', selectedEmployeeId] });
    },
    onError: (err: unknown) => {
      error(err instanceof Error ? err.message : 'Falha ao descartar rascunho.');
    },
  });

  // Manual supersession mutation
  const supersedeMutation = useMutation({
    mutationFn: async () => {
      if (!reviewToSupersede) return;
      if (!manualSupersedeReason.trim()) {
        throw new Error('Informe o motivo da substituição da avaliação.');
      }

      await api.supersedePerformanceReview(reviewToSupersede.id, {
        reason: manualSupersedeReason.trim(),
      });
    },
    onSuccess: () => {
      success('Avaliação anterior marcada como substituída!');
      setIsSupersedeModalOpen(false);
      setReviewToSupersede(null);
      setManualSupersedeReason('');
      void queryClient.invalidateQueries({ queryKey: ['performance-reviews-history'] });
    },
    onError: (err: unknown) => {
      error(err instanceof Error ? err.message : 'Falha ao substituir avaliação.');
    },
  });

  // View historical document PDF
  const handleViewHistoricalDoc = async (review: PerformanceReviewDto) => {
    if (!review.generatedDocumentId) {
      error('Esta avaliação não possui documento gerado associado.');
      return;
    }
    try {
      const doc = await api.getDocument(review.generatedDocumentId);
      const blob = await api.getArtifactPreviewBlob(doc.artifactId);
      if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
      const url = URL.createObjectURL(blob);
      setPreviewBlobUrl(url);
      setIsPreviewOpen(true);
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : 'Falha ao abrir PDF da avaliação.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Link
            to="/admin/documentos"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Voltar ao Arquivo de Documentos"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Award className="w-7 h-7 text-blue-600 dark:text-blue-400" />
              Avaliação de Desempenho e Competências
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Formulário oficial de avaliação com 8 critérios canônicos, média determinística e
              emissão de laudo da <strong>PH Motopeças</strong>.
            </p>
          </div>
        </div>

        {activeDraft && (
          <div className="flex items-center gap-2">
            <span className="text-xs bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800 font-medium">
              Rascunho rev. {activeDraft.revision}
            </span>
            <button
              type="button"
              onClick={() => setIsDiscardConfirmOpen(true)}
              className="p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors"
              title="Descartar rascunho"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Main Grid: Form (2 cols) & Live Score Card (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form Fields */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Identification */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <UserCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              1. Identificação do Colaborador e Avaliação
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <SelectInput
                  label="Colaborador Avaliado"
                  required
                  placeholder="Selecione um colaborador..."
                  value={selectedEmployeeId}
                  onChange={setSelectedEmployeeId}
                  options={activeEmployees.map((emp) => ({
                    value: emp.id,
                    label: formatDisplayName(emp.name),
                    sublabel: `@${emp.login}`,
                  }))}
                  searchable
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Período Avaliado *
                </label>
                <input
                  type="text"
                  value={form.evaluationPeriod}
                  onChange={(e) => setForm({ ...form, evaluationPeriod: e.target.value })}
                  placeholder="Ex: 1º Semestre / 2026 ou 90 dias"
                  className="w-full text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Data da Avaliação *
                </label>
                <input
                  type="date"
                  value={form.evaluationDate}
                  onChange={(e) => setForm({ ...form, evaluationDate: e.target.value })}
                  className="w-full text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nome do Avaliador *
                </label>
                <input
                  type="text"
                  value={form.evaluatorName}
                  onChange={(e) => setForm({ ...form, evaluatorName: e.target.value })}
                  className="w-full text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Cargo / Função do Avaliador
                </label>
                <input
                  type="text"
                  value={form.evaluatorRole}
                  onChange={(e) => setForm({ ...form, evaluatorRole: e.target.value })}
                  placeholder="Ex: Gerente Geral / Diretor"
                  className="w-full text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <SelectInput
                  label="Substituir Avaliação Anterior? (Opcional)"
                  placeholder="Não substitui (Nova avaliação)"
                  value={form.supersedesReviewId ?? ''}
                  onChange={(val) =>
                    setForm({
                      ...form,
                      supersedesReviewId: val ? val : null,
                    })
                  }
                  options={[
                    { value: '', label: 'Não substitui (Nova avaliação)' },
                    ...activeReviewsForEmployee.map((rev) => ({
                      value: rev.id,
                      label: `${rev.evaluationPeriod} - Nota ${rev.meanScore.toFixed(2)} (${formatDateBR(rev.evaluationDate)})`,
                    })),
                  ]}
                  className="w-full"
                />
              </div>
            </div>

            {form.supersedesReviewId && (
              <div className="pt-2">
                <label className="block text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">
                  Justificativa da Substituição / Retificação *
                </label>
                <input
                  type="text"
                  value={form.supersessionReason}
                  onChange={(e) => setForm({ ...form, supersessionReason: e.target.value })}
                  placeholder="Ex: Retificação de nota após alinhamento de metas ou correção cadastral"
                  className="w-full text-sm rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 p-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                />
              </div>
            )}
          </div>

          {/* Section 2: The 8 Canonical Criteria */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-500" />
                  2. Critérios Canônicos de Desempenho (8 Critérios)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Atribua notas de 1 a 5 para cada competência. Todos os 8 critérios possuem peso
                  igual.
                </p>
              </div>
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-full border border-blue-200 dark:border-blue-800">
                8 Critérios Oficiais
              </span>
            </div>

            <div className="space-y-4">
              {CANONICAL_PERFORMANCE_CRITERIA.map((criterion, idx) => {
                const currentScoreObj = form.criteriaScores[idx] ?? {
                  criterionKey: criterion.key,
                  criterionTitle: criterion.title,
                  score: 3,
                  feedback: '',
                };

                return (
                  <div
                    key={criterion.key}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            {criterion.title}
                          </h3>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 pl-8">
                          {criterion.description}
                        </p>
                      </div>

                      {/* 1-5 Score selector buttons */}
                      <div className="flex items-center gap-1.5 pl-8 sm:pl-0">
                        {[1, 2, 3, 4, 5].map((val) => {
                          const isSelected = currentScoreObj.score === val;
                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() => handleScoreChange(idx, val)}
                              className={`w-9 h-9 rounded-xl font-bold text-sm transition-all flex items-center justify-center ${
                                isSelected
                                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 scale-105'
                                  : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600'
                              }`}
                              title={`Nota ${val}`}
                            >
                              {val}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Feedback note per criterion */}
                    <div className="pl-8">
                      <input
                        type="text"
                        value={currentScoreObj.feedback ?? ''}
                        onChange={(e) => handleFeedbackChange(idx, e.target.value)}
                        placeholder="Observações pontuais sobre este critério (opcional)..."
                        className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: Qualitative Diagnosis & Development */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              3. Diagnóstico Qualitativo e Plano de Desenvolvimento
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Pontos Fortes e Destaques
                </label>
                <textarea
                  rows={2}
                  value={form.strengths}
                  onChange={(e) => setForm({ ...form, strengths: e.target.value })}
                  placeholder="Ex: Alta agilidade em diagnósticos de bancada, ótimo relacionamento com a equipe e clientes..."
                  className="w-full text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Oportunidades de Melhoria
                </label>
                <textarea
                  rows={2}
                  value={form.improvements}
                  onChange={(e) => setForm({ ...form, improvements: e.target.value })}
                  placeholder="Ex: Atenção ao registro detalhado no sistema e organização das ferramentas após o expediente..."
                  className="w-full text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Plano de Ação e Metas de Desenvolvimento
                </label>
                <textarea
                  rows={2}
                  value={form.actionPlan}
                  onChange={(e) => setForm({ ...form, actionPlan: e.target.value })}
                  placeholder="Ex: Treinamento interno de catálogo eletrônico até final do próximo mês..."
                  className="w-full text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Comentários Gerais do Avaliador
                  </label>
                  <textarea
                    rows={2}
                    value={form.evaluatorComments}
                    onChange={(e) => setForm({ ...form, evaluatorComments: e.target.value })}
                    placeholder="Parecer final da gestão..."
                    className="w-full text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Comentários / Reação do Colaborador (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={form.employeeComments}
                    onChange={(e) => setForm({ ...form, employeeComments: e.target.value })}
                    placeholder="Manifestação do colaborador durante a devolutiva..."
                    className="w-full text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Mean Score Card & Actions */}
        <div className="space-y-6">
          {/* Prominent Score Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-5 sticky top-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Resultado em Tempo Real
              </h2>
              <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded font-mono">
                Média Ponderada
              </span>
            </div>

            <div className="text-center py-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60">
              <div className="text-5xl font-black text-slate-900 dark:text-white tracking-tight">
                {scoring.meanScore.toFixed(2)}
              </div>
              <div className="text-xs font-medium text-slate-400 mt-1">de 5.00 possíveis</div>

              <div className="mt-4 flex justify-center">
                <span
                  className={`inline-flex items-center px-4 py-1.5 rounded-full text-xs font-bold ${
                    PERFORMANCE_CLASSIFICATION_BADGES[scoring.classification]
                  }`}
                >
                  {scoring.classificationLabel}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed text-center">
              {PERFORMANCE_CLASSIFICATION_DESCRIPTIONS[scoring.classification]}
            </p>

            {/* Score distribution mini-bars */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Classificações Oficiais:
              </div>
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                <span>Excelente:</span>
                <span className="font-mono text-emerald-600 font-bold">4.50 a 5.00</span>
              </div>
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                <span>Bom:</span>
                <span className="font-mono text-blue-600 font-bold">3.50 a 4.49</span>
              </div>
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                <span>Regular:</span>
                <span className="font-mono text-amber-600 font-bold">2.50 a 3.49</span>
              </div>
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                <span>Precisa Melhorar:</span>
                <span className="font-mono text-rose-600 font-bold">1.00 a 2.49</span>
              </div>
            </div>

            {/* Form Errors Banner */}
            {formErrors.length > 0 && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Corrija os seguintes pontos:
                </div>
                <ul className="list-disc list-inside space-y-0.5">
                  {formErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={() => prepareMutation.mutate()}
                disabled={prepareMutation.isPending || !selectedEmployeeId}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all"
              >
                {prepareMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Gerando Prévia PDF...
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    Visualizar Documento PDF
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => saveDraftMutation.mutate()}
                disabled={saveDraftMutation.isPending || !selectedEmployeeId}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors"
              >
                {saveDraftMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Salvar Rascunho
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Historical Reviews Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Histórico de Avaliações Registradas
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Registros históricos imutáveis com rastreamento de substituições e laudos em PDF.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-semibold shrink-0">Filtrar:</span>
            <div className="w-56">
              <SelectInput
                size="sm"
                placeholder="Todos os colaboradores"
                value={historyFilterEmployee}
                onChange={setHistoryFilterEmployee}
                options={[
                  { value: 'ALL', label: 'Todos os colaboradores' },
                  ...activeEmployees.map((emp) => ({
                    value: emp.id,
                    label: formatDisplayName(emp.name),
                    sublabel: `@${emp.login}`,
                  })),
                ]}
                searchable
                className="w-full"
              />
            </div>
          </div>
        </div>

        {reviewsHistory && reviewsHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-3">Data</th>
                  <th className="py-3 px-3">Colaborador</th>
                  <th className="py-3 px-3">Período</th>
                  <th className="py-3 px-3 text-center">Nota Média</th>
                  <th className="py-3 px-3">Classificação</th>
                  <th className="py-3 px-3">Avaliador</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {reviewsHistory.map((rev) => (
                  <tr
                    key={rev.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {formatDateBR(rev.evaluationDate)}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-900 dark:text-white">
                      {rev.employeeName ?? 'Colaborador'}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                      {rev.evaluationPeriod}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-sm text-slate-900 dark:text-white font-mono">
                      {rev.meanScore.toFixed(2)}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          PERFORMANCE_CLASSIFICATION_BADGES[rev.classification]
                        }`}
                      >
                        {PERFORMANCE_CLASSIFICATION_LABELS[rev.classification].label}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                      {rev.evaluatorName ?? 'Avaliador'}
                    </td>
                    <td className="py-3 px-3">
                      {rev.isSuperseded ? (
                        <span
                          className="inline-flex items-center gap-1 text-[11px] text-amber-600 font-semibold bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800"
                          title={`Substituída em ${formatDateBR(rev.supersededAt)}: ${rev.supersessionReason ?? ''}`}
                        >
                          Substituída
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                          Vigente
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right space-x-1 whitespace-nowrap">
                      {rev.generatedDocumentId && (
                        <button
                          type="button"
                          onClick={() => handleViewHistoricalDoc(rev)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition-colors"
                          title="Visualizar laudo PDF"
                        >
                          <FileText className="w-4 h-4 inline" />
                        </button>
                      )}
                      {!rev.isSuperseded && (
                        <button
                          type="button"
                          onClick={() => {
                            setReviewToSupersede(rev);
                            setManualSupersedeReason('');
                            setIsSupersedeModalOpen(true);
                          }}
                          className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-lg transition-colors"
                          title="Marcar como substituída"
                        >
                          <RotateCcw className="w-4 h-4 inline" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-slate-400 text-xs">
            Nenhuma avaliação de desempenho registrada no histórico até o momento.
          </div>
        )}
      </div>

      {/* PDF Preview & Confirmation Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Prévia do Laudo de Avaliação de Desempenho
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedEmployee?.name} — {form.evaluationPeriod}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal PDF Viewer Body */}
            <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-2 overflow-hidden flex items-center justify-center">
              {previewBlobUrl ? (
                <iframe
                  src={previewBlobUrl}
                  title="Prévia do Laudo de Avaliação de Desempenho"
                  className="w-full h-full rounded-xl border border-slate-300 dark:border-slate-800 shadow-inner bg-white"
                />
              ) : (
                <div className="text-xs text-slate-400 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" /> Carregando prévia do laudo...
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Fechar e Continuar Editando
              </button>

              <button
                type="button"
                onClick={() => confirmMutation.mutate()}
                disabled={confirmMutation.isPending}
                className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {confirmMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Confirmando Avaliação...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Confirmar e Concluir Avaliação
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discard Draft Modal */}
      {isDiscardConfirmOpen && (
        <Modal
          isOpen={isDiscardConfirmOpen}
          onClose={() => setIsDiscardConfirmOpen(false)}
          title="Descartar Rascunho de Avaliação"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Tem certeza que deseja descartar este rascunho de avaliação? Todas as alterações não
              salvas serão perdidas permanentemente.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDiscardConfirmOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => discardDraftMutation.mutate()}
                disabled={discardDraftMutation.isPending}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl"
              >
                Descartar Rascunho
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Manual Supersede Review Modal */}
      {isSupersedeModalOpen && reviewToSupersede && (
        <Modal
          isOpen={isSupersedeModalOpen}
          onClose={() => setIsSupersedeModalOpen(false)}
          title="Marcar Avaliação como Substituída"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Você está marcando a avaliação de{' '}
              <strong>{reviewToSupersede.employeeName ?? 'Colaborador'}</strong> referente a{' '}
              <strong>{reviewToSupersede.evaluationPeriod}</strong> como substituída.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Motivo / Justificativa da Substituição *
              </label>
              <textarea
                rows={3}
                value={manualSupersedeReason}
                onChange={(e) => setManualSupersedeReason(e.target.value)}
                placeholder="Ex: Revisão solicitada após reavaliação de metas operacionais..."
                className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsSupersedeModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => supersedeMutation.mutate()}
                disabled={supersedeMutation.isPending || !manualSupersedeReason.trim()}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl disabled:opacity-50"
              >
                {supersedeMutation.isPending ? 'Salvando...' : 'Confirmar Substituição'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
