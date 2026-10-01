import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  FileText,
  Filter,
  History,
  Info,
  RefreshCw,
  Scale,
  ShieldAlert,
  X,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

import type {
  DisciplinaryActionDto,
  DisciplinaryProgressionSummaryDto,
  DisciplinaryWitnessDto,
  DisciplineSuspensionPayloadDto,
  DisciplineVerbalPayloadDto,
  DisciplineWrittenPayloadDto,
  DocumentDraftDto,
  DocumentTypeDto,
} from '../../api/contracts.js';
import { useAuth } from '../../auth/use-auth.js';
import { useToast } from '../../components/toast-context.js';
import { SelectInput } from '../../components/select-input.js';
import { formatDisplayName } from '../../lib/format.js';

export function DisciplineDocumentPage(): React.JSX.Element {
  const { session, api } = useAuth();
  const { success, error } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  // Selected document type
  const [documentType, setDocumentType] = useState<
    'DISCIPLINE_VERBAL' | 'DISCIPLINE_WRITTEN' | 'DISCIPLINE_SUSPENSION'
  >('DISCIPLINE_VERBAL');

  // Selected employee
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(
    searchParams.get('employeeId') ?? '',
  );

  // Form states
  const [incidentDate, setIncidentDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState<string>('Sede da PH Motopeças');
  const [reason, setReason] = useState<string>('');
  const [details, setDetails] = useState<string>('');
  const [internalClauseRef, setInternalClauseRef] = useState<string>('');
  const [priorActionId, setPriorActionId] = useState<string>('');

  // Verbal specific
  const [commitment, setCommitment] = useState<string>('');

  // Written specific
  const [legalBasisRefWritten, setLegalBasisRefWritten] = useState<string>('Artigo 482 da CLT');
  const [consequencesNoteWritten, setConsequencesNoteWritten] = useState<string>(
    'A reincidência na mesma conduta ou descumprimento funcional ensejará a aplicação de Suspensão Disciplinar ou Demissão por Justa Causa.',
  );

  // Suspension specific
  const [suspensionDays, setSuspensionDays] = useState<number>(1);
  const [suspensionStartDate, setSuspensionStartDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [suspensionEndDate, setSuspensionEndDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [returnDate, setReturnDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [legalBasisRefSuspension, setLegalBasisRefSuspension] = useState<string>(
    'Artigos 474 e 482 da CLT',
  );
  const [consequencesNoteSuspension, setConsequencesNoteSuspension] = useState<string>(
    'A reiteração nesta conduta implicará a rescisão imediata do contrato de trabalho por justa causa (art. 482 da CLT).',
  );

  // Witnesses
  const [witness1Name, setWitness1Name] = useState<string>('');
  const [witness1Cpf, setWitness1Cpf] = useState<string>('');
  const [witness2Name, setWitness2Name] = useState<string>('');
  const [witness2Cpf, setWitness2Cpf] = useState<string>('');

  // Draft & Preview state
  const [activeDraft, setActiveDraft] = useState<DocumentDraftDto | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  // Void modal state
  const [voidingAction, setVoidingAction] = useState<DisciplinaryActionDto | null>(null);
  const [voidReason, setVoidReason] = useState<string>('');

  // Filter for disciplinary history table
  const [historyFilterEmployee, setHistoryFilterEmployee] = useState<string>('ALL');

  // 1. Fetch active employees
  const { data: employeesData } = useQuery({
    queryKey: ['active-employees-for-discipline'],
    queryFn: ({ signal }) => api.getEmployees({ status: 'ACTIVE', limit: 100 }, signal),
    enabled: Boolean(session),
  });

  const activeEmployees =
    employeesData?.items.filter((u) => u.role === 'EMPLOYEE' && u.isActive) ?? [];

  // Update selected employee from URL param if available
  useEffect(() => {
    const paramId = searchParams.get('employeeId');
    if (paramId && activeEmployees.some((e) => e.id === paramId)) {
      setSelectedEmployeeId(paramId);
    }
  }, [searchParams, activeEmployees]);

  // 2. Fetch employee profile & roles for details
  const { data: employeeProfile } = useQuery({
    queryKey: ['employee-profile', selectedEmployeeId],
    queryFn: ({ signal }) => api.getEmployeeProfile(selectedEmployeeId, signal),
    enabled: Boolean(selectedEmployeeId),
  });

  const { data: roleAssignments } = useQuery({
    queryKey: ['employee-role-assignments', selectedEmployeeId],
    queryFn: ({ signal }) => api.getEmployeeRoleAssignments(selectedEmployeeId, signal),
    enabled: Boolean(selectedEmployeeId),
  });

  const principalRole = roleAssignments?.find((r) => r.isPrincipal && !r.endDate);

  // 3. Fetch Progression Summary
  const { data: progressionSummary } = useQuery({
    queryKey: ['disciplinary-summary', selectedEmployeeId],
    queryFn: ({ signal }) => api.getDisciplinarySummary(selectedEmployeeId, signal),
    enabled: Boolean(selectedEmployeeId),
  });

  // 4. Fetch Employee's prior actions (for linking)
  const { data: priorActionsData } = useQuery({
    queryKey: ['disciplinary-prior-actions', selectedEmployeeId],
    queryFn: ({ signal }) =>
      api.listDisciplinaryActions({ employeeId: selectedEmployeeId, isVoid: false }, signal),
    enabled: Boolean(selectedEmployeeId),
  });

  // 5. Fetch all disciplinary actions for historical table
  const { data: allActionsData } = useQuery({
    queryKey: ['disciplinary-actions-all', historyFilterEmployee],
    queryFn: ({ signal }) =>
      api.listDisciplinaryActions(
        historyFilterEmployee !== 'ALL' ? { employeeId: historyFilterEmployee } : undefined,
        signal,
      ),
    enabled: Boolean(session),
  });

  // Cleanup preview blob
  useEffect(() => {
    return () => {
      if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
    };
  }, [previewBlobUrl]);

  // Selected employee object
  const selectedEmployee = activeEmployees.find((e) => e.id === selectedEmployeeId);

  // Build payload
  const buildPayload = ():
    | DisciplineVerbalPayloadDto
    | DisciplineWrittenPayloadDto
    | DisciplineSuspensionPayloadDto
    | null => {
    if (!selectedEmployee) return null;

    const witnesses: DisciplinaryWitnessDto[] = [];
    if (witness1Name.trim()) {
      witnesses.push({ name: witness1Name.trim(), cpf: witness1Cpf.trim() || null });
    }
    if (witness2Name.trim()) {
      witnesses.push({ name: witness2Name.trim(), cpf: witness2Cpf.trim() || null });
    }

    const common = {
      employeeId: selectedEmployee.id,
      employeeName: selectedEmployee.name,
      employeeCpf: employeeProfile?.cpf ?? null,
      employeeRole: principalRole?.roleTitle ?? null,
      incidentDate,
      location: location.trim() || null,
      reason: reason.trim(),
      details: details.trim(),
      internalClauseRef: internalClauseRef.trim() || null,
      priorActionId: priorActionId.trim() || null,
      witnesses,
    };

    if (documentType === 'DISCIPLINE_VERBAL') {
      return {
        ...common,
        commitment: commitment.trim() || null,
      } as DisciplineVerbalPayloadDto;
    }

    if (documentType === 'DISCIPLINE_WRITTEN') {
      return {
        ...common,
        legalBasisRef: legalBasisRefWritten.trim() || null,
        consequencesNote: consequencesNoteWritten.trim() || null,
      } as DisciplineWrittenPayloadDto;
    }

    return {
      ...common,
      suspensionDays,
      suspensionStartDate,
      suspensionEndDate,
      returnDate,
      legalBasisRef: legalBasisRefSuspension.trim() || null,
      consequencesNote: consequencesNoteSuspension.trim() || null,
    } as DisciplineSuspensionPayloadDto;
  };

  // Validate form client-side
  const validateForm = (): boolean => {
    const errs: string[] = [];
    if (!selectedEmployeeId) {
      errs.push('Selecione um colaborador.');
    }
    if (!incidentDate) {
      errs.push('Informe a data do ocorrido.');
    }
    if (!reason.trim() || reason.trim().length < 3) {
      errs.push('Informe o motivo ou resumo do fato (mínimo 3 caracteres).');
    }
    if (!details.trim() || details.trim().length < 10) {
      errs.push('Descreva detalhadamente os fatos e orientações (mínimo 10 caracteres).');
    }

    if (documentType === 'DISCIPLINE_SUSPENSION') {
      if (!suspensionDays || suspensionDays < 1 || suspensionDays > 30) {
        errs.push('O prazo de suspensão deve ser entre 1 e 30 dias (Art. 474 da CLT).');
      }
      if (!suspensionStartDate) {
        errs.push('Informe a data de início da suspensão.');
      }
      if (!suspensionEndDate) {
        errs.push('Informe a data de término da suspensão.');
      }
      if (!returnDate) {
        errs.push('Informe a data de retorno ao trabalho.');
      }
    }

    setFormErrors(errs);
    return errs.length === 0;
  };

  // Mutations
  const prepareMutation = useMutation({
    mutationFn: async () => {
      const payload = buildPayload();
      if (!payload) throw new Error('Dados incompletos para preparar documento.');

      let title: string;
      if (documentType === 'DISCIPLINE_VERBAL') {
        title = `Conversa Disciplinar - ${selectedEmployee?.name} (${incidentDate})`;
      } else if (documentType === 'DISCIPLINE_WRITTEN') {
        title = `Advertência Escrita - ${selectedEmployee?.name} (${incidentDate})`;
      } else {
        title = `Suspensão Disciplinar (${suspensionDays}d) - ${selectedEmployee?.name} (${incidentDate})`;
      }

      // 1. Save draft
      const savedDraft = await api.saveDraft({
        documentType: documentType as DocumentTypeDto,
        employeeId: selectedEmployeeId,
        title,
        expectedRevision: activeDraft?.revision,
        payload: payload as unknown as Record<string, unknown>,
      });

      setActiveDraft(savedDraft);

      // 2. Prepare draft (triggers HTML to PDF rendering)
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
      error(err instanceof Error ? err.message : 'Falha ao gerar prévia do documento disciplinar.');
    },
  });

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
      success('Medida disciplinar formalizada e registrada com sucesso!');
      setIsPreviewOpen(false);
      setActiveDraft(null);
      setReason('');
      setDetails('');
      setInternalClauseRef('');
      setCommitment('');
      setPriorActionId('');
      void queryClient.invalidateQueries({ queryKey: ['disciplinary-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['disciplinary-actions-all'] });
      void queryClient.invalidateQueries({ queryKey: ['disciplinary-prior-actions'] });
      void queryClient.invalidateQueries({ queryKey: ['documents-list'] });
    },
    onError: (err: unknown) => {
      error(
        err instanceof Error ? err.message : 'Falha ao confirmar e emitir a medida disciplinar.',
      );
    },
  });

  const voidMutation = useMutation({
    mutationFn: async ({ id, reasonText }: { id: string; reasonText: string }) => {
      await api.voidDisciplinaryAction(id, { reason: reasonText });
    },
    onSuccess: () => {
      success('Medida disciplinar anulada com sucesso!');
      setVoidingAction(null);
      setVoidReason('');
      void queryClient.invalidateQueries({ queryKey: ['disciplinary-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['disciplinary-actions-all'] });
      void queryClient.invalidateQueries({ queryKey: ['disciplinary-prior-actions'] });
      void queryClient.invalidateQueries({ queryKey: ['documents-list'] });
    },
    onError: (err: unknown) => {
      error(err instanceof Error ? err.message : 'Falha ao anular medida disciplinar.');
    },
  });

  const handlePreviewClick = () => {
    if (!validateForm()) return;
    void prepareMutation.mutate();
  };

  const handleOpenVoidModal = (act: DisciplinaryActionDto) => {
    setVoidingAction(act);
    setVoidReason('');
  };

  const handleConfirmVoid = () => {
    if (!voidingAction) return;
    if (!voidReason.trim() || voidReason.trim().length < 5) {
      error('A justificativa de anulação deve ter pelo menos 5 caracteres.');
      return;
    }
    voidMutation.mutate({ id: voidingAction.id, reasonText: voidReason });
  };

  const renderStageBadge = (stage: DisciplinaryProgressionSummaryDto['currentStage']) => {
    switch (stage) {
      case 'NONE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Nenhuma Medida Ativa
          </span>
        );
      case 'VERBAL_WARNING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            <Info className="w-3.5 h-3.5" />
            Advertência Verbal Ativa
          </span>
        );
      case 'WRITTEN_WARNING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-300 dark:border-orange-800">
            <AlertTriangle className="w-3.5 h-3.5" />
            Advertência Escrita Ativa
          </span>
        );
      case 'SUSPENSION':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            <ShieldAlert className="w-3.5 h-3.5" />
            Suspensão Disciplinar Ativa
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-6xl mx-auto">
      {/* Top Breadcrumb & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              to="/admin/documentos"
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Documentos
            </Link>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
              Procedimentos Disciplinares
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Procedimento e Medidas Disciplinares
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Aplicação estruturada de advertências e suspensões com progressão pedagógica, histórico
            auditado e isolamento documental.
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card: Document Type Selection */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              1. Selecione a Medida Disciplinar a Emitir
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setDocumentType('DISCIPLINE_VERBAL')}
                className={`flex flex-col p-3 rounded-lg border text-left transition-all ${
                  documentType === 'DISCIPLINE_VERBAL'
                    ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-950 dark:text-blue-200 ring-2 ring-blue-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-bold">Conversa / Verbal</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Orientação pedagógica formalizada com compromisso de melhoria.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setDocumentType('DISCIPLINE_WRITTEN')}
                className={`flex flex-col p-3 rounded-lg border text-left transition-all ${
                  documentType === 'DISCIPLINE_WRITTEN'
                    ? 'border-orange-600 bg-orange-50/70 dark:bg-orange-950/40 text-orange-950 dark:text-orange-200 ring-2 ring-orange-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  <span className="text-xs font-bold">Advertência Escrita</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Penalidade formal CLT com notificação expressa sobre reincidência.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setDocumentType('DISCIPLINE_SUSPENSION')}
                className={`flex flex-col p-3 rounded-lg border text-left transition-all ${
                  documentType === 'DISCIPLINE_SUSPENSION'
                    ? 'border-rose-600 bg-rose-50/70 dark:bg-rose-950/40 text-rose-950 dark:text-rose-200 ring-2 ring-rose-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span className="text-xs font-bold">Suspensão Disciplinar</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Afastamento temporário de 1 a 30 dias (Art. 474 da CLT).
                </p>
              </button>
            </div>
          </div>

          {/* Card: Employee Selection & Prior References */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              2. Seleção do Colaborador e Referência Anterior
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <SelectInput
                  id="employee-select"
                  label="Colaborador Envolvido"
                  required
                  placeholder="Selecione um colaborador ativo..."
                  value={selectedEmployeeId}
                  onChange={(val) => {
                    setSelectedEmployeeId(val);
                    setPriorActionId('');
                  }}
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
                <SelectInput
                  id="prior-action-select"
                  label="Medida Anterior de Referência (Opcional)"
                  placeholder="Nenhuma (ocorrência inicial ou independente)"
                  value={priorActionId}
                  onChange={setPriorActionId}
                  disabled={Boolean(
                    !selectedEmployeeId || (priorActionsData && priorActionsData.length === 0),
                  )}
                  options={[
                    { value: '', label: 'Nenhuma (ocorrência inicial ou independente)' },
                    ...(priorActionsData ?? []).map((act) => ({
                      value: act.id,
                      label: `${
                        act.actionType === 'VERBAL_WARNING'
                          ? 'Advertência Verbal'
                          : act.actionType === 'WRITTEN_WARNING'
                            ? 'Advertência Escrita'
                            : 'Suspensão'
                      } - ${act.incidentDate}: ${act.reason.slice(0, 35)}...`,
                    })),
                  ]}
                  className="w-full"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Vincula esta penalidade ao registro prévio do mesmo colaborador para comprovar
                  progressão disciplinar.
                </p>
              </div>
            </div>
          </div>

          {/* Card: Incident Details & Fact Descriptions */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              3. Dados da Ocorrência e Descrição dos Fatos
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Data do Ocorrido *
                </label>
                <input
                  type="date"
                  value={incidentDate}
                  onChange={(e) => setIncidentDate(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Local da Ocorrência
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Ex: Oficina Central, Recepção, etc."
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Motivo / Resumo do Fato *
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={200}
                placeholder="Ex: Atraso reiterado injustificado no início do expediente"
                className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Relato Detalhado dos Fatos e Orientações *
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={4}
                placeholder="Descreva de forma clara, objetiva e cronológica o fato ocorrido, horários e circunstâncias observadas..."
                className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Referência ao Regimento Interno (Cláusula / Artigo)
              </label>
              <input
                type="text"
                value={internalClauseRef}
                onChange={(e) => setInternalClauseRef(e.target.value)}
                placeholder="Ex: Artigo 5.1 (Pontualidade) ou Artigo 8 (Uso de Celular)"
                className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Verbal-specific */}
            {documentType === 'DISCIPLINE_VERBAL' && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Compromisso Assumido pelo Colaborador (Opcional)
                </label>
                <textarea
                  value={commitment}
                  onChange={(e) => setCommitment(e.target.value)}
                  rows={2}
                  placeholder="Ex: O colaborador comprometeu-se a ajustar seus horários de deslocamento a partir de amanhã..."
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {/* Written-specific */}
            {documentType === 'DISCIPLINE_WRITTEN' && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Fundamentação Legal (CLT)
                  </label>
                  <input
                    type="text"
                    value={legalBasisRefWritten}
                    onChange={(e) => setLegalBasisRefWritten(e.target.value)}
                    placeholder="Ex: Artigo 482, alínea 'e' da CLT (desídia)"
                    className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Advertência sobre Reincidência
                  </label>
                  <textarea
                    value={consequencesNoteWritten}
                    onChange={(e) => setConsequencesNoteWritten(e.target.value)}
                    rows={2}
                    className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Suspension-specific */}
            {documentType === 'DISCIPLINE_SUSPENSION' && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Dias de Suspensão *
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={suspensionDays}
                      onChange={(e) => setSuspensionDays(Number(e.target.value))}
                      className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-[10px] text-slate-400">Máx. 30 dias (CLT)</span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Início da Suspensão *
                    </label>
                    <input
                      type="date"
                      value={suspensionStartDate}
                      onChange={(e) => setSuspensionStartDate(e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Término da Suspensão *
                    </label>
                    <input
                      type="date"
                      value={suspensionEndDate}
                      onChange={(e) => setSuspensionEndDate(e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Retorno ao Trabalho *
                    </label>
                    <input
                      type="date"
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Fundamentação Legal (CLT)
                    </label>
                    <input
                      type="text"
                      value={legalBasisRefSuspension}
                      onChange={(e) => setLegalBasisRefSuspension(e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Advertência de Demissão por Justa Causa
                    </label>
                    <textarea
                      value={consequencesNoteSuspension}
                      onChange={(e) => setConsequencesNoteSuspension(e.target.value)}
                      rows={2}
                      className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Card: Witnesses */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              4. Testemunhas da Notificação (Opcional)
            </label>
            <p className="text-[11px] text-slate-500">
              Recomendado caso o colaborador se recuse a assinar o termo de ciência física.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Testemunha 1
                </span>
                <input
                  type="text"
                  placeholder="Nome completo da testemunha"
                  value={witness1Name}
                  onChange={(e) => setWitness1Name(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-slate-900 dark:text-slate-100"
                />
                <input
                  type="text"
                  placeholder="CPF da testemunha"
                  value={witness1Cpf}
                  onChange={(e) => setWitness1Cpf(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Testemunha 2
                </span>
                <input
                  type="text"
                  placeholder="Nome completo da testemunha"
                  value={witness2Name}
                  onChange={(e) => setWitness2Name(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-slate-900 dark:text-slate-100"
                />
                <input
                  type="text"
                  placeholder="CPF da testemunha"
                  value={witness2Cpf}
                  onChange={(e) => setWitness2Cpf(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          {/* Validation Errors Box */}
          {formErrors.length > 0 && (
            <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-red-800 dark:text-red-300">
                <AlertCircle className="w-4 h-4" />
                Por favor, corrija os seguintes pontos antes de prosseguir:
              </div>
              <ul className="list-disc list-inside text-xs text-red-700 dark:text-red-400 space-y-0.5">
                {formErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Bottom Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handlePreviewClick}
              disabled={prepareMutation.isPending || confirmMutation.isPending}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
            >
              {prepareMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
              Visualizar Documento (PDF)
            </button>
          </div>
        </div>

        {/* Right Column: Progressive Summary & Employee Insight */}
        <div className="space-y-6">
          {/* Card: Progression Summary Banner */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Prontuário Disciplinar
                </h3>
              </div>
              {selectedEmployee && progressionSummary && (
                <div>{renderStageBadge(progressionSummary.currentStage)}</div>
              )}
            </div>

            {selectedEmployee ? (
              progressionSummary ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200/70 dark:border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Verbais Ativas
                      </span>
                      <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                        {progressionSummary.verbalCount}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200/70 dark:border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Escritas Ativas
                      </span>
                      <span className="text-xl font-bold text-orange-600 dark:text-orange-400">
                        {progressionSummary.writtenCount}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200/70 dark:border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Suspensões
                      </span>
                      <span className="text-xl font-bold text-rose-600 dark:text-rose-400">
                        {progressionSummary.suspensionCount}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200/70 dark:border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Dias Afastado
                      </span>
                      <span className="text-xl font-bold text-rose-600 dark:text-rose-400">
                        {progressionSummary.totalSuspensionDays}d
                      </span>
                    </div>
                  </div>

                  {progressionSummary.voidedCount > 0 && (
                    <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-center text-xs text-slate-500">
                      <strong>{progressionSummary.voidedCount}</strong> medida(s) disciplinar(es)
                      anteriormente anulada(s) mantida(s) no histórico de auditoria.
                    </div>
                  )}

                  {/* Informative progression suggestion */}
                  <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 rounded-lg border border-blue-200/70 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-300 space-y-1">
                    <span className="font-semibold flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5" />
                      Próxima etapa pedagógica sugerida:
                    </span>
                    <p className="text-[11px] text-blue-800/90 dark:text-blue-300/80 leading-relaxed">
                      {progressionSummary.nextSuggestedStage === 'VERBAL_WARNING' &&
                        'Conversa formal inicial orientativa e registro de advertência verbal.'}
                      {progressionSummary.nextSuggestedStage === 'WRITTEN_WARNING' &&
                        'Advertência escrita com enquadramento legal pelo reiterado descumprimento.'}
                      {progressionSummary.nextSuggestedStage === 'SUSPENSION' &&
                        'Suspensão disciplinar temporária (1 a 30 dias) nos termos do Art. 474 da CLT.'}
                      {progressionSummary.nextSuggestedStage === 'DISMISSAL_REVIEW' &&
                        'Revisão para eventual rescisão por justa causa (Art. 482 CLT) em caso de nova infração.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center p-6 text-slate-400 text-xs">
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  Carregando resumo do colaborador...
                </div>
              )
            ) : (
              <div className="text-center py-6 text-xs text-slate-400">
                Selecione um colaborador à esquerda para carregar o histórico de progressão
                disciplinar.
              </div>
            )}
          </div>

          {/* Card: Documentary Isolation Notice */}
          <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-xs text-slate-500 space-y-2">
            <div className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-slate-400" />
              Diretrizes de Segurança e Isolamento
            </div>
            <p className="text-[11px] leading-relaxed">
              <strong>Isolamento Documental:</strong> Suspensões e advertências são registros
              estritamente documentais e probatórios. Elas <strong>nunca</strong> alteram
              automaticamente batidas de ponto ou demitem o colaborador. Qualquer desligamento exige
              ação manual expressa.
            </p>
            <p className="text-[11px] leading-relaxed">
              <strong>Assinatura Física:</strong> Este sistema gera o PDF oficial para impressão.
              Colha as assinaturas físicas do colaborador e da empresa (e testemunhas caso o
              empregado recuse o ciente).
            </p>
          </div>
        </div>
      </div>

      {/* Historical Disciplinary Actions Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs mt-8">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <History className="w-4 h-4 text-slate-500" />
              Histórico Geral de Medidas Disciplinares
            </h3>
            <p className="text-xs text-slate-500">
              Registros históricos imutáveis emitidos pela empresa. Medidas anuladas permanecem
              visíveis para conformidade jurídica.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
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

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3">Data</th>
                <th className="p-3">Colaborador</th>
                <th className="p-3">Tipo de Medida</th>
                <th className="p-3">Motivo</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {allActionsData && allActionsData.length > 0 ? (
                allActionsData.map((act) => (
                  <tr
                    key={act.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="p-3 whitespace-nowrap font-medium text-slate-900 dark:text-slate-100">
                      {act.incidentDate}
                    </td>
                    <td className="p-3 whitespace-nowrap font-medium text-slate-800 dark:text-slate-200">
                      {act.employeeName ?? 'Não informado'}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {act.actionType === 'VERBAL_WARNING' && (
                        <span className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-300 font-medium">
                          <Info className="w-3.5 h-3.5" />
                          Advertência Verbal
                        </span>
                      )}
                      {act.actionType === 'WRITTEN_WARNING' && (
                        <span className="inline-flex items-center gap-1 text-orange-700 dark:text-orange-300 font-medium">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Advertência Escrita
                        </span>
                      )}
                      {act.actionType === 'SUSPENSION' && (
                        <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-300 font-medium">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          Suspensão ({act.suspensionDays}d)
                        </span>
                      )}
                    </td>
                    <td className="p-3 max-w-xs truncate" title={act.reason}>
                      {act.reason}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {act.isVoid ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300">
                          Anulada
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                          Válida
                        </span>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap text-right space-x-2">
                      {act.generatedDocumentId && (
                        <Link
                          to={`/admin/documentos?search=${encodeURIComponent(act.reason.slice(0, 15))}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Ver PDF
                        </Link>
                      )}

                      {!act.isVoid && (
                        <button
                          type="button"
                          onClick={() => handleOpenVoidModal(act)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 transition-colors"
                        >
                          Anular
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-xs text-slate-400">
                    Nenhuma medida disciplinar registrada até o momento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
                    Prévia do Documento Disciplinar - {selectedEmployee?.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Verifique os fatos narrados e o layout antes da confirmação definitiva.
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
                  title="Prévia da Medida Disciplinar"
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
                A confirmação salvará o registro no prontuário e arquivará o PDF oficial.
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
                  Confirmar e Emitir Medida
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Void Action */}
      {voidingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Anular Medida Disciplinar
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setVoidingAction(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Você está prestes a anular a medida aplicada em{' '}
              <strong>{voidingAction.incidentDate}</strong> para{' '}
              <strong>{voidingAction.employeeName}</strong>. A anulação excluirá esta penalidade da
              progressão ativa, mas manterá o registro auditado no histórico.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Justificativa Obrigatória de Anulação *
              </label>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                rows={3}
                placeholder="Ex: Acordo em reconsideração, revisão fática ou cancelamento administrativo..."
                className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setVoidingAction(null)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmVoid}
                disabled={voidMutation.isPending}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
              >
                {voidMutation.isPending ? 'Anulando...' : 'Confirmar Anulação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
