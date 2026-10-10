import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, FileText, Printer, RefreshCw, X } from 'lucide-react';

import { downloadBlob, printPdfBlob } from '../lib/pdf.js';
import { PdfViewer } from './pdf-viewer.js';
import { useToast } from './toast-context.js';

interface DocumentViewerDialogProps {
  isOpen: boolean;
  title: string;
  description?: string;
  /** PDF already stored in the archive; `null` while downloading. */
  pdf: Blob | null;
  /** Download name, e.g. "advertencia_escrita_v1.pdf". */
  filename: string;
  /** Message shown when the PDF could not be fetched. */
  loadError?: string | null;
  onClose: () => void;
}

/** Read-only viewer for archived PDFs, with print and download. */
export function DocumentViewerDialog({
  isOpen,
  title,
  description,
  pdf,
  filename,
  loadError = null,
  onClose,
}: DocumentViewerDialogProps): React.JSX.Element | null {
  const { error } = useToast();
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const print = async (): Promise<void> => {
    if (pdf === null) return;
    setPrinting(true);
    try {
      await printPdfBlob(pdf);
    } catch {
      error('Não foi possível abrir a impressão. Baixe o PDF e imprima pelo seu leitor.');
    } finally {
      setPrinting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="document-viewer-title"
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h3
                id="document-viewer-title"
                className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100"
              >
                {title}
              </h3>
              {description ? (
                <p className="truncate text-xs text-slate-500">{description}</p>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => pdf && downloadBlob(pdf, filename)}
              disabled={pdf === null}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Baixar
            </button>
            <button
              type="button"
              onClick={() => void print()}
              disabled={pdf === null || printing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {printing ? (
                <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Printer className="h-4 w-4" aria-hidden="true" />
              )}
              Imprimir
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 p-3">
          <PdfViewer blob={pdf} title={title} loadError={loadError} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
