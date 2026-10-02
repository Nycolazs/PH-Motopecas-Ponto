import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck2,
  FileText,
  History,
  Laptop,
  Plus,
  RefreshCw,
  Save,
  Scale,
  Shield,
  Trash2,
  X,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import type {
  CompanyDto,
  CompanyRegulationVersionDto,
  DocumentDraftDto,
  RegulationClauseDto,
  RegulationPayloadDto,
  SaveDocumentDraftDto,
} from '../../api/contracts.js';
import { useAuth } from '../../auth/use-auth.js';
import { useToast } from '../../components/toast-context.js';

interface RegulationFormData {
  title: string;
  effectiveDate: string;
  // Step 1: Empresa
  tradeName: string;
  legalName: string;
  cnpj: string;
  presentation: string;
  principles: string[];
  // Step 2: Jornada
  weeklyHours: string;
  lunchDurationMinutes: number;
  toleranceMinutes: number;
  overtimePolicy: string;
  punchRules: string;
  // Step 3: Conduta
  dressCode: string;
  customerServiceEthics: string;
  confidentiality: string;
  prohibitions: string[];
  // Step 4: Tecnologia
  internetUsage: string;
  personalDevicePolicy: string;
  companyEquipmentCare: string;
  communicationTools: string;
  // Step 5: Disciplina
  warningVerbalRules: string;
  warningWrittenRules: string;
  suspensionRules: string;
  terminationRules: string;
  progressionNotes: string;
  // Step 6: Cláusulas Adicionais
  additionalClauses: RegulationClauseDto[];
}

const DEFAULT_FORM: RegulationFormData = {
  title: 'Regimento Interno de Trabalho',
  effectiveDate: new Date().toISOString().slice(0, 10),
  // Step 1
  tradeName: '',
  legalName: '',
  cnpj: '',
  presentation:
    'A PH Motopeças é dedicada ao fornecimento de peças e serviços de excelência para motocicletas.',
  principles: [
    'Compromisso com a satisfação do cliente',
    'Segurança e qualidade em primeiro lugar',
    'Respeito e trabalho em equipe',
  ],
  // Step 2
  weeklyHours: '44 horas semanais',
  lunchDurationMinutes: 60,
  toleranceMinutes: 5,
  overtimePolicy:
    'A realização de horas suplementares deve ser previamente autorizada pela gerência imediata.',
  punchRules:
    'O registro de ponto biométrico ou eletrônico é pessoal e intransferível no início, intervalo e término da jornada.',
  // Step 3
  dressCode:
    'Uso obrigatório de uniforme limpo e equipamento de proteção individual (EPI) adequado no setor operacional.',
  customerServiceEthics:
    'Atendimento cordial, transparente e ético com todos os clientes, fornecedores e parceiros.',
  confidentiality:
    'Sigilo absoluto sobre dados cadastrais, valores de fornecedores e rotinas internas da empresa.',
  prohibitions: [
    'Fumar nas dependências internas da empresa ou oficinas',
    'Utilizar equipamentos de trabalho sem a devida qualificação ou autorização',
    'Apresentar-se ao trabalho sob efeito de substâncias ilícitas ou álcool',
  ],
  // Step 4
  internetUsage:
    'Os computadores e a rede corporativa destinam-se exclusivamente a atividades profissionais.',
  personalDevicePolicy:
    'O uso de celulares e aparelhos eletrônicos pessoais deve ser restrito aos horários de intervalo.',
  companyEquipmentCare:
    'Cada colaborador é responsável pela limpeza, organização e integridade das ferramentas sob sua guarda.',
  communicationTools:
    'Canais oficiais de comunicação (e-mail corporativo e sistemas internos) devem ser priorizados.',
  // Step 5
  warningVerbalRules:
    'Aplicável em faltas leves ou no primeiro descuido de conduta ou pontualidade, com orientação construtiva.',
  warningWrittenRules:
    'Aplicável na reincidência de faltas leves ou descumprimento formal de ordens de serviço.',
  suspensionRules:
    'Aplicável em faltas graves ou após reiteradas advertências escritas, com prejuízo salarial correspondente.',
  terminationRules:
    'Aplicável nas hipóteses legais do Artigo 482 da CLT em atos de desídia, improbidade ou insubordinação grave.',
  progressionNotes:
    'A gradação pedagógica busca a recuperação do colaborador, salvo atos gravíssimos que justifiquem rescisão imediata.',
  // Step 6
  additionalClauses: [],
};

