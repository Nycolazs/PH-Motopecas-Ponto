import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, RefreshCw, X } from 'lucide-react';

import type { JustificationAttachment } from '../api/contracts.js';
import { useApiClient } from '../auth/use-auth.js';
import { downloadBlob } from '../lib/pdf.js';
import { DocumentViewerDialog } from './document-viewer-dialog.js';

interface JustificationAttachmentViewerProps {
  justificationId: string;
  attachment: JustificationAttachment | null;
  onClose: () => void;
}

/** Opens an atestado file: PDFs in the document viewer, photos full size. */
export function JustificationAttachmentViewer({
  justificationId,
  attachment,
  onClose,
}: JustificationAttachmentViewerProps): React.JSX.Element | null {
  const api = useApiClient();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    setBlob(null);
    setError(null);
    if (attachment === null) return;
    const controller = new AbortController();
    api
      .getJustificationAttachmentBlob(justificationId, attachment.id, controller.signal)
      .then(setBlob)
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Não foi possível abrir o arquivo.');
        }
      });
    return () => controller.abort();
  }, [api, justificationId, attachment]);

  const isImage = attachment !== null && attachment.mimeType !== 'application/pdf';

  useEffect(() => {
    if (!isImage || blob === null) {
      setImageUrl(null);
      return;
    }
    const url = URL.createObjectURL(blob);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob, isImage]);

  useEffect(() => {
    if (attachment === null || !isImage) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [attachment, isImage, onClose]);

  if (attachment === null) return null;

  if (!isImage) {
    return (
      <DocumentViewerDialog
        isOpen
        title={attachment.fileName}
        description="Atestado médico anexado"
        pdf={blob}
        filename={attachment.fileName}
        loadError={error}
        onClose={onClose}
      />
    );
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={attachment.fileName}
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/90"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
        <p className="truncate text-sm font-semibold">{attachment.fileName}</p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={blob === null}
            onClick={() => blob && downloadBlob(blob, attachment.fileName)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20 disabled:opacity-50"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Baixar
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            autoFocus
            className="rounded-lg p-1.5 hover:bg-white/10"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-4" onClick={onClose}>
        {error ? (
          <p role="alert" className="text-sm text-rose-200">
            {error}
          </p>
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt={`Atestado: ${attachment.fileName}`}
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          />
        ) : (
          <p className="flex items-center gap-2 text-sm text-slate-300">
            <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
            Carregando arquivo...
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}
