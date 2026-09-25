import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  FolderArchive,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../auth/use-auth.js';
import { useToast } from '../../components/toast-context.js';
import type { DocumentTypeDto, GeneratedDocumentDto } from '../../api/contracts.js';

const DOCUMENT_TYPE_LABELS: Record<DocumentTypeDto, string> = {
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

export function DocumentsArchivePage(): React.JSX.Element {
  const { session, api } = useAuth();
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();

  // Filters & Pagination State
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<DocumentTypeDto | ''>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'VOID'>('ALL');

  // Preview & Void Modal State
  const [previewDoc, setPreviewDoc] = useState<GeneratedDocumentDto | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const [docToVoid, setDocToVoid] = useState<GeneratedDocumentDto | null>(null);
  const [voidReason, setVoidReason] = useState('');

  // Download loading state by document ID
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Fetch Documents List
  const {
    data: documentsData,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ['documents-list', page, limit, search, selectedType, statusFilter],
    queryFn: ({ signal }) =>
      api.getDocuments(
        {
          page,
          limit,
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(selectedType ? { documentType: selectedType } : {}),
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
    try {
      setPreviewDoc(doc);
      setIsPreviewLoading(true);
      if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);

      const blob = await api.getArtifactPreviewBlob(doc.artifactId);
      const url = URL.createObjectURL(blob);
      setPreviewBlobUrl(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao carregar prévia do documento.';
      toastError(msg);
      setPreviewDoc(null);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleClosePreview = (): void => {
    if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
    setPreviewBlobUrl(null);
    setPreviewDoc(null);
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
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            to="/admin"
            className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Voltar ao Início
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <FolderArchive className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              Arquivo de Documentos Oficiais
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-300/40">
              {documentsData?.pagination.total ?? 0} Documentos
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Repositório imutável de manuais, descrições de cargos, termos de ciência e comunicados
            oficiais emitidos.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/admin/documentos/cultura"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-xs"
          >
            <Sparkles className="w-4 h-4" />
            Manual de Cultura
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar por título ou colaborador..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Document Type Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value as DocumentTypeDto | '');
              setPage(1);
            }}
            className="text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white py-2 px-3 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos os Tipos</option>
            {Object.entries(DOCUMENT_TYPE_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
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
            Ativos
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
            <span className="text-sm">Carregando documentos oficiais...</span>
          </div>
        ) : queryError ? (
          <div className="p-8 text-center text-rose-600 dark:text-rose-400 space-y-2">
            <AlertCircle className="w-8 h-8 mx-auto" />
            <p className="text-sm font-semibold">Falha ao carregar o arquivo de documentos.</p>
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
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="py-3.5 px-4">Documento</th>
                  <th className="py-3.5 px-4">Tipo</th>
                  <th className="py-3.5 px-4">Destinatário</th>
                  <th className="py-3.5 px-4">Versão</th>
                  <th className="py-3.5 px-4">Data de Emissão</th>
                  <th className="py-3.5 px-4">Emitido por</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {documentsData?.items.map((doc) => (
                  <tr
                    key={doc.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    {/* Document Title & Icon */}
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                        <span className="truncate max-w-[220px]" title={doc.title}>
                          {doc.title}
                        </span>
                      </div>
                    </td>

                    {/* Document Type Badge */}
                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {DOCUMENT_TYPE_LABELS[doc.documentType] ?? doc.documentType}
                      </span>
                    </td>

                    {/* Employee / General */}
                    <td className="py-3.5 px-4">
                      {doc.employeeName ? (
                        <span className="font-medium text-slate-900 dark:text-white">
                          {doc.employeeName}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Institucional / Geral</span>
                      )}
                    </td>

                    {/* Version */}
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-xs font-semibold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                        v{doc.version}
                      </span>
                    </td>

                    {/* Created Date */}
                    <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {new Date(doc.createdAt).toLocaleDateString('pt-BR')} às{' '}
                      {new Date(doc.createdAt).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>

                    {/* Author */}
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                      {doc.authorName ?? 'Administrador'}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      {doc.isVoid ? (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300/40"
                          title={`Motivo: ${doc.voidReason ?? 'Não informado'}`}
                        >
                          <Ban className="w-3 h-3" />
                          Anulado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300/40">
                          <CheckCircle2 className="w-3 h-3" />
                          Ativo
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => void handlePreview(doc)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Visualizar PDF"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleDownload(doc)}
                          disabled={downloadingId === doc.id}
                          className="p-1.5 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                          title="Baixar PDF"
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
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            title="Anular Documento"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        ) : null}
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

      {/* PDF Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center gap-2.5">
                <FileCheck2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {previewDoc.title} (v{previewDoc.version})
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Emitido em {new Date(previewDoc.createdAt).toLocaleDateString('pt-BR')} por{' '}
                    {previewDoc.authorName ?? 'Administrador'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClosePreview}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* PDF View Container */}
            <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-2 overflow-hidden flex justify-center items-center">
              {isPreviewLoading ? (
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
                  <span className="text-xs">Carregando visualização...</span>
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

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-900">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {previewDoc.isVoid ? (
                  <span className="text-rose-600 font-semibold flex items-center gap-1">
                    <Ban className="w-3.5 h-3.5" />
                    Documento Anulado: {previewDoc.voidReason}
                  </span>
                ) : (
                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Documento Oficial Válido
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleDownload(previewDoc)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Baixar PDF
                </button>
                <button
                  type="button"
                  onClick={handleClosePreview}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