function extractRegulationFormValues(
  version: CompanyRegulationVersionDto,
  companyData?: CompanyDto | null,
  fallback: RegulationFormData = DEFAULT_FORM,
): RegulationFormData {
  const c = (version.content ?? {}) as Record<string, unknown>;
  const companyInfo = c['companyInfo'] as Record<string, unknown> | undefined;
  const workSchedule = c['workSchedule'] as Record<string, unknown> | undefined;
  const conductEthics = c['conductEthics'] as Record<string, unknown> | undefined;
  const technologyPolicy = c['technologyPolicy'] as Record<string, unknown> | undefined;
  const disciplineRules = c['disciplineRules'] as Record<string, unknown> | undefined;
  const rawClauses = c['additionalClauses'];
  const additionalClauses: RegulationClauseDto[] = Array.isArray(rawClauses)
    ? (rawClauses as RegulationClauseDto[])
    : fallback.additionalClauses;

  return {
    ...fallback,
    title: version.title || fallback.title,
    effectiveDate: version.effectiveDate
      ? version.effectiveDate.slice(0, 10)
      : fallback.effectiveDate,
    tradeName:
      (typeof companyInfo?.['tradeName'] === 'string' && companyInfo['tradeName']) ||
      companyData?.tradeName ||
      fallback.tradeName,
    legalName:
      (typeof companyInfo?.['legalName'] === 'string' && companyInfo['legalName']) ||
      companyData?.legalName ||
      fallback.legalName,
    cnpj:
      (typeof companyInfo?.['cnpj'] === 'string' && companyInfo['cnpj']) ||
      companyData?.cnpj ||
      fallback.cnpj,
    presentation:
      (typeof companyInfo?.['presentation'] === 'string' && companyInfo['presentation']) ||
      fallback.presentation,
    principles: Array.isArray(companyInfo?.['principles'])
      ? (companyInfo['principles'] as string[])
      : typeof c['principles'] === 'string'
        ? [c['principles']]
        : fallback.principles,
    weeklyHours:
      (typeof workSchedule?.['weeklyHours'] === 'string' && workSchedule['weeklyHours']) ||
      fallback.weeklyHours,
    lunchDurationMinutes:
      typeof workSchedule?.['lunchDurationMinutes'] === 'number'
        ? workSchedule['lunchDurationMinutes']
        : fallback.lunchDurationMinutes,
    toleranceMinutes:
      typeof workSchedule?.['toleranceMinutes'] === 'number'
        ? workSchedule['toleranceMinutes']
        : fallback.toleranceMinutes,
    overtimePolicy:
      (typeof workSchedule?.['overtimePolicy'] === 'string' && workSchedule['overtimePolicy']) ||
      fallback.overtimePolicy,
    punchRules:
      (typeof workSchedule?.['punchRules'] === 'string' && workSchedule['punchRules']) ||
      (typeof c['scheduleRules'] === 'string' ? c['scheduleRules'] : fallback.punchRules),
    dressCode:
      (typeof conductEthics?.['dressCode'] === 'string' && conductEthics['dressCode']) ||
      (typeof c['conductRules'] === 'string' ? c['conductRules'] : fallback.dressCode),
    customerServiceEthics:
      (typeof conductEthics?.['customerServiceEthics'] === 'string' &&
        conductEthics['customerServiceEthics']) ||
      fallback.customerServiceEthics,
    confidentiality:
      (typeof conductEthics?.['confidentiality'] === 'string' &&
        conductEthics['confidentiality']) ||
      fallback.confidentiality,
    prohibitions: Array.isArray(conductEthics?.['prohibitions'])
      ? (conductEthics['prohibitions'] as string[])
      : fallback.prohibitions,
    internetUsage:
      (typeof technologyPolicy?.['internetUsage'] === 'string' &&
        technologyPolicy['internetUsage']) ||
      (typeof c['technologyRules'] === 'string' ? c['technologyRules'] : fallback.internetUsage),
    personalDevicePolicy:
      (typeof technologyPolicy?.['personalDevicePolicy'] === 'string' &&
        technologyPolicy['personalDevicePolicy']) ||
      fallback.personalDevicePolicy,
    companyEquipmentCare:
      (typeof technologyPolicy?.['companyEquipmentCare'] === 'string' &&
        technologyPolicy['companyEquipmentCare']) ||
      fallback.companyEquipmentCare,
    communicationTools:
      (typeof technologyPolicy?.['communicationTools'] === 'string' &&
        technologyPolicy['communicationTools']) ||
      fallback.communicationTools,
    warningVerbalRules:
      (typeof disciplineRules?.['warningVerbalRules'] === 'string' &&
        disciplineRules['warningVerbalRules']) ||
      (typeof c['disciplinaryRules'] === 'string'
        ? c['disciplinaryRules']
        : fallback.warningVerbalRules),
    warningWrittenRules:
      (typeof disciplineRules?.['warningWrittenRules'] === 'string' &&
        disciplineRules['warningWrittenRules']) ||
      fallback.warningWrittenRules,
    suspensionRules:
      (typeof disciplineRules?.['suspensionRules'] === 'string' &&
        disciplineRules['suspensionRules']) ||
      fallback.suspensionRules,
    terminationRules:
      (typeof disciplineRules?.['terminationRules'] === 'string' &&
        disciplineRules['terminationRules']) ||
      fallback.terminationRules,
    progressionNotes:
      (typeof disciplineRules?.['progressionNotes'] === 'string' &&
        disciplineRules['progressionNotes']) ||
      fallback.progressionNotes,
    additionalClauses,
  };
}

