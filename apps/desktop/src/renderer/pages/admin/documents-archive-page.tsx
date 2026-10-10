import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  FolderArchive,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../auth/use-auth.js';
import { DocumentViewerDialog } from '../../components/document-viewer-dialog.js';
import { useToast } from '../../components/toast-context.js';
import { FeedbackPanel } from '../../components/feedback-panel.js';
import { SelectInput } from '../../components/select-input.js';
import { PageHeader, headerButton } from '../../components/page-header.js';
import { DOCUMENT_TYPE_LABELS } from '../../lib/document-types.js';
import { formatDisplayName, formatInstantDateTime } from '../../lib/format.js';
import type { DocumentTypeDto, GeneratedDocumentDto } from '../../api/contracts.js';

export function DocumentsArchivePage(): React.JSX.Element {
  const { session, api } = useAuth();
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();

  // Filters & Pagination State
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<DocumentTypeDto | ''>('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'VOID'>('ALL');

  // Preview & Void Modal State
  const [previewDoc, setPreviewDoc] = useState<GeneratedDocumentDto | null>(null);
  const [previewPdf, setPreviewPdf] = useState<{
    pdf: Blob | null;
    filename: string;
    loadError: string | null;
  }>({ pdf: null, filename: 'documento.pdf', loadError: null });

  const [docToVoid, setDocToVoid] = useState<GeneratedDocumentDto | null>(null);
  const [voidReason, setVoidReason] = useState('');

  // Download loading state by document ID
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Fetch Employees for Filter
  const { data: employeesData } = useQuery({
    queryKey: ['employees-archive-filter'],
    queryFn: ({ signal }) => api.getEmployees({ limit: 100 }, signal),
    enabled: Boolean(session),
  });

  // Fetch Documents List
  const {
    data: documentsData,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: [
      'documents-list',
      page,
      limit,
      search,
      selectedType,
      selectedEmployeeId,
      statusFilter,
    ],
    queryFn: ({ signal }) =>
      api.getDocuments(
        {
          page,
          limit,
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(selectedType ? { documentType: selectedType } : {}),
          ...(selectedEmployeeId ? { employeeId: selectedEmployeeId } : {}),
          ...(statusFilter === 'ACTIVE'
            ? { isVoid: false }
            : statusFilter === 'VOID'
              ? { isVoid: true }
              : {}),
        },
        signal,
      ),
    enabled: Boolean(session),
  });

  // Download PDF Action
  const handleDownload = async (doc: GeneratedDocumentDto): Promise<void> => {
    try {
      setDownloadingId(doc.id);
      const { blob, filename } = await api.downloadDocumentBlob(doc.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      success(`Download iniciado: ${filename}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao baixar documento.';
      toastError(msg);
    } finally {
      setDownloadingId(null);
    }
  };

  // Preview PDF Action
  const handlePreview = async (doc: GeneratedDocumentDto): Promise<void> => {
    setPreviewDoc(doc);
    setPreviewPdf({ pdf: null, filename: 'documento.pdf', loadError: null });
    try {
      const { blob, filename } = await api.downloadDocumentBlob(doc.id);
      setPreviewPdf({ pdf: blob, filename, loadError: null });
    } catch (err: unknown) {
      setPreviewPdf({
        pdf: null,
        filename: 'documento.pdf',
        loadError: err instanceof Error ? err.message : 'Falha ao carregar o documento.',
      });
    }
  };

  const handleClosePreview = (): void => {
    setPreviewDoc(null);
    setPreviewPdf({ pdf: null, filename: 'documento.pdf', loadError: null });
  };

  // Void Document Mutation
  const voidMutation = useMutation({
    mutationFn: async () => {
      if (!docToVoid) return;
      if (voidReason.trim().length < 3) {
        throw new Error('A justificativa da anulação deve ter pelo menos 3 caracteres.');
      }
      return api.voidDocument(docToVoid.id, { reason: voidReason.trim() });
    },
    onSuccess: (updated) => {
      success(`Documento "${updated?.title ?? ''}" anulado com sucesso.`);
      setDocToVoid(null);
      setVoidReason('');
      void queryClient.invalidateQueries({ queryKey: ['documents-list'] });
      void queryClient.invalidateQueries({ queryKey: ['culture-profile'] });
      void queryClient.invalidateQueries({ queryKey: ['company-setup-status'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Falha ao anular documento.';
      toastError(msg);
    },
  });

  const totalPages = documentsData?.pagination.totalPages ?? 1;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Documentos emitidos"
        icon={FolderArchive}
        backTo="/admin/documentos/gerar"
        backLabel="Documentos & RH"
        description="Todos os documentos gerados, com prévia, download e anulação. Documentos emitidos não podem ser editados."
        badges={
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
            {documentsData?.pagination.total ?? 0}{' '}
            {(documentsData?.pagination.total ?? 0) === 1 ? 'documento' : 'documentos'}
          </span>
        }
        actions={
          <Link to="/admin/documentos/gerar" className={headerButton.primary}>
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Criar documento
          </Link>
        }
      />

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs flex flex-wrap items-center gap-2.5">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar título ou colaborador..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Document Type Filter */}
        <div className="flex items-center gap-2">
          <div className="w-48">
            <SelectInput
              size="sm"
              placeholder="Todos os Tipos"
              value={selectedType}
              onChange={(val) => {
                setSelectedType(val as DocumentTypeDto | '');
                setPage(1);
              }}
              options={[
                { value: '', label: 'Todos os Tipos' },
                ...Object.entries(DOCUMENT_TYPE_LABELS).map(([k, label]) => ({
                  value: k,
                  label,
                })),
              ]}
              className="w-full"
            />
          </div>
        </div>

        {/* Employee Filter */}
        <div className="flex items-center gap-2">
          <div className="w-52">
            <SelectInput
              size="sm"
              placeholder="Todos os Colaboradores"
              value={selectedEmployeeId}
              onChange={(val) => {
                setSelectedEmployeeId(val);
                setPage(1);
              }}
              options={[
                { value: '', label: 'Todos os Colaboradores' },
                ...(employeesData?.items ?? []).map((emp) => ({
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

        {/* Status Filter */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setStatusFilter('ALL');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              statusFilter === 'ALL'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('ACTIVE');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              statusFilter === 'ACTIVE'
                ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Válidos
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('VOID');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              statusFilter === 'VOID'
                ? 'bg-white dark:bg-slate-700 text-rose-700 dark:text-rose-400 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Anulados
          </button>
        </div>

        {/* Clear Filters (if active) */}
        {(Boolean(search) ||
          Boolean(selectedType) ||
          Boolean(selectedEmployeeId) ||
          statusFilter !== 'ALL') && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setSelectedType('');
              setSelectedEmployeeId('');
              setStatusFilter('ALL');
              setPage(1);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Limpar todos os filtros"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Limpar filtros
          </button>
        )}

        {/* Refresh */}
        <button
          onClick={() => void refetch()}
          className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Atualizar lista"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Main Content Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex flex-col justify-center items-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mb-3 text-blue-600" />
            <span className="text-sm">Carregando documentos...</span>
          </div>
        ) : queryError ? (
          <div className="p-4">
            <FeedbackPanel error={queryError} onRetry={() => void refetch()} compact />
          </div>
        ) : documentsData?.items.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Nenhum documento encontrado
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Não há documentos cadastrados ou correspondentes aos filtros selecionados.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Documento</th>
                  <th className="py-3 px-4">Colaborador</th>
                  <th className="py-3 px-4">Emissão</th>
                  <th className="py-3 px-4">Situação</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {documentsData?.items.map((doc) => (
                  <tr
                    key={doc.id}
                    className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${doc.isVoid ? 'opacity-70' : ''}`}
                  >
                    <td className="py-3 px-4 max-w-[340px]">
                      <div className="flex items-start gap-2.5">
                        <FileText className="mt-0.5 w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                        <div className="min-w-0">
                          <div
                            className={`truncate font-semibold text-slate-900 dark:text-white ${doc.isVoid ? 'line-through' : ''}`}
                            title={doc.title}
                          >
                            {doc.title}
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            {DOCUMENT_TYPE_LABELS[doc.documentType] ?? doc.documentType}
                            {doc.version > 1 && ` • versão ${doc.version}`}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      {doc.employeeName ? (
                        <span className="font-medium text-slate-900 dark:text-white">
                          {formatDisplayName(doc.employeeName)}
                        </span>
                      ) : (
                        <span className="text-slate-400">
                          {doc.documentType === 'INTERVIEW' ? 'Candidato' : 'Toda a empresa'}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="text-slate-700 dark:text-slate-300">
                        {formatInstantDateTime(doc.createdAt)}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-400">
                        por {formatDisplayName(doc.authorName ?? 'Administrador')}
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      {doc.isVoid ? (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300"
                          title={`Motivo: ${doc.voidReason ?? 'Não informado'}`}
                        >
                          <Ban className="w-3 h-3" />
                          Anulado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 className="w-3 h-3" />
                          Válido
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => void handlePreview(doc)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-400 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer"
                          aria-label={`Visualizar ${doc.title}`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Ver
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDownload(doc)}
                          disabled={downloadingId === doc.id}
                          className="p-2 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
                          title="Baixar PDF"
                          aria-label={`Baixar ${doc.title}`}
                        >
                          {downloadingId === doc.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </button>
                        {!doc.isVoid ? (
                          <button
                            type="button"
                            onClick={() => {
                              setDocToVoid(doc);
                              setVoidReason('');
                            }}
                            className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title="Anular documento"
                            aria-label={`Anular ${doc.title}`}
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="w-8" aria-hidden="true" />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {documentsData && documentsData.pagination.total > 0 ? (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 bg-slate-50/40 dark:bg-slate-900">
            <div>
              Mostrando {(page - 1) * limit + 1} até{' '}
              {Math.min(page * limit, documentsData.pagination.total)} de{' '}
              {documentsData.pagination.total} documentos
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Página {page} de {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <DocumentViewerDialog
        isOpen={previewDoc !== null}
        title={previewDoc?.title ?? ''}
        description={
          previewDoc?.isVoid
            ? `Documento anulado: ${previewDoc.voidReason ?? 'sem motivo informado'}`
            : 'Documento oficial válido'
        }
        pdf={previewPdf.pdf}
        filename={previewPdf.filename}
        loadError={previewPdf.loadError}
        onClose={handleClosePreview}
      />

      {/* Void Confirmation Modal */}
      {docToVoid && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <Ban className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Anular Documento Oficial
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Você está prestes a anular o documento{' '}
              <strong className="text-slate-900 dark:text-white font-semibold">
                "{docToVoid.title}"
              </strong>
              . Esta ação tornará o documento inválido e registrará sua justificativa na trilha de
              auditoria.
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Justificativa da Anulação *
              </label>
              <textarea
                rows={3}
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Informe o motivo formal da anulação deste documento..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDocToVoid(null);
                  setVoidReason('');
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void voidMutation.mutate()}
                disabled={voidMutation.isPending || voidReason.trim().length < 3}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors disabled:opacity-50"
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
