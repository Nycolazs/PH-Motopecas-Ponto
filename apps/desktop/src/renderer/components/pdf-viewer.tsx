import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, FileText, Minus, Plus, RefreshCw, ScanLine } from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';

import { openPdf, renderPageToCanvas, type OpenedPdf, type PageRender } from '../lib/pdf.js';

interface PdfViewerProps {
  /** The PDF to show; `null` while it is still being fetched. */
  blob: Blob | null;
  /** Accessible name, e.g. the document title. */
  title: string;
  /** Message shown instead of the document when fetching it failed. */
  loadError?: string | null;
}

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
const PAGE_GUTTER = 32;
const MAX_FIT_WIDTH = 900;

type ViewerState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; pdf: PDFDocumentProxy };

/** Renders a PDF page by page on canvases (works on the web and inside Electron). */
export function PdfViewer({ blob, title, loadError = null }: PdfViewerProps): React.JSX.Element {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<ViewerState>({ status: 'loading' });
  const [containerWidth, setContainerWidth] = useState(0);
  const [zoom, setZoom] = useState<number | 'fit'>('fit');

  useEffect(() => {
    if (blob === null) {
      setState({ status: 'loading' });
      return;
    }
    let cancelled = false;
    let opened: OpenedPdf | null = null;
    setState({ status: 'loading' });
    openPdf(blob)
      .then((result) => {
        opened = result;
        if (cancelled) void result.destroy();
        else setState({ status: 'ready', pdf: result.pdf });
      })
      .catch(() => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: 'Não foi possível abrir este PDF. Baixe o arquivo para conferir.',
          });
        }
      });
    return () => {
      cancelled = true;
      if (opened !== null) void opened.destroy();
    };
  }, [blob]);

  useEffect(() => {
    const element = scrollerRef.current;
    if (element === null || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const fitWidth = Math.max(240, Math.min(MAX_FIT_WIDTH, containerWidth - PAGE_GUTTER));
  const pageWidth = zoom === 'fit' ? fitWidth : Math.round(fitWidth * zoom);
  const zoomPercent = zoom === 'fit' ? null : Math.round(zoom * 100);
  const currentStep = zoom === 'fit' ? 1 : zoom;
  const smaller = ZOOM_STEPS.filter((step) => step < currentStep).at(-1);
  const larger = ZOOM_STEPS.find((step) => step > currentStep);

  const message = loadError ?? (state.status === 'error' ? state.message : null);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-1.5 dark:border-slate-800 dark:bg-slate-900">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
          <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {state.status === 'ready' && message === null
            ? `${state.pdf.numPages} ${state.pdf.numPages === 1 ? 'página' : 'páginas'}`
            : 'PDF'}
        </span>
        <div className="flex items-center gap-1" role="group" aria-label="Zoom do documento">
          <button
            type="button"
            onClick={() => smaller !== undefined && setZoom(smaller)}
            disabled={smaller === undefined || state.status !== 'ready'}
            aria-label="Diminuir zoom"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom('fit')}
            disabled={state.status !== 'ready'}
            aria-label="Ajustar à largura"
            className="inline-flex min-w-[4.5rem] items-center justify-center gap-1 rounded-md px-2 py-1 text-xs font-semibold tabular-nums text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {zoomPercent === null ? (
              <>
                <ScanLine className="h-3.5 w-3.5" aria-hidden="true" /> Ajustar
              </>
            ) : (
              `${zoomPercent}%`
            )}
          </button>
          <button
            type="button"
            onClick={() => larger !== undefined && setZoom(larger)}
            disabled={larger === undefined || state.status !== 'ready'}
            aria-label="Aumentar zoom"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        role="document"
        aria-label={title}
        aria-busy={state.status === 'loading' && message === null}
        tabIndex={0}
        className="min-h-0 flex-1 overflow-auto p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
      >
        {message !== null ? (
          <div
            role="alert"
            className="mx-auto mt-10 flex max-w-sm flex-col items-center gap-2 text-center text-sm text-slate-600 dark:text-slate-300"
          >
            <AlertTriangle className="h-6 w-6 text-amber-500" aria-hidden="true" />
            {message}
          </div>
        ) : state.status !== 'ready' ? (
          <div className="mt-10 flex items-center justify-center gap-2 text-sm text-slate-500">
            <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
            Carregando documento...
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            {Array.from({ length: state.pdf.numPages }, (_, index) => (
              <PdfPage key={index + 1} pdf={state.pdf} pageNumber={index + 1} width={pageWidth} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PdfPage({
  pdf,
  pageNumber,
  width,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  width: number;
}): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let render: PageRender | null = null;
    const canvas = canvasRef.current;
    if (canvas === null) return;
    void pdf
      .getPage(pageNumber)
      .then((page) => {
        if (cancelled) return undefined;
        render = renderPageToCanvas(page, canvas, width);
        return render.promise;
      })
      .then(() => {
        if (!cancelled) setFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      render?.cancel();
    };
  }, [pdf, pageNumber, width]);

  return (
    <div
      className="relative bg-white shadow-md ring-1 ring-slate-900/5"
      style={{ width, minHeight: Math.round(width * 1.414) }}
    >
      <canvas ref={canvasRef} aria-label={`Página ${pageNumber}`} role="img" />
      {failed && (
        <p className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">
          Não foi possível desenhar a página {pageNumber}.
        </p>
      )}
    </div>
  );
}