const WIZARD_STEPS = [
  { id: 1, label: '1. Empresa', icon: Building2 },
  { id: 2, label: '2. Jornada', icon: Clock },
  { id: 3, label: '3. Conduta', icon: Shield },
  { id: 4, label: '4. Tecnologia', icon: Laptop },
  { id: 5, label: '5. Disciplina', icon: Scale },
  { id: 6, label: '6. Revisão', icon: FileCheck2 },
];

export function RegulationsWizardPage(): React.JSX.Element {
  const { session, api } = useAuth();
  const { success, error, info } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState<RegulationFormData>(DEFAULT_FORM);
  const [activeDraft, setActiveDraft] = useState<DocumentDraftDto | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false);
  const [newPrincipleText, setNewPrincipleText] = useState('');
  const [newProhibitionText, setNewProhibitionText] = useState('');
  const [newClauseTitle, setNewClauseTitle] = useState('');
  const [newClauseContent, setNewClauseContent] = useState('');
  const [formErrors, setFormErrors] = useState<string[]>([]);

  // 1. Load active draft
  const { data: draftData, refetch: refetchDraft } = useQuery({
    queryKey: ['regulation-draft'],
    queryFn: ({ signal }) => api.getDraft('REGULATION', undefined, signal),
    enabled: Boolean(session),
  });

  // 2. Load published regulations & versions
  const { data: regulationData } = useQuery({
    queryKey: ['company-regulations'],
    queryFn: ({ signal }) => api.getRegulations(signal),
    enabled: Boolean(session),
  });

  // 3. Load company baseline for defaults
  const { data: companyData } = useQuery({
    queryKey: ['company-data'],
    queryFn: ({ signal }) => api.getCompany(signal),
    enabled: Boolean(session),
  });

  // Populate form
  useEffect(() => {
    if (draftData) {
      setActiveDraft(draftData);
      const payload = draftData.payload as Partial<RegulationPayloadDto>;
      setForm((prev) => ({
        ...prev,
        title: draftData.title,
        effectiveDate: payload.effectiveDate ?? prev.effectiveDate,
        tradeName: payload.companyInfo?.tradeName ?? companyData?.tradeName ?? prev.tradeName,
        legalName: payload.companyInfo?.legalName ?? companyData?.legalName ?? prev.legalName,
        cnpj: payload.companyInfo?.cnpj ?? companyData?.cnpj ?? prev.cnpj,
        presentation: payload.companyInfo?.presentation ?? prev.presentation,
        principles: payload.companyInfo?.principles ?? prev.principles,
        weeklyHours: payload.workSchedule?.weeklyHours ?? prev.weeklyHours,
        lunchDurationMinutes:
          payload.workSchedule?.lunchDurationMinutes ?? prev.lunchDurationMinutes,
        toleranceMinutes: payload.workSchedule?.toleranceMinutes ?? prev.toleranceMinutes,
        overtimePolicy: payload.workSchedule?.overtimePolicy ?? prev.overtimePolicy,
        punchRules: payload.workSchedule?.punchRules ?? prev.punchRules,
        dressCode: payload.conductEthics?.dressCode ?? prev.dressCode,
        customerServiceEthics:
          payload.conductEthics?.customerServiceEthics ?? prev.customerServiceEthics,
        confidentiality: payload.conductEthics?.confidentiality ?? prev.confidentiality,
        prohibitions: payload.conductEthics?.prohibitions ?? prev.prohibitions,
        internetUsage: payload.technologyPolicy?.internetUsage ?? prev.internetUsage,
        personalDevicePolicy:
          payload.technologyPolicy?.personalDevicePolicy ?? prev.personalDevicePolicy,
        companyEquipmentCare:
          payload.technologyPolicy?.companyEquipmentCare ?? prev.companyEquipmentCare,
        communicationTools: payload.technologyPolicy?.communicationTools ?? prev.communicationTools,
        warningVerbalRules: payload.disciplineRules?.warningVerbalRules ?? prev.warningVerbalRules,
        warningWrittenRules:
          payload.disciplineRules?.warningWrittenRules ?? prev.warningWrittenRules,
        suspensionRules: payload.disciplineRules?.suspensionRules ?? prev.suspensionRules,
        terminationRules: payload.disciplineRules?.terminationRules ?? prev.terminationRules,
        progressionNotes: payload.disciplineRules?.progressionNotes ?? prev.progressionNotes,
        additionalClauses: payload.additionalClauses ?? prev.additionalClauses,
      }));
    } else if (regulationData?.currentVersion && !activeDraft) {
      setForm((prev) =>
        extractRegulationFormValues(regulationData.currentVersion!, companyData, prev),
      );
    } else if (companyData && !activeDraft && !form.tradeName) {
      setForm((prev) => ({
        ...prev,
        tradeName: companyData.tradeName,
        legalName: companyData.legalName,
        cnpj: companyData.cnpj,
      }));
    }
  }, [draftData, regulationData, companyData]);

  // Clean up blob URL
  useEffect(() => {
    return () => {
      if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
    };
  }, [previewBlobUrl]);

  // Build payload
  const buildPayload = (): RegulationPayloadDto => {
    return {
      title: form.title.trim() || 'Regimento Interno de Trabalho',
      effectiveDate: form.effectiveDate,
      companyInfo: {
        tradeName: form.tradeName.trim(),
        legalName: form.legalName.trim(),
        cnpj: form.cnpj.trim(),
        presentation: form.presentation.trim(),
        principles: form.principles,
      },
      workSchedule: {
        weeklyHours: form.weeklyHours.trim(),
        lunchDurationMinutes: form.lunchDurationMinutes,
        toleranceMinutes: form.toleranceMinutes,
        overtimePolicy: form.overtimePolicy.trim(),
        punchRules: form.punchRules.trim(),
      },
      conductEthics: {
        dressCode: form.dressCode.trim(),
        customerServiceEthics: form.customerServiceEthics.trim(),
        confidentiality: form.confidentiality.trim(),
        prohibitions: form.prohibitions,
      },
      technologyPolicy: {
        internetUsage: form.internetUsage.trim(),
        personalDevicePolicy: form.personalDevicePolicy.trim(),
        companyEquipmentCare: form.companyEquipmentCare.trim(),
        communicationTools: form.communicationTools.trim(),
      },
      disciplineRules: {
        warningVerbalRules: form.warningVerbalRules.trim(),
        warningWrittenRules: form.warningWrittenRules.trim(),
        suspensionRules: form.suspensionRules.trim(),
        terminationRules: form.terminationRules.trim(),
        progressionNotes: form.progressionNotes.trim() || undefined,
      },
      additionalClauses: form.additionalClauses,
    };
  };

  // Save Draft Mutation
  const saveMutation = useMutation({
    mutationFn: async (showToast?: boolean) => {
      const payload = buildPayload();
      const input: SaveDocumentDraftDto = {
        documentType: 'REGULATION',
        title: form.title.trim() || 'Regimento Interno de Trabalho',
        payload: payload as unknown as Record<string, unknown>,
        expectedRevision: activeDraft?.revision,
      };

      const saved = await api.saveDraft(input);
      setActiveDraft(saved);
      if (showToast ?? true) {
        success('Rascunho do regimento salvo com sucesso!');
      }
      return saved;
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar rascunho do regimento.';
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
      if (regulationData?.currentVersion) {
        setForm((prev) =>
          extractRegulationFormValues(regulationData.currentVersion!, companyData, prev),
        );
      } else {
        setForm(DEFAULT_FORM);
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Falha ao descartar rascunho.';
      error(msg);
    },
  });

  // Client validation
  const validateForm = (): boolean => {
    const errs: string[] = [];
    if (!form.tradeName.trim()) errs.push('Nome fantasia da empresa é obrigatório.');
    if (!form.legalName.trim()) errs.push('Razão social é obrigatória.');
    if (form.cnpj.trim().length < 14) errs.push('CNPJ inválido.');
    if (form.presentation.trim().length < 10)
      errs.push('A apresentação da empresa deve ter pelo menos 10 caracteres.');
    if (!form.weeklyHours.trim()) errs.push('Carga horária semanal é obrigatória.');
    if (form.overtimePolicy.trim().length < 5)
      errs.push('A política de horas extras deve ter pelo menos 5 caracteres.');
    if (form.punchRules.trim().length < 10)
      errs.push('As regras de registro de ponto devem ter pelo menos 10 caracteres.');
    if (form.dressCode.trim().length < 5)
      errs.push('Diretrizes de apresentação e vestimenta são obrigatórias.');
    if (form.customerServiceEthics.trim().length < 5)
      errs.push('Diretrizes de atendimento e ética são obrigatórias.');
    if (form.confidentiality.trim().length < 5)
      errs.push('Diretrizes de confidencialidade são obrigatórias.');
    if (form.prohibitions.length === 0)
      errs.push('Adicione pelo menos uma proibição expressa nas regras de conduta.');
    if (form.internetUsage.trim().length < 5)
      errs.push('Política de uso da internet é obrigatória.');
    if (form.personalDevicePolicy.trim().length < 5)
      errs.push('Política de celular e dispositivos pessoais é obrigatória.');
    if (form.companyEquipmentCare.trim().length < 5)
      errs.push('Diretrizes de conservação de ferramentas são obrigatórias.');
    if (form.communicationTools.trim().length < 5)
      errs.push('Diretrizes de comunicação interna são obrigatórias.');
    if (form.warningVerbalRules.trim().length < 5)
      errs.push('Regras de advertência verbal são obrigatórias.');
    if (form.warningWrittenRules.trim().length < 5)
      errs.push('Regras de advertência escrita são obrigatórias.');
    if (form.suspensionRules.trim().length < 5)
      errs.push('Regras de suspensão disciplinar são obrigatórias.');
    if (form.terminationRules.trim().length < 5)
      errs.push('Regras de justa causa são obrigatórias.');
    setFormErrors(errs);
    return errs.length === 0;
  };

  // Preview Mutation
  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!validateForm()) {
        throw new Error('Preencha todos os campos obrigatórios antes de pré-visualizar.');
      }
      const saved = await saveMutation.mutateAsync(false);
      const prepared = await api.prepareDraft(saved.id, {
        expectedRevision: saved.revision,
      });
      setActiveDraft(prepared);

      if (!prepared.preparedArtifactId) {
        throw new Error('Falha ao processar o artefato do documento.');
      }

      const blob = await api.getArtifactPreviewBlob(prepared.preparedArtifactId);
      if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
      const url = URL.createObjectURL(blob);
      setPreviewBlobUrl(url);
      setIsPreviewOpen(true);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Falha ao gerar prévia do regimento.';
      error(msg);
    },
  });

  // Confirm Mutation
  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!activeDraft?.preparedArtifactId) {
        throw new Error('O documento precisa ser pré-visualizado antes de confirmar a publicação.');
      }
      return api.confirmDraft(activeDraft.id, {
        expectedRevision: activeDraft.revision,
        preparedArtifactId: activeDraft.preparedArtifactId,
      });
    },
    onSuccess: (generated) => {
      success(`Regimento Interno v${generated.version} publicado com sucesso!`);
      void queryClient.invalidateQueries({ queryKey: ['regulation-draft'] });
      void queryClient.invalidateQueries({ queryKey: ['company-regulations'] });
      void queryClient.invalidateQueries({ queryKey: ['company-setup-status'] });
      setIsPreviewOpen(false);
      navigate('/admin/documentos');
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : 'Falha ao confirmar publicação do regimento.';
      error(msg);
    },
  });

  return (
    <div className="p-6 sm:p-8 max-w-6xl mx-auto space-y-8">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="min-w-0">
          <Link
            to="/admin/documentos/gerar"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors mb-2.5"
          >
            <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
            Voltar aos Modelos de Documentos
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
              Regimento Interno de Trabalho
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              {activeDraft && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60 shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Rascunho ativo (Rev. {activeDraft.revision})
                </span>
              )}
              {regulationData?.currentVersion && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Versão vigente: v{regulationData.currentVersion.versionNumber}
                </span>
              )}
            </div>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
            Configure as regras institucionais, políticas de conduta e normas disciplinares em 6
            etapas.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-start xl:self-center">
          {regulationData && regulationData.versions.length > 0 && (
            <button
              type="button"
              onClick={() => setIsHistoryOpen(true)}
              className="inline-flex items-center justify-center gap-2 h-9 px-3.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap shadow-xs cursor-pointer"
            >
              <History className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
              <span>Histórico ({regulationData.versions.length})</span>
            </button>
          )}

          {activeDraft && (
            <button
              type="button"
              onClick={() => setIsDiscardConfirmOpen(true)}
              disabled={discardMutation.isPending}
              className="inline-flex items-center justify-center gap-2 h-9 px-3.5 text-xs font-semibold rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/60 dark:bg-red-950/30 hover:bg-red-100/70 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 transition-colors whitespace-nowrap shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4 shrink-0" />
              <span>Descartar</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => void saveMutation.mutate(true)}
            disabled={saveMutation.isPending}
            className="inline-flex items-center justify-center gap-2 h-9 px-4 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white transition-colors whitespace-nowrap shadow-xs cursor-pointer disabled:opacity-50"
          >
            {saveMutation.isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
            ) : (
              <Save className="w-4 h-4 shrink-0" />
            )}
            <span>Salvar Rascunho</span>
          </button>
        </div>
      </div>

      {/* Step Indicator Header */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 shadow-xs">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {WIZARD_STEPS.map((step) => {
            const Icon = step.icon;
            const isCurrent = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setCurrentStep(step.id)}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs font-semibold transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shadow-xs'
                    : isCompleted
                      ? 'text-emerald-700 dark:text-emerald-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                    isCurrent
                      ? 'bg-blue-600 text-white'
                      : isCompleted
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <Icon className="w-3 h-3" />
                  )}
                </div>
                <span className="truncate whitespace-nowrap">{step.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Errors Banner */}
      {formErrors.length > 0 && (
        <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-300 font-medium text-sm mb-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Por favor, corrija os seguintes itens antes de prosseguir:
          </div>
          <ul className="list-disc list-inside space-y-1 text-xs text-red-700 dark:text-red-400">
            {formErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Wizard Steps Content */}
      <div
        key={currentStep}
        className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6 tab-transition"
      >
        {/* Step 1: Informações da Empresa */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Etapa 1: Informações da Empresa e Princípios
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Identificação formal da empresa que estabelece as regras e compromissos
                institucionais.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nome Fantasia *
                </label>
                <input
                  type="text"
                  value={form.tradeName}
                  onChange={(e) => setForm({ ...form, tradeName: e.target.value })}
                  placeholder="Ex: PH Motopeças"
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Razão Social *
                </label>
                <input
                  type="text"
                  value={form.legalName}
                  onChange={(e) => setForm({ ...form, legalName: e.target.value })}
                  placeholder="Ex: PH MOTOPECAS LTDA"
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  CNPJ *
                </label>
                <input
                  type="text"
                  value={form.cnpj}
                  onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                  placeholder="00.000.000/0001-00"
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Apresentação Institucional da Empresa *
                </label>
                <textarea
                  rows={3}
                  value={form.presentation}
                  onChange={(e) => setForm({ ...form, presentation: e.target.value })}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Principles list */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Princípios Norteadores do Trabalho
              </label>
              <div className="space-y-2">
                {form.principles.map((principle, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  >
                    <span className="text-slate-800 dark:text-slate-200">{principle}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          principles: form.principles.filter((_, i) => i !== idx),
                        })
                      }
                      className="text-slate-400 hover:text-red-500 transition-colors ml-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    placeholder="Adicionar novo princípio norteador..."
                    value={newPrincipleText}
                    onChange={(e) => setNewPrincipleText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newPrincipleText.trim()) {
                        e.preventDefault();
                        setForm({
                          ...form,
                          principles: [...form.principles, newPrincipleText.trim()],
                        });
                        setNewPrincipleText('');
                      }
                    }}
                    className="flex-1 text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newPrincipleText.trim()) {
                        setForm({
                          ...form,
                          principles: [...form.principles, newPrincipleText.trim()],
                        });
                        setNewPrincipleText('');
                      }
                    }}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    Adicionar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Jornada e Horários */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Etapa 2: Jornada, Pontualidade e Horas Extras
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Definição dos padrões de carga horária, registro obrigatório de ponto e tolerâncias.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Carga Horária Semanal *
                </label>
                <input
                  type="text"
                  value={form.weeklyHours}
                  onChange={(e) => setForm({ ...form, weeklyHours: e.target.value })}
                  placeholder="Ex: 44 horas semanais"
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Intervalo Intrajornada (minutos) *
                </label>
                <input
                  type="number"
                  min={15}
                  max={180}
                  value={form.lunchDurationMinutes}
                  onChange={(e) =>
                    setForm({ ...form, lunchDurationMinutes: parseInt(e.target.value, 10) || 60 })
                  }
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tolerância de Ponto (minutos) *
                </label>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={form.toleranceMinutes}
                  onChange={(e) =>
                    setForm({ ...form, toleranceMinutes: parseInt(e.target.value, 10) || 0 })
                  }
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Política e Autorização de Horas Extras *
                </label>
                <textarea
                  rows={2}
                  value={form.overtimePolicy}
                  onChange={(e) => setForm({ ...form, overtimePolicy: e.target.value })}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Regras Gerais de Registro de Ponto *
                </label>
                <textarea
                  rows={3}
                  value={form.punchRules}
                  onChange={(e) => setForm({ ...form, punchRules: e.target.value })}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Código de Conduta */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Etapa 3: Conduta, Apresentação e Ética
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Normas de convivência, atendimento, confidencialidade e vedações expressas.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Apresentação Pessoal e Uso de Uniformes/EPIs *
                </label>
                <textarea
                  rows={2}
                  value={form.dressCode}
                  onChange={(e) => setForm({ ...form, dressCode: e.target.value })}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Atendimento ao Cliente e Urbanidade *
                </label>
                <textarea
                  rows={2}
                  value={form.customerServiceEthics}
                  onChange={(e) => setForm({ ...form, customerServiceEthics: e.target.value })}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Sigilo, Segredo Comercial e Confidencialidade *
                </label>
                <textarea
                  rows={2}
                  value={form.confidentiality}
                  onChange={(e) => setForm({ ...form, confidentiality: e.target.value })}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Prohibitions */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Proibições Expressas nas Instalações da Empresa *
                </label>
                <div className="space-y-2">
                  {form.prohibitions.map((p, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                    >
                      <span className="text-slate-800 dark:text-slate-200">{p}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            prohibitions: form.prohibitions.filter((_, i) => i !== idx),
                          })
                        }
                        className="text-slate-400 hover:text-red-500 transition-colors ml-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      placeholder="Adicionar nova proibição expressa..."
                      value={newProhibitionText}
                      onChange={(e) => setNewProhibitionText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newProhibitionText.trim()) {
                          e.preventDefault();
                          setForm({
                            ...form,
                            prohibitions: [...form.prohibitions, newProhibitionText.trim()],
                          });
                          setNewProhibitionText('');
                        }
                      }}
                      className="flex-1 text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newProhibitionText.trim()) {
                          setForm({
                            ...form,
                            prohibitions: [...form.prohibitions, newProhibitionText.trim()],
                          });
                          setNewProhibitionText('');
                        }
                      }}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors"
                    >
                      Adicionar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Política de Tecnologia */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Laptop className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Etapa 4: Tecnologia, Equipamentos e Celulares
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Diretrizes de uso de aparelhos pessoais, computadores corporativos e ferramentas.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Uso de Internet e Rede Corporativa *
                </label>
                <textarea
                  rows={2}
                  value={form.internetUsage}
                  onChange={(e) => setForm({ ...form, internetUsage: e.target.value })}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Uso de Aparelhos Pessoais e Celulares *
                </label>
                <textarea
                  rows={2}
                  value={form.personalDevicePolicy}
                  onChange={(e) => setForm({ ...form, personalDevicePolicy: e.target.value })}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Conservação de Ferramentas e Equipamentos *
                </label>
                <textarea
                  rows={2}
                  value={form.companyEquipmentCare}
                  onChange={(e) => setForm({ ...form, companyEquipmentCare: e.target.value })}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Canais Oficiais de Comunicação Interna *
                </label>
                <textarea
                  rows={2}
                  value={form.communicationTools}
                  onChange={(e) => setForm({ ...form, communicationTools: e.target.value })}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Medidas Disciplinares */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Scale className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Etapa 5: Medidas Disciplinares e Penalidades
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Gradação de advertências, suspensões e demissão motivada em conformidade com a CLT.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Advertência Verbal *
                </label>
                <textarea
                  rows={2}
                  value={form.warningVerbalRules}
                  onChange={(e) => setForm({ ...form, warningVerbalRules: e.target.value })}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Advertência Escrita *
                </label>
                <textarea
                  rows={2}
                  value={form.warningWrittenRules}
                  onChange={(e) => setForm({ ...form, warningWrittenRules: e.target.value })}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Suspensão Disciplinar *
                </label>
                <textarea
                  rows={2}
                  value={form.suspensionRules}
                  onChange={(e) => setForm({ ...form, suspensionRules: e.target.value })}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Demissão por Justa Causa (Art. 482 CLT) *
                </label>
                <textarea
                  rows={2}
                  value={form.terminationRules}
                  onChange={(e) => setForm({ ...form, terminationRules: e.target.value })}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Observações sobre a Gradação de Penalidades
                </label>
                <textarea
                  rows={2}
                  value={form.progressionNotes}
                  onChange={(e) => setForm({ ...form, progressionNotes: e.target.value })}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 6: Revisão e Publicação */}
        {currentStep === 6 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Etapa 6: Revisão Final e Publicação
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Adicione cláusulas complementares, revise os dados e gere a versão oficial do
                regimento.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Título do Documento *
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Data de Início de Vigência *
                </label>
                <input
                  type="date"
                  value={form.effectiveDate}
                  onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Additional clauses */}
            <div className="space-y-3 pt-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Cláusulas Adicionais Personalizadas
              </label>

              {form.additionalClauses.map((clause, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg space-y-1 relative"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                      {clause.title}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          additionalClauses: form.additionalClauses.filter((_, i) => i !== idx),
                        })
                      }
                      className="text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{clause.content}</p>
                </div>
              ))}

              <div className="p-3 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg space-y-2">
                <input
                  type="text"
                  placeholder="Título da cláusula (Ex: Da Entrega de Atestados)"
                  value={newClauseTitle}
                  onChange={(e) => setNewClauseTitle(e.target.value)}
                  className="w-full text-xs px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <textarea
                  rows={2}
                  placeholder="Conteúdo detalhado da cláusula adicional..."
                  value={newClauseContent}
                  onChange={(e) => setNewClauseContent(e.target.value)}
                  className="w-full text-xs px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newClauseTitle.trim() && newClauseContent.trim()) {
                      setForm({
                        ...form,
                        additionalClauses: [
                          ...form.additionalClauses,
                          { title: newClauseTitle.trim(), content: newClauseContent.trim() },
                        ],
                      });
                      setNewClauseTitle('');
                      setNewClauseContent('');
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-md transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Incluir Cláusula
                </button>
              </div>
            </div>

            {/* Quick Summary Cards */}
            <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Resumo dos Módulos Configurados
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                  <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-500" />
                    Empresa
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 truncate">
                    {form.tradeName || 'Não informado'}
                  </p>
                  <p className="text-slate-500 text-2xs">{form.principles.length} princípios</p>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                  <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-500" />
                    Jornada
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 truncate">{form.weeklyHours}</p>
                  <p className="text-slate-500 text-2xs">
                    {form.lunchDurationMinutes}min almoço • {form.toleranceMinutes}min tol.
                  </p>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                  <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-blue-500" />
                    Conduta & Ética
                  </div>
                  <p className="text-slate-600 dark:text-slate-400">
                    {form.prohibitions.length} proibições expressas
                  </p>
                  <p className="text-slate-500 text-2xs">Vestimenta e sigilo configurados</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Wizard Footer Navigation Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            disabled={currentStep === 1}
            onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Anterior
          </button>

          <div className="flex items-center gap-2">
            {currentStep < 6 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => Math.min(6, prev + 1))}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              >
                Próxima Etapa
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void previewMutation.mutate()}
                disabled={previewMutation.isPending}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
              >
                {previewMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
                Visualizar PDF e Publicar
              </button>
            )}
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
                    Prévia Oficial do Regimento Interno
                  </h3>
                  <p className="text-xs text-slate-500">
                    Confira a formatação antes de publicar a versão oficial.
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
                Ao publicar, uma nova versão imutável será registrada na empresa.
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
                  Confirmar e Publicar Regimento
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Version History Modal */}
      {isHistoryOpen && regulationData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col w-full max-w-xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Histórico de Versões do Regimento
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3">
              {regulationData.versions.map((ver) => (
                <div
                  key={ver.id}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                      Versão {ver.versionNumber} • {ver.title}
                    </span>
                    <span className="text-2xs text-slate-500">Vigência: {ver.effectiveDate}</span>
                  </div>
                  <div className="text-2xs text-slate-500">
                    Publicado em: {new Date(ver.publishedAt).toLocaleDateString('pt-BR')}
                  </div>
                  {ver.generatedDocumentId && (
                    <Link
                      to="/admin/documentos"
                      className="inline-flex items-center gap-1 text-2xs text-blue-600 dark:text-blue-400 hover:underline pt-1"
                    >
                      Ver no Arquivo de Documentos &rarr;
                    </Link>
                  )}
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 text-right">
              <button
                type="button"
                onClick={() => setIsHistoryOpen(false)}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300"
              >
                Fechar
              </button>
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
              Todas as alterações não publicadas serão removidas permanentemente. O formulário
              voltará ao estado da versão vigente.
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
