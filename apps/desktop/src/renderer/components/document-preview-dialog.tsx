import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, FileText, Lock, Printer, RefreshCw, X } from 'lucide-react';

import { printPdfBlob } from '../lib/pdf.js';
import { PdfViewer } from './pdf-viewer.js';
import { useToast } from './toast-context.js';

interface DocumentPreviewDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  /** Rendered PDF; `null` while it is still downloading. */
  pdf: Blob | null;
  /** Label of the "save without printing" action, e.g. "Publicar Regimento". */
  confirmLabel: string;
  isConfirming: boolean;
  onClose: () => void;
  /**
   * Confirms the document (it is only stored in the encrypted archive at this point).
   * Must reject when the confirmation fails; the page shows its own error toast.
   */
  onConfirm: () => Promise<unknown>;
}

/**
 * Shared "preview, then print/save" step for every generated document. Nothing is kept
 * in the archive while the administrator only looks at the preview.
 */
export function DocumentPreviewDialog({
  isOpen,
  title,
  description,
  pdf,
  confirmLabel,
  isConfirming,
  onClose,
  onConfirm,
}: DocumentPreviewDialogProps): React.JSX.Element | null {
  const { error } = useToast();
  const [printing, setPrinting] = useState(false);
  const busy = isConfirming || printing;

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, busy, onClose]);

  if (!isOpen) return null;

  const confirmAndPrint = async (): Promise<void> => {
    if (pdf === null) return;
    setPrinting(true);
    try {
      await onConfirm();
    } catch {
      // The page reports the confirmation failure; nothing was printed.
      setPrinting(false);
      return;
    }
    try {
      await printPdfBlob(pdf);
    } catch {
      error(
        'O documento foi salvo, mas a impressão não abriu. Imprima pelo Arquivo de Documentos.',
      );
    } finally {
      setPrinting(false);
    }
  };

  const confirmOnly = async (): Promise<void> => {
    try {
      await onConfirm();
    } catch {
      // Reported by the page.
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="document-preview-title"
    >
      <div className="flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h3
                id="document-preview-title"
                className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100"
              >
                {title}
              </h3>
              <p className="truncate text-xs text-slate-500">{description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Fechar prévia"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 p-3">
          <PdfViewer blob={pdf} title={title} />
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Esta é só uma prévia. O PDF é guardado no arquivo criptografado quando você salva ou
            imprime.
          </p>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Voltar e Editar
            </button>
            <button
              type="button"
              onClick={() => void confirmOnly()}
              disabled={busy || pdf === null}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-600 px-4 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-500 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
            >
              {isConfirming && !printing ? (
                <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              )}
              {confirmLabel}
            </button>
            <button
              type="button"
              onClick={() => void confirmAndPrint()}
              disabled={busy || pdf === null}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              {printing ? (
                <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Printer className="h-4 w-4" aria-hidden="true" />
              )}
              Imprimir e Salvar
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
