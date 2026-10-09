import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileCheck2,
  FileText,
  History,
  Plus,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../../auth/use-auth.js';
import { PageHeader, headerButton } from '../../components/page-header.js';
import { useToast } from '../../components/toast-context.js';
import type {
  CulturePayloadDto,
  CultureValueDto,
  DocumentDraftDto,
  SaveDocumentDraftDto,
} from '../../api/contracts.js';

interface CultureFormValues {
  title: string;
  mission: string;
  vision: string;
  values: CultureValueDto[];
  motto: string;
}

const DEFAULT_FORM: CultureFormValues = {
  title: 'Manual de Cultura Organizacional',
  mission: '',
  vision: '',
  values: [
    { title: 'Qualidade', description: 'Compromisso com o melhor padrão em produtos e serviços.' },
    {
      title: 'Respeito',
      description: 'Ética e transparência com clientes, parceiros e colaboradores.',
    },
  ],
  motto: '',
};

export function CultureDocumentPage(): React.JSX.Element {
  const { session, api } = useAuth();
  const { success, error, info, warning } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [form, setForm] = useState<CultureFormValues>(DEFAULT_FORM);
  const [activeDraft, setActiveDraft] = useState<DocumentDraftDto | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false);

  // 1. Load active draft
  const {
    data: draftData,
    isLoading: isDraftLoading,
    refetch: refetchDraft,
  } = useQuery({
    queryKey: ['culture-draft'],
    queryFn: ({ signal }) => api.getDraft('CULTURE', undefined, signal),
    enabled: Boolean(session),
  });

  // 2. Load published culture profile & history
  const { data: cultureProfile, isLoading: isCultureLoading } = useQuery({
    queryKey: ['culture-profile'],
    queryFn: ({ signal }) => api.getCulture(signal),
    enabled: Boolean(session),
  });

  // Populate form from draft or latest published version
  useEffect(() => {
    if (draftData) {
      setActiveDraft(draftData);
      const payload = draftData.payload as Partial<CulturePayloadDto>;
      setForm({
        title: draftData.title,
        mission: payload.mission ?? '',
        vision: payload.vision ?? '',
        values: payload.values && payload.values.length > 0 ? payload.values : DEFAULT_FORM.values,
        motto: payload.motto ?? '',
      });
    } else if (cultureProfile?.currentVersion && !activeDraft) {
      const v = cultureProfile.currentVersion;
      setForm({
        title: 'Manual de Cultura Organizacional',
        mission: v.mission,
        vision: v.vision,
        values: v.values.length > 0 ? v.values : DEFAULT_FORM.values,
        motto: v.motto ?? '',
      });
    }
  }, [draftData, cultureProfile]);

  // Clean up preview blob URL on unmount
  useEffect(() => {
    return () => {
      if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
    };
  }, [previewBlobUrl]);

  // Save Draft Mutation
  const saveMutation = useMutation({
    mutationFn: async (showToast?: boolean) => {
      const shouldToast = showToast ?? true;
      const payload: CulturePayloadDto = {
        mission: form.mission.trim(),
        vision: form.vision.trim(),
        values: form.values.map((v) => ({
          title: v.title.trim(),
          description: v.description.trim(),
        })),
        motto: form.motto.trim() || null,
      };

      const input: SaveDocumentDraftDto = {
        documentType: 'CULTURE',
        title: form.title.trim() || 'Manual de Cultura Organizacional',
        payload: payload as unknown as Record<string, unknown>,
        expectedRevision: activeDraft?.revision,
      };

      const saved = await api.saveDraft(input);
      setActiveDraft(saved);
      if (shouldToast) {
        success('Rascunho salvo com sucesso!');
      }
      return saved;
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar rascunho.';
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
      if (cultureProfile?.currentVersion) {
        const v = cultureProfile.currentVersion;
        setForm({
          title: 'Manual de Cultura Organizacional',
          mission: v.mission,
          vision: v.vision,
          values: v.values,
          motto: v.motto ?? '',
        });
      } else {
        setForm(DEFAULT_FORM);
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Falha ao descartar rascunho.';
      error(msg);
    },
  });

  // Validate form client-side
  const validateForm = (): boolean => {
    const errs: string[] = [];
    if (!form.title.trim()) errs.push('O título do documento é obrigatório.');
    if (form.mission.trim().length < 10)
      errs.push('A missão deve conter pelo menos 10 caracteres.');
    if (form.vision.trim().length < 10) errs.push('A visão deve conter pelo menos 10 caracteres.');
    if (form.values.length === 0) errs.push('Adicione pelo menos um valor institucional.');
    form.values.forEach((v, idx) => {
      if (v.title.trim().length < 2) {
        errs.push(`O título do valor #${idx + 1} deve ter pelo menos 2 caracteres.`);
      }
      if (v.description.trim().length < 5) {
        errs.push(`A descrição do valor #${idx + 1} deve ter pelo menos 5 caracteres.`);
      }
    });
    setFormErrors(errs);
    return errs.length === 0;
  };

  // Prepare & Preview Mutation
  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!validateForm()) {
        throw new Error(
          'Por favor, preencha todos os campos obrigatórios antes de pré-visualizar.',
        );
      }

      // First save draft to ensure server has latest revision
      const savedDraft = await saveMutation.mutateAsync(false);

      // Now call prepare endpoint
      const prepared = await api.prepareDraft(savedDraft.id, {
        expectedRevision: savedDraft.revision,
      });
      setActiveDraft(prepared);

      if (!prepared.preparedArtifactId) {
        throw new Error('Não foi possível gerar a prévia do documento.');
      }

      // Fetch PDF blob
      const blob = await api.getArtifactPreviewBlob(prepared.preparedArtifactId);
      if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
      const url = URL.createObjectURL(blob);
      setPreviewBlobUrl(url);
      setIsPreviewOpen(true);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Falha ao preparar prévia do documento.';
      error(msg);
    },
  });

  // Confirm and Publish Mutation
  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!activeDraft?.preparedArtifactId) {
        throw new Error('O documento precisa ser pré-visualizado antes da confirmação.');
      }

      const generated = await api.confirmDraft(activeDraft.id, {
        expectedRevision: activeDraft.revision,
        preparedArtifactId: activeDraft.preparedArtifactId,
      });

      return generated;
    },
    onSuccess: (generated) => {
      success(`Manual de Cultura v${generated.version} publicado com sucesso!`);
      void queryClient.invalidateQueries({ queryKey: ['culture-draft'] });
      void queryClient.invalidateQueries({ queryKey: ['culture-profile'] });
      void queryClient.invalidateQueries({ queryKey: ['company-setup-status'] });
      setIsPreviewOpen(false);
      navigate('/admin/documentos');
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : 'Falha ao confirmar publicação do documento.';
      error(msg);
    },
  });

  const handleAddValue = (): void => {
    if (form.values.length >= 10) {
      warning('O limite é de 10 valores institucionais.');
      return;
    }
    setForm((prev) => ({
      ...prev,
      values: [...prev.values, { title: '', description: '' }],
    }));
  };

  const handleRemoveValue = (index: number): void => {
    if (form.values.length <= 1) {
      warning('É obrigatório ter pelo menos 1 valor institucional.');
      return;
    }
    setForm((prev) => ({
      ...prev,
      values: prev.values.filter((_, i) => i !== index),
    }));
  };

  const handleValueChange = (
    index: number,
    field: 'title' | 'description',
    value: string,
  ): void => {
    setForm((prev) => {
      const nextValues = [...prev.values];
      const cur = nextValues[index];
      if (cur) {
        nextValues[index] = { ...cur, [field]: value };
      }
      return { ...prev, values: nextValues };
    });
  };

  const isLoading = isDraftLoading || isCultureLoading;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Manual de Cultura"
        icon={Sparkles}
        backTo="/admin/documentos/gerar"
        backLabel="Documentos & RH"
        description="Missão, visão e valores da PH Motopeças. Ao publicar, uma nova versão do documento é gerada."
        badges={
          cultureProfile?.currentVersion ? (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              Versão {cultureProfile.currentVersion.versionNumber} publicada
            </span>
          ) : (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
              Não publicado
            </span>
          )
        }
        actions={
          <>
            {cultureProfile?.versions && cultureProfile.versions.length > 0 ? (
              <button
                type="button"
                onClick={() => setIsHistoryOpen(true)}
                className={headerButton.secondary}
              >
                <History className="h-4 w-4" aria-hidden="true" />
                Histórico ({cultureProfile.versions.length})
              </button>
            ) : null}
            {activeDraft ? (
              <button
                type="button"
                onClick={() => setIsDiscardConfirmOpen(true)}
                className={headerButton.danger}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Descartar rascunho
              </button>
            ) : null}
          </>
        }
      />

      {/* Draft Notification Badge */}
      {activeDraft ? (
        <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-center justify-between text-xs text-blue-800 dark:text-blue-300">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>
              Você está editando um rascunho salvo (Revisão {activeDraft.revision}).
              {activeDraft.preparedArtifactId
                ? ' Prévia já preparada e pronta para confirmação.'
                : ''}
            </span>
          </div>
          <span className="text-[11px] text-blue-600 dark:text-blue-400">
            Última alteração: {new Date(activeDraft.updatedAt).toLocaleTimeString('pt-BR')}
          </span>
        </div>
      ) : null}

      {/* Validation Errors Box */}
      {formErrors.length > 0 ? (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs space-y-1">
          <div className="font-semibold flex items-center gap-1.5 mb-1">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            Corrija os seguintes campos para prosseguir:
          </div>
          <ul className="list-disc list-inside space-y-0.5 ml-2">
            {formErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {isLoading ? (
        <div className="py-20 flex flex-col justify-center items-center text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mb-3 text-blue-600" />
          <span className="text-sm">Carregando dados da cultura institucional...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Main Form Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-6">
            {/* Title */}
            <div>
              <label
                htmlFor="culture-title"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Título Oficial do Documento *
              </label>
              <input
                id="culture-title"
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex: Manual de Cultura Organizacional"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Mission & Vision Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Mission */}
              <div className="space-y-1.5">
                <label
                  htmlFor="culture-mission"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                >
                  Missão Institucional *
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Qual é o propósito fundamental e a razão de ser da PH Motopeças no dia a dia?
                </p>
                <textarea
                  id="culture-mission"
                  rows={4}
                  value={form.mission}
                  onChange={(e) => setForm({ ...form, mission: e.target.value })}
                  placeholder="Ex: Fornecer peças e acessórios para motocicletas com rapidez, procedência e excelência no atendimento, garantindo a mobilidade e segurança dos nossos clientes."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Vision */}
              <div className="space-y-1.5">
                <label
                  htmlFor="culture-vision"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                >
                  Visão de Futuro *
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Onde a empresa almeja estar e qual posição deseja conquistar nos próximos anos?
                </p>
                <textarea
                  id="culture-vision"
                  rows={4}
                  value={form.vision}
                  onChange={(e) => setForm({ ...form, vision: e.target.value })}
                  placeholder="Ex: Ser a maior e mais confiável distribuidora e varejista de motopeças de Fortaleza e região, reconhecida pela velocidade de entrega e qualidade dos produtos."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Values Section */}
            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Valores e Princípios ({form.values.length}/10) *
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Comportamentos inegociáveis que orientam a conduta de toda a equipe.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddValue}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Valor
                </button>
              </div>

              <div className="space-y-3">
                {form.values.map((val, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-3 relative group"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={val.title}
                          onChange={(e) => handleValueChange(idx, 'title', e.target.value)}
                          placeholder="Título do valor (Ex: Qualidade, Agilidade, Transparência)"
                          className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      {form.values.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => handleRemoveValue(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                          title="Remover valor"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : null}
                    </div>

                    <textarea
                      rows={3}
                      value={val.description}
                      onChange={(e) => handleValueChange(idx, 'description', e.target.value)}
                      placeholder="Descreva o que este valor significa na prática cotidiana..."
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm leading-relaxed text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-y min-h-[75px]"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Motto / Slogan */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Lema ou Slogan Institucional (Opcional)
              </label>
              <input
                type="text"
                value={form.motto}
                onChange={(e) => setForm({ ...form, motto: e.target.value })}
                placeholder="Ex: Duas rodas, nossa paixão. Segurança, nosso compromisso."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Action Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void saveMutation.mutate(true)}
                disabled={saveMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                {saveMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Salvar Rascunho
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void previewMutation.mutate()}
                disabled={previewMutation.isPending}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-xs disabled:opacity-50"
              >
                {previewMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
                Visualizar Prévia em PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discard Confirmation Modal */}
      {isDiscardConfirmOpen ? (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Descartar Rascunho?
              </h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Todas as alterações não salvas ou não confirmadas no rascunho serão perdidas
              permanentemente. Deseja continuar?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDiscardConfirmOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void discardMutation.mutate()}
                disabled={discardMutation.isPending}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors disabled:opacity-50"
              >
                {discardMutation.isPending ? 'Descartando...' : 'Sim, Descartar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* PDF Preview Modal */}
      {isPreviewOpen && previewBlobUrl ? (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Pré-visualização do Documento (A4 Impresso)
                </h3>
              </div>
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* PDF View Container */}
            <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-2 overflow-hidden flex justify-center">
              <iframe
                src={previewBlobUrl}
                title="Pré-visualização do Manual de Cultura"
                className="w-full h-full rounded-lg border border-slate-300 dark:border-slate-800 shadow-inner bg-white"
              />
            </div>

            {/* Modal Footer with Confirmation */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 shrink-0 bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Revise o documento atentamente. Ao confirmar, o PDF oficial será assinado e
                  publicado no arquivo.
                </span>
              </div>

              <div className="flex items-center gap-3">
                <a
                  href={previewBlobUrl}
                  download="previa_cultura_organizacional.pdf"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Baixar Prévia
                </a>
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Voltar e Editar
                </button>
                <button
                  type="button"
                  onClick={() => void confirmMutation.mutate()}
                  disabled={confirmMutation.isPending}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-sm disabled:opacity-50"
                >
                  {confirmMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Confirmar e Publicar Documento
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* History Modal */}
      {isHistoryOpen ? (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Histórico de Versões Publicadas
                </h3>
              </div>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {cultureProfile?.versions.map((ver) => (
                <div
                  key={ver.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/40 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      Versão {ver.versionNumber}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Publicado em {new Date(ver.publishedAt).toLocaleDateString('pt-BR')} às{' '}
                      {new Date(ver.publishedAt).toLocaleTimeString('pt-BR')}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    <strong>Missão:</strong> {ver.mission}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    <strong>Visão:</strong> {ver.vision}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    <strong>Valores:</strong> {ver.values.map((v) => v.title).join(', ')}
                  </p>

                  {ver.generatedDocumentId ? (
                    <div className="pt-2 flex justify-end">
                      <Link
                        to="/admin/documentos"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Ver no Arquivo de Documentos
                      </Link>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end shrink-0 bg-slate-50 dark:bg-slate-900">
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
