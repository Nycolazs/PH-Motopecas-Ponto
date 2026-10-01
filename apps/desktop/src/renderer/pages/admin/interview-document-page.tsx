import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  FileText,
  History,
  RefreshCw,
  Save,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import type {
  DocumentDraftDto,
  InterviewCriterionScoreDto,
  InterviewPayloadDto,
  InterviewRecommendationDto,
  SaveDocumentDraftDto,
} from '../../api/contracts.js';
import { useAuth } from '../../auth/use-auth.js';
import { useToast } from '../../components/toast-context.js';
import { SelectInput } from '../../components/select-input.js';

interface InterviewFormData {
  title: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  jobRoleId: string;
  roleTitle: string;
  interviewDate: string;
  interviewerName: string;
  criteriaScores: InterviewCriterionScoreDto[];
  generalNotes: string;
  recommendation: InterviewRecommendationDto;
}

const DEFAULT_CRITERIA: InterviewCriterionScoreDto[] = [
  { criterion: 'Pontualidade e Apresentação Pessoal', score: 4, notes: '' },
  { criterion: 'Comunicação, Clareza e Postura Profissional', score: 4, notes: '' },
  { criterion: 'Conhecimento Técnico e Experiência na Área', score: 4, notes: '' },
  { criterion: 'Experiência Específica no Setor de Motos / Peças', score: 3, notes: '' },
  { criterion: 'Trabalho em Equipe e Resolução de Problemas', score: 4, notes: '' },
  { criterion: 'Alinhamento com os Valores da PH Motopeças', score: 5, notes: '' },
];

