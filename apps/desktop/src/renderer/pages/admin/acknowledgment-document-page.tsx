import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  Briefcase,
  Building2,
  CheckCircle2,
  Eye,
  FileText,
  Filter,
  History,
  RefreshCw,
  Users,
  X,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

import type {
  AcknowledgmentRegulationPayloadDto,
  AcknowledgmentRolePayloadDto,
  AcknowledgmentTypeDto,
  CompanyRegulationVersionDto,
  DocumentDraftDto,
} from '../../api/contracts.js';
import { useAuth } from '../../auth/use-auth.js';
import { useToast } from '../../components/toast-context.js';
import { SelectInput } from '../../components/select-input.js';
import { formatDisplayName } from '../../lib/format.js';

export function AcknowledgmentDocumentPage(): React.JSX.Element {
  const { session, api } = useAuth();
  const { success, error } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const tipoParam = searchParams.get('tipo');
  const initialType: AcknowledgmentTypeDto = tipoParam === 'ROLE' ? 'ROLE' : 'REGULATION';
  const [acknowledgmentType, setAcknowledgmentType] = useState<AcknowledgmentTypeDto>(initialType);

  useEffect(() => {
    const tipo = searchParams.get('tipo');
    if (tipo === 'ROLE' || tipo === 'REGULATION') {
      setAcknowledgmentType(tipo);
    }
  }, [searchParams]);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [activeDraft, setActiveDraft] = useState<DocumentDraftDto | null>(null);
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'REGULATION' | 'ROLE'>('ALL');
  const [formErrors, setFormErrors] = useState<string[]>([]);

  // 1. Compliance Status
  const { data: complianceStatus } = useQuery({
    queryKey: ['acknowledgments-status'],
    queryFn: ({ signal }) => api.getAcknowledgmentStatus(signal),
    enabled: Boolean(session),
  });

  // 2. Active Employees
  const { data: employeesData } = useQuery({
    queryKey: ['active-employees-for-ack'],
    queryFn: ({ signal }) => api.getEmployees({ status: 'ACTIVE', limit: 100 }, signal),
    enabled: Boolean(session),
  });

  const activeEmployees =
    employeesData?.items.filter((u) => u.role === 'EMPLOYEE' && u.isActive) ?? [];

  // 3. Current Regulation Version
  const { data: regulationData } = useQuery({
    queryKey: ['company-regulations'],
    queryFn: ({ signal }) => api.getRegulations(signal),
    enabled: Boolean(session),
  });

  const currentRegulation: CompanyRegulationVersionDto | null =
    regulationData?.currentVersion ?? null;

  // 4. Selected Employee Role Assignment & Profile
  const { data: roleAssignments } = useQuery({
    queryKey: ['employee-role-assignments', selectedEmployeeId],
    queryFn: ({ signal }) => api.getEmployeeRoleAssignments(selectedEmployeeId, signal),
    enabled: Boolean(selectedEmployeeId && acknowledgmentType === 'ROLE'),
  });

  const principalAssignment = roleAssignments?.find((a) => a.isPrincipal && !a.endDate) ?? null;

  const { data: employeeProfile } = useQuery({
    queryKey: ['employee-profile', selectedEmployeeId],
    queryFn: ({ signal }) => api.getEmployeeProfile(selectedEmployeeId, signal),
    enabled: Boolean(selectedEmployeeId),
  });

  // 5. Existing Acknowledgments list
  const { data: acknowledgmentsData } = useQuery({
    queryKey: ['acknowledgments-list', typeFilter],
    queryFn: ({ signal }) =>
      api.getAcknowledgments(
        {
          ...(typeFilter !== 'ALL' ? { type: typeFilter } : {}),
          limit: 50,
        },
        signal,
      ),
    enabled: Boolean(session),
  });

  // Clean up preview blob URL
  useEffect(() => {
    return () => {
      if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
    };
  }, [previewBlobUrl]);

  // Selected employee object
  const selectedEmployee = activeEmployees.find((e) => e.id === selectedEmployeeId);

  // Client validation
  const validateForm = (): boolean => {
    const errs: string[] = [];
    if (!selectedEmployeeId) {
      errs.push('Selecione um colaborador ativo.');
    }
    if (acknowledgmentType === 'REGULATION' && !currentRegulation) {
      errs.push('Não há uma versão vigente do Regimento Interno publicada na empresa.');
    }
    if (acknowledgmentType === 'ROLE' && !principalAssignment) {
      errs.push('O colaborador selecionado não possui um cargo principal ativo atribuído.');
    }
    setFormErrors(errs);
    return errs.length === 0;
  };

  // Preview Mutation
  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!validateForm() || !selectedEmployee) {
        throw new Error('Preencha os campos obrigatórios antes de gerar a prévia.');
      }

      let payload: AcknowledgmentRegulationPayloadDto | AcknowledgmentRolePayloadDto;
      let title: string;
      const docType =
        acknowledgmentType === 'REGULATION' ? 'ACKNOWLEDGMENT_REGULATION' : 'ACKNOWLEDGMENT_ROLE';

      if (acknowledgmentType === 'REGULATION') {
        if (!currentRegulation) throw new Error('Regimento não publicado.');
        title = `Termo de Ciência do Regimento Interno - ${selectedEmployee.name}`;
        payload = {
          employeeId: selectedEmployee.id,
          employeeName: selectedEmployee.name,
          employeeCpf: employeeProfile?.cpf ?? null,
          regulationVersionId: currentRegulation.id,
          regulationVersionNumber: currentRegulation.versionNumber,
          regulationTitle: currentRegulation.title,
          effectiveDate: currentRegulation.effectiveDate,
        };
      } else {
        if (!principalAssignment) throw new Error('Cargo não atribuído.');
        title = `Termo de Ciência de Cargo - ${selectedEmployee.name}`;
        payload = {
          employeeId: selectedEmployee.id,
          employeeName: selectedEmployee.name,
          employeeCpf: employeeProfile?.cpf ?? null,
          jobRoleVersionId: principalAssignment.jobRoleVersionId,
          roleTitle: principalAssignment.roleTitle,
          roleVersionNumber: principalAssignment.versionNumber,
          department: null,
          effectiveDate: principalAssignment.startDate,
        };
      }

      // Save draft first
      const saved = await api.saveDraft({
        documentType: docType,
        employeeId: selectedEmployee.id,
        title,
        payload: payload as unknown as Record<string, unknown>,
      });

      // Prepare draft
      const prepared = await api.prepareDraft(saved.id, {
        expectedRevision: saved.revision,
      });
      setActiveDraft(prepared);

      if (!prepared.preparedArtifactId) {
        throw new Error('Falha ao processar o artefato do termo de ciência.');
      }

      const blob = await api.getArtifactPreviewBlob(prepared.preparedArtifactId);
      if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
      const url = URL.createObjectURL(blob);
      setPreviewBlobUrl(url);
      setIsPreviewOpen(true);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Falha ao gerar prévia do termo de ciência.';
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
      success('Termo de ciência gerado e registrado com sucesso!');
      void queryClient.invalidateQueries({ queryKey: ['acknowledgments-status'] });
      void queryClient.invalidateQueries({ queryKey: ['acknowledgments-list'] });
      void queryClient.invalidateQueries({ queryKey: ['company-setup-status'] });
      setIsPreviewOpen(false);
      setSelectedEmployeeId('');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Falha ao confirmar o termo de ciência.';
      error(msg);
    },
  });

  const isRole = acknowledgmentType === 'ROLE';
  const pageTitle = isRole
    ? 'Termo de Ciência da Descrição de Cargo'
    : 'Termo de Ciência do Regimento Interno';
  const pageSubtitle = isRole
    ? 'Formalize a ciência das atribuições e responsabilidades do cargo atribuído ao colaborador.'
    : 'Formalize o recebimento e ciência integral do regulamento interno da PH Motopeças perante a equipe.';

  const handleSelectType = (type: AcknowledgmentTypeDto): void => {
    setAcknowledgmentType(type);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tipo', type);
    setSearchParams(nextParams, { replace: true });
    setFormErrors([]);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Top Breadcrumb & Title */}
      <div>
        <Link
          to="/admin/documentos/gerar"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar aos Modelos de Documentos
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{pageTitle}</h1>
          {complianceStatus?.isFullyCompliant && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              100% Conforme
            </span>
          )}
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{pageSubtitle}</p>
      </div>

      {/* Compliance Metrics Banner */}
      {complianceStatus && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">Colaboradores Ativos</div>
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {complianceStatus.totalActiveEmployees}
              </div>
            </div>
          </div>

          <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">Ciência do Regimento</div>
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {complianceStatus.regulationAcknowledgedCount} de{' '}
                {complianceStatus.totalActiveEmployees}
              </div>
            </div>
          </div>

          <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">Ciência de Cargo</div>
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {complianceStatus.roleAcknowledgedCount} de {complianceStatus.totalActiveEmployees}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Errors Banner */}
      {formErrors.length > 0 && (
        <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-300 font-medium text-sm mb-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Atenção para os seguintes itens:
          </div>
          <ul className="list-disc list-inside space-y-1 text-xs text-red-700 dark:text-red-400">
            {formErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Generator Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          Gerar Novo Termo de Ciência
        </h2>

        {/* Mode Toggle */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleSelectType('REGULATION')}
            className={`p-4 rounded-xl border text-left transition-all ${
              acknowledgmentType === 'REGULATION'
                ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 ring-2 ring-blue-600'
                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2.5 font-bold text-sm">
              <Building2 className="w-4 h-4 text-blue-600" />
              Termo de Ciência do Regimento Interno
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Colaborador declara ciência e cumprimento integral do regulamento vigente da empresa.
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleSelectType('ROLE')}
            className={`p-4 rounded-xl border text-left transition-all ${
              acknowledgmentType === 'ROLE'
                ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 ring-2 ring-blue-600'
                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2.5 font-bold text-sm">
              <Briefcase className="w-4 h-4 text-blue-600" />
              Termo de Ciência da Descrição de Cargo
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Colaborador recebe e assina a descrição oficial de atribuições e responsabilidades de
              sua função.
            </p>
          </button>
        </div>

        {/* Employee Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <SelectInput
              label="Colaborador Ativo"
              required
              placeholder="Selecione o colaborador..."
              value={selectedEmployeeId}
              onChange={(val) => {
                setSelectedEmployeeId(val);
                setFormErrors([]);
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
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              CPF do Colaborador
            </label>
            <input
              type="text"
              readOnly
              value={employeeProfile?.cpf || 'Não cadastrado no perfil'}
              className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400"
            />
          </div>
        </div>

        {/* Context Details based on selected mode */}
        {acknowledgmentType === 'REGULATION' ? (
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-blue-500" />
                Versão Vigente do Regimento Interno
              </span>
              {currentRegulation ? (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                  Versão {currentRegulation.versionNumber}
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  Nenhuma versão publicada
                </span>
              )}
            </div>

            {currentRegulation ? (
              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <div>Título: {currentRegulation.title}</div>
                <div>Vigência: {currentRegulation.effectiveDate}</div>
              </div>
            ) : (
              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  É necessário publicar o regimento antes de gerar termos de ciência.
                </p>
                <Link
                  to="/admin/documentos/regimento"
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  Configurar Regimento &rarr;
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-blue-500" />
                Cargo Principal Atribuído
              </span>
              {principalAssignment && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                  v{principalAssignment.versionNumber}
                </span>
              )}
            </div>

            {selectedEmployeeId ? (
              principalAssignment ? (
                <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                  <div>Cargo: {principalAssignment.roleTitle}</div>
                  <div>Atribuído em: {principalAssignment.startDate}</div>
                </div>
              ) : (
                <div className="flex items-center justify-between pt-1">
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Este colaborador não possui um cargo principal atribuído.
                  </p>
                  <Link
                    to="/admin/funcionarios"
                    className="text-xs font-semibold text-blue-600 hover:underline"
                  >
                    Atribuir Cargo &rarr;
                  </Link>
                </div>
              )
            ) : (
              <p className="text-xs text-slate-400">
                Selecione um colaborador acima para carregar o cargo atribuído.
              </p>
            )}
          </div>
        )}

        {/* Action Button */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={() => void previewMutation.mutate()}
            disabled={previewMutation.isPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
          >
            {previewMutation.isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            Visualizar Termo de Ciência (PDF)
          </button>
        </div>
      </div>

      {/* Historical Acknowledgments Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <History className="w-5 h-5 text-slate-500" />
            Histórico de Termos de Ciência Emitidos
          </h2>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="w-48">
              <SelectInput
                size="sm"
                placeholder="Todos os Tipos"
                value={typeFilter}
                onChange={(val) => setTypeFilter(val as 'ALL' | 'REGULATION' | 'ROLE')}
                options={[
                  { value: 'ALL', label: 'Todos os Tipos' },
                  { value: 'REGULATION', label: 'Regimento Interno' },
                  { value: 'ROLE', label: 'Descrição de Cargo' },
                ]}
                className="w-full"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold">
                <th className="py-2.5 px-3">Colaborador</th>
                <th className="py-2.5 px-3">Tipo de Termo</th>
                <th className="py-2.5 px-3">Data de Emissão</th>
                <th className="py-2.5 px-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {acknowledgmentsData && acknowledgmentsData.items.length > 0 ? (
                acknowledgmentsData.items.map((ack) => (
                  <tr key={ack.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-100">
                      {ack.employeeName ?? 'Colaborador'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold ${
                          ack.acknowledgmentType === 'REGULATION'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                        }`}
                      >
                        {ack.acknowledgmentType === 'REGULATION'
                          ? 'Regimento Interno'
                          : 'Descrição de Cargo'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {new Date(ack.acknowledgedAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <Link
                        to="/admin/documentos"
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Ver no Arquivo &rarr;
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">
                    Nenhum termo de ciência registrado ainda.
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
                    Prévia do Termo de Ciência - {selectedEmployee?.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Confira a formatação do termo para impressão e assinatura física.
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
                  title="Prévia do Termo"
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
                O documento será registrado no arquivo oficial e contabilizado nos indicadores de
                conformidade.
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
                  Confirmar e Registrar Termo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
