import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Ban,
  BookOpen,
  Briefcase,
  ChevronRight,
  FileCheck2,
  FileClock,
  FileText,
  Lock,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  UserCheck,
  Award,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import type { DocumentTypeDto, GeneratedDocumentDto } from '../../api/contracts.js';
import { useAuth } from '../../auth/use-auth.js';
import { DocumentViewerDialog } from '../../components/document-viewer-dialog.js';
import { DOCUMENT_TYPE_LABELS } from '../../lib/document-types.js';
import { formatDisplayName, formatInstantDateTime } from '../../lib/format.js';

export const RECENT_DOCUMENTS_LIMIT = 6;

const TYPE_ICONS: Record<DocumentTypeDto, React.ComponentType<{ className?: string }>> = {
  CULTURE: Sparkles,
  REGULATION: BookOpen,
  ROLE_MAP: Briefcase,
  INTERVIEW: UserCheck,
  ACKNOWLEDGMENT_REGULATION: FileCheck2,
  ACKNOWLEDGMENT_ROLE: FileCheck2,
  DISCIPLINE_VERBAL: ShieldAlert,
  DISCIPLINE_WRITTEN: ShieldAlert,
  DISCIPLINE_SUSPENSION: ShieldAlert,
  PERFORMANCE_REVIEW: Award,
};

const TYPE_TONES: Record<DocumentTypeDto, string> = {
  CULTURE: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300',
  REGULATION: 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300',
  ROLE_MAP: 'bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-300',
  INTERVIEW: 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300',
  ACKNOWLEDGMENT_REGULATION: 'bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300',
  ACKNOWLEDGMENT_ROLE: 'bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300',
  DISCIPLINE_VERBAL: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300',
  DISCIPLINE_WRITTEN: 'bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-300',
  DISCIPLINE_SUSPENSION: 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300',
  PERFORMANCE_REVIEW: 'bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300',
};

interface OpenDocument {
  doc: GeneratedDocumentDto;
  pdf: Blob | null;
  filename: string;
  loadError: string | null;
}

/** The latest PDFs saved in the encrypted archive, one click away from the viewer. */
export function RecentDocumentsPanel(): React.JSX.Element {
  const { api } = useAuth();
  const [open, setOpen] = useState<OpenDocument | null>(null);

  const recent = useQuery({
    queryKey: ['documents-recent', RECENT_DOCUMENTS_LIMIT],
    queryFn: ({ signal }) => api.getDocuments({ page: 1, limit: RECENT_DOCUMENTS_LIMIT }, signal),
  });

  const openDocument = async (doc: GeneratedDocumentDto): Promise<void> => {
    setOpen({ doc, pdf: null, filename: 'documento.pdf', loadError: null });
    try {
      const { blob, filename } = await api.downloadDocumentBlob(doc.id);
      setOpen((current) =>
        current?.doc.id === doc.id ? { doc, pdf: blob, filename, loadError: null } : current,
      );
    } catch (err: unknown) {
      setOpen((current) =>
        current?.doc.id === doc.id
          ? {
              doc,
              pdf: null,
              filename: 'documento.pdf',
              loadError: err instanceof Error ? err.message : 'Falha ao abrir o PDF.',
            }
          : current,
      );
    }
  };

  const items = recent.data?.items ?? [];

  return (
    <section
      aria-labelledby="recent-documents-title"
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileClock className="h-4 w-4 text-slate-400" aria-hidden="true" />
          <h2
            id="recent-documents-title"
            className="text-sm font-bold text-slate-900 dark:text-white"
          >
            Últimos PDFs gerados
          </h2>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
            <Lock className="h-3 w-3" aria-hidden="true" />
            Arquivo criptografado
          </span>
        </div>
        <Link
          to="/admin/documentos"
          className="inline-flex items-center gap-0.5 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
        >
          Ver todos
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      {recent.isPending ? (
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {Array.from({ length: 3 }, (_, index) => (
            <li
              key={index}
              className="h-[68px] animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800"
            />
          ))}
        </ul>
      ) : recent.isError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
        >
          Não foi possível carregar os últimos documentos.
          <button
            type="button"
            onClick={() => void recent.refetch()}
            className="inline-flex items-center gap-1 font-semibold underline"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Tentar novamente
          </button>
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Nenhum PDF foi gerado ainda. Ao imprimir ou salvar um documento, ele aparece aqui.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {items.map((doc) => {
            const Icon = TYPE_ICONS[doc.documentType] ?? FileText;
            return (
              <li key={doc.id}>
                <button
                  type="button"
                  onClick={() => void openDocument(doc)}
                  aria-label={`Abrir ${doc.title}`}
                  className="group flex w-full items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-left transition-colors hover:border-blue-400 hover:bg-blue-50/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-slate-800 dark:hover:border-blue-500 dark:hover:bg-blue-950/20"
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TYPE_TONES[doc.documentType] ?? ''}`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-semibold text-slate-900 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300">
                        {DOCUMENT_TYPE_LABELS[doc.documentType] ?? doc.title}
                      </span>
                      {doc.isVoid && (
                        <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-rose-100 px-1 text-[10px] font-semibold text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                          <Ban className="h-2.5 w-2.5" aria-hidden="true" />
                          Anulado
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
                      {doc.employeeName ? formatDisplayName(doc.employeeName) : 'Empresa'} ·{' '}
                      {formatInstantDateTime(doc.createdAt)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <DocumentViewerDialog
        isOpen={open !== null}
        title={open?.doc.title ?? ''}
        description={
          open
            ? `${DOCUMENT_TYPE_LABELS[open.doc.documentType] ?? 'Documento'} · gerado em ${formatInstantDateTime(open.doc.createdAt)}${open.doc.authorName ? ` por ${formatDisplayName(open.doc.authorName)}` : ''}`
            : ''
        }
        pdf={open?.pdf ?? null}
        filename={open?.filename ?? 'documento.pdf'}
        loadError={open?.loadError ?? null}
        onClose={() => setOpen(null)}
      />
    </section>
  );
}