export function InterviewDocumentPage(): React.JSX.Element {
  const { session, api } = useAuth();
  const { success, error, info } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [form, setForm] = useState<InterviewFormData>({
    title: 'Guia de Entrevista e Avaliação de Candidato',
    candidateName: '',
    candidateEmail: '',
    candidatePhone: '',
    jobRoleId: '',
    roleTitle: '',
    interviewDate: new Date().toISOString().slice(0, 10),
    interviewerName: session?.user.name ?? '',
    criteriaScores: DEFAULT_CRITERIA,
    generalNotes: '',
    recommendation: 'RECOMMENDED',
  });

  const [activeDraft, setActiveDraft] = useState<DocumentDraftDto | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [searchHistory, setSearchHistory] = useState('');

  // 1. Load active draft
  const { data: draftData, refetch: refetchDraft } = useQuery({
    queryKey: ['interview-draft'],
    queryFn: ({ signal }) => api.getDraft('INTERVIEW', undefined, signal),
    enabled: Boolean(session),
  });

  // 2. Load Job Roles
  const { data: jobRoles } = useQuery({
    queryKey: ['job-roles'],
    queryFn: ({ signal }) => api.getJobRoles(false, signal),
    enabled: Boolean(session),
  });

  // 3. Load recorded interviews history
  const { data: interviewsHistory } = useQuery({
    queryKey: ['recorded-interviews', searchHistory],
    queryFn: ({ signal }) =>
      api.getInterviews(
        {
          ...(searchHistory.trim() ? { search: searchHistory.trim() } : {}),
          limit: 20,
        },
        signal,
      ),
    enabled: Boolean(session),
  });

  // Populate from draft
  useEffect(() => {
    if (draftData) {
      setActiveDraft(draftData);
      const payload = draftData.payload as Partial<InterviewPayloadDto>;
      setForm((prev) => ({
        ...prev,
        title: draftData.title,
        candidateName: payload.candidateName ?? prev.candidateName,
        candidateEmail: payload.candidateEmail ?? '',
        candidatePhone: payload.candidatePhone ?? '',
        jobRoleId: payload.jobRoleId ?? '',
        roleTitle: payload.roleTitle ?? prev.roleTitle,
        interviewDate: payload.interviewDate ?? prev.interviewDate,
        interviewerName: payload.interviewerName ?? prev.interviewerName,
        criteriaScores:
          payload.criteriaScores && payload.criteriaScores.length > 0
            ? payload.criteriaScores
            : prev.criteriaScores,
        generalNotes: payload.generalNotes ?? '',
        recommendation: payload.recommendation ?? 'RECOMMENDED',
      }));
    }
  }, [draftData]);

  // Clean up blob URL
  useEffect(() => {
    return () => {
      if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
    };
  }, [previewBlobUrl]);

  // Client validation
  const validateForm = (): boolean => {
    const errs: string[] = [];
    if (!form.candidateName.trim() || form.candidateName.trim().length < 3) {
      errs.push('O nome do candidato deve ter pelo menos 3 caracteres.');
    }
    if (!form.roleTitle.trim()) {
      errs.push('O cargo pretendido é obrigatório.');
    }
    if (!form.interviewerName.trim() || form.interviewerName.trim().length < 3) {
      errs.push('O nome do entrevistador deve ter pelo menos 3 caracteres.');
    }
    if (!form.criteriaScores || form.criteriaScores.length === 0) {
      errs.push('Avalie pelo menos um critério na entrevista.');
    }
    setFormErrors(errs);
    return errs.length === 0;
  };

  const buildPayload = (): InterviewPayloadDto => ({
    candidateName: form.candidateName.trim(),
    candidateEmail: form.candidateEmail.trim() || null,
    candidatePhone: form.candidatePhone.trim() || null,
    jobRoleId: form.jobRoleId ? form.jobRoleId : null,
    roleTitle: form.roleTitle.trim(),
    interviewDate: form.interviewDate,
    interviewerName: form.interviewerName.trim(),
    criteriaScores: form.criteriaScores,
    generalNotes: form.generalNotes.trim() || undefined,
    recommendation: form.recommendation,
  });

  // Save Draft Mutation
  const saveMutation = useMutation({
    mutationFn: async (showToast?: boolean) => {
      const payload = buildPayload();
      const input: SaveDocumentDraftDto = {
        documentType: 'INTERVIEW',
        title: form.title.trim() || `Entrevista - ${form.candidateName || 'Candidato'}`,
        payload: payload as unknown as Record<string, unknown>,
        expectedRevision: activeDraft?.revision,
      };

      const saved = await api.saveDraft(input);
      setActiveDraft(saved);
      if (showToast ?? true) {
        success('Rascunho da entrevista salvo com sucesso!');
      }
      return saved;
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar rascunho da entrevista.';
      error(msg);
    },
  });

  // Discard Draft Mutation
  const discardMutation = useMutation({
    mutationFn: async () => {
      if (!activeDraft) return;
      await api.discardDraft(activeDraft.id);
    },
    onSuccess: () => {
      setActiveDraft(null);
      setIsDiscardConfirmOpen(false);
      info('Rascunho descartado.');
      void refetchDraft();
      setForm({
        title: 'Guia de Entrevista e Avaliação de Candidato',
        candidateName: '',
        candidateEmail: '',
        candidatePhone: '',
        jobRoleId: '',
        roleTitle: '',
        interviewDate: new Date().toISOString().slice(0, 10),
        interviewerName: session?.user.name ?? '',
        criteriaScores: DEFAULT_CRITERIA,
        generalNotes: '',
        recommendation: 'RECOMMENDED',
      });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Falha ao descartar rascunho.';
      error(msg);
    },
  });

  // Preview Mutation
  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!validateForm()) {
        throw new Error('Preencha os campos obrigatórios antes de gerar a prévia.');
      }
      const saved = await saveMutation.mutateAsync(false);
      const prepared = await api.prepareDraft(saved.id, {
        expectedRevision: saved.revision,
      });
      setActiveDraft(prepared);

      if (!prepared.preparedArtifactId) {
        throw new Error('Falha ao processar artefato do documento.');
      }

      const blob = await api.getArtifactPreviewBlob(prepared.preparedArtifactId);
      if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
      const url = URL.createObjectURL(blob);
      setPreviewBlobUrl(url);
      setIsPreviewOpen(true);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Falha ao gerar prévia da entrevista.';
      error(msg);
    },
  });

  // Confirm Mutation
  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!activeDraft?.preparedArtifactId) {
        throw new Error('O documento precisa ser pré-visualizado antes de confirmar.');
      }
      return api.confirmDraft(activeDraft.id, {
        expectedRevision: activeDraft.revision,
        preparedArtifactId: activeDraft.preparedArtifactId,
      });
    },
    onSuccess: () => {
      success('Avaliação de entrevista registrada e salva no arquivo!');
      void queryClient.invalidateQueries({ queryKey: ['interview-draft'] });
      void queryClient.invalidateQueries({ queryKey: ['recorded-interviews'] });
      setIsPreviewOpen(false);
      navigate('/admin/documentos');
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : 'Falha ao confirmar avaliação da entrevista.';
      error(msg);
    },
  });

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <Link
            to="/admin/documentos/gerar"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar aos Modelos de Documentos
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Guia de Entrevista e Seleção
            </h1>
            {activeDraft && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                Rascunho ativo
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Avalie competências técnicas, postura e alinhamento cultural de candidatos sem criar
            vínculo empregatício automático.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeDraft && (
            <button
              type="button"
              onClick={() => setIsDiscardConfirmOpen(true)}
              disabled={discardMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Descartar
            </button>
          )}

          <button
            type="button"
            onClick={() => void saveMutation.mutate(true)}
            disabled={saveMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
          >
            <Save className="w-4 h-4" />
            Salvar Rascunho
          </button>

          <button
            type="button"
            onClick={() => void previewMutation.mutate()}
            disabled={previewMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
          >
            {previewMutation.isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            Visualizar PDF
          </button>
        </div>
      </div>

      {/* Errors Banner */}
      {formErrors.length > 0 && (
        <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-300 font-medium text-sm mb-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Por favor, preencha os campos obrigatórios:
          </div>
          <ul className="list-disc list-inside space-y-1 text-xs text-red-700 dark:text-red-400">
            {formErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Form Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Candidate & Role Details */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Dados do Candidato e da Vaga
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nome Completo do Candidato *
                </label>
                <input
                  type="text"
                  value={form.candidateName}
                  onChange={(e) => setForm({ ...form, candidateName: e.target.value })}
                  placeholder="Ex: Lucas Henrique de Souza"
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  E-mail do Candidato
                </label>
                <input
                  type="email"
                  value={form.candidateEmail}
                  onChange={(e) => setForm({ ...form, candidateEmail: e.target.value })}
                  placeholder="lucas@exemplo.com"
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Telefone / WhatsApp
                </label>
                <input
                  type="text"
                  value={form.candidatePhone}
                  onChange={(e) => setForm({ ...form, candidatePhone: e.target.value })}
                  placeholder="(11) 98765-4321"
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <SelectInput
                  label="Cargo Pretendido no Catálogo"
                  placeholder="Selecione ou digite abaixo..."
                  value={form.jobRoleId}
                  onChange={(val) => {
                    const selectedRole = jobRoles?.find((r) => r.id === val);
                    setForm({
                      ...form,
                      jobRoleId: val,
                      roleTitle: selectedRole?.title ?? form.roleTitle,
                    });
                  }}
                  options={[
                    { value: '', label: 'Selecione ou digite abaixo...' },
                    ...(jobRoles ?? []).map((r) => ({
                      value: r.id,
                      label: r.title,
                      sublabel: r.department ?? undefined,
                    })),
                  ]}
                  clearable
                  searchable
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Título da Função *
                </label>
                <input
                  type="text"
                  value={form.roleTitle}
                  onChange={(e) => setForm({ ...form, roleTitle: e.target.value })}
                  placeholder="Ex: Mecânico Especialista em Injeção"
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Data da Entrevista *
                </label>
                <input
                  type="date"
                  value={form.interviewDate}
                  onChange={(e) => setForm({ ...form, interviewDate: e.target.value })}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nome do Entrevistador *
                </label>
                <input
                  type="text"
                  value={form.interviewerName}
                  onChange={(e) => setForm({ ...form, interviewerName: e.target.value })}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Criteria Evaluation Matrix */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-500" />
                  Matriz de Avaliação por Critérios (1 a 5)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  1 = Insatisfatório • 3 = Atende aos requisitos • 5 = Supera expectativas
                </p>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              {form.criteriaScores.map((item, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {idx + 1}. {item.criterion}
                    </span>

                    {/* 1-5 score buttons */}
                    <div className="flex items-center gap-1.5 self-start sm:self-auto">
                      {[1, 2, 3, 4, 5].map((scoreVal) => (
                        <button
                          key={scoreVal}
                          type="button"
                          onClick={() => {
                            const updated = [...form.criteriaScores];
                            updated[idx] = {
                              criterion: item.criterion,
                              score: scoreVal,
                              ...(item.notes ? { notes: item.notes } : {}),
                            };
                            setForm({ ...form, criteriaScores: updated });
                          }}
                          className={`w-7 h-7 rounded-md text-xs font-bold transition-all ${
                            item.score === scoreVal
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {scoreVal}
                        </button>
                      ))}
                    </div>
                  </div>

                  <input
                    type="text"
                    placeholder="Observações específicas para este critério..."
                    value={item.notes ?? ''}
                    onChange={(e) => {
                      const updated = [...form.criteriaScores];
                      updated[idx] = {
                        criterion: item.criterion,
                        score: item.score,
                        ...(e.target.value ? { notes: e.target.value } : {}),
                      };
                      setForm({ ...form, criteriaScores: updated });
                    }}
                    className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>

            {/* General Notes */}
            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Parecer Geral do Entrevistador e Síntese
              </label>
              <textarea
                rows={3}
                placeholder="Observações complementares, pretensão salarial informada, disponibilidade de início..."
                value={form.generalNotes}
                onChange={(e) => setForm({ ...form, generalNotes: e.target.value })}
                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Recommendation & History */}
        <div className="space-y-6">
          {/* Final Recommendation Box */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Parecer Final e Recomendação
            </h2>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, recommendation: 'RECOMMENDED' })}
                className={`w-full p-3 rounded-xl border text-left text-xs transition-all flex items-start gap-3 ${
                  form.recommendation === 'RECOMMENDED'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-1 ring-emerald-500'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                }`}
              >
                <ThumbsUp className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <div className="font-bold">Recomendado para Contratação</div>
                  <div className="text-2xs text-slate-500 mt-0.5">
                    Candidato atende aos requisitos técnicos e perfil da empresa.
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setForm({ ...form, recommendation: 'TALENT_POOL' })}
                className={`w-full p-3 rounded-xl border text-left text-xs transition-all flex items-start gap-3 ${
                  form.recommendation === 'TALENT_POOL'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 ring-1 ring-blue-500'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                }`}
              >
                <Users className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <div className="font-bold">Banco de Talentos</div>
                  <div className="text-2xs text-slate-500 mt-0.5">
                    Perfil interessante para futuras oportunidades na empresa.
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setForm({ ...form, recommendation: 'NOT_RECOMMENDED' })}
                className={`w-full p-3 rounded-xl border text-left text-xs transition-all flex items-start gap-3 ${
                  form.recommendation === 'NOT_RECOMMENDED'
                    ? 'border-red-500 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200 ring-1 ring-red-500'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                }`}
              >
                <ThumbsDown className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                <div>
                  <div className="font-bold">Não Recomendado</div>
                  <div className="text-2xs text-slate-500 mt-0.5">
                    Não atende às necessidades técnicas ou operacionais da vaga.
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Previous Interviews List */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" />
                Entrevistas Realizadas
              </h3>
            </div>

            <input
              type="text"
              placeholder="Buscar candidato..."
              value={searchHistory}
              onChange={(e) => setSearchHistory(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {interviewsHistory && interviewsHistory.items.length > 0 ? (
                interviewsHistory.items.map((it) => (
                  <div
                    key={it.id}
                    className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {it.candidateName}
                      </span>
                      <span
                        className={`text-2xs px-1.5 py-0.5 rounded font-medium ${
                          it.recommendation === 'RECOMMENDED'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : it.recommendation === 'TALENT_POOL'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
                              : 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300'
                        }`}
                      >
                        {it.recommendation === 'RECOMMENDED'
                          ? 'Aprovado'
                          : it.recommendation === 'TALENT_POOL'
                            ? 'Banco'
                            : 'Recusado'}
                      </span>
                    </div>
                    <div className="text-2xs text-slate-500">
                      {it.roleTitle} • {it.interviewDate}
                    </div>
                    {it.generatedDocumentId && (
                      <Link
                        to="/admin/documentos"
                        className="text-2xs text-blue-600 dark:text-blue-400 hover:underline block pt-0.5"
                      >
                        Ver Documento no Arquivo &rarr;
                      </Link>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-xs text-slate-400">
                  Nenhuma entrevista registrada.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* PDF Preview Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col w-full max-w-4xl h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Prévia do Guia de Entrevista - {form.candidateName}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Confira a formatação da avaliação antes de arquivar o documento oficial.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-2 overflow-hidden flex items-center justify-center">
              {previewBlobUrl ? (
                <iframe
                  src={previewBlobUrl}
                  title="Prévia do PDF"
                  className="w-full h-full rounded-lg border border-slate-300 dark:border-slate-800 bg-white"
                />
              ) : (
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Carregando visualizador do documento...
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
              <div className="text-xs text-slate-500">
                O registro arquiva a avaliação sem criar colaborador ativo no sistema de ponto.
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  Voltar e Editar
                </button>
                <button
                  type="button"
                  onClick={() => void confirmMutation.mutate()}
                  disabled={confirmMutation.isPending}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
                >
                  {confirmMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Confirmar e Arquivar Entrevista
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Discard Confirmation Modal */}
      {isDiscardConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Descartar Rascunho?
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Todas as informações não salvas desta avaliação serão descartadas permanentemente.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDiscardConfirmOpen(false)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void discardMutation.mutate()}
                disabled={discardMutation.isPending}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-red-600 hover:bg-red-700 text-white"
              >
                Confirmar Descarte
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
