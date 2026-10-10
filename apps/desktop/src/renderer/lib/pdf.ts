import type * as Pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/**
 * PDFs are rendered with pdf.js onto canvases instead of the browser's built-in viewer:
 * the Electron renderer forbids frames/plugins (`frame-src 'none'`, `object-src 'none'`),
 * and this keeps the preview, the archive viewer and printing identical on web and desktop.
 */
let pdfjsPromise: Promise<typeof Pdfjs> | null = null;

function loadPdfjs(): Promise<typeof Pdfjs> {
  pdfjsPromise ??= import('pdfjs-dist').then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    return pdfjs;
  });
  return pdfjsPromise;
}

export interface OpenedPdf {
  pdf: PDFDocumentProxy;
  /** Frees the worker-side document; call when the PDF is no longer shown. */
  destroy: () => Promise<void>;
}

export async function openPdf(blob: Blob): Promise<OpenedPdf> {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await blob.arrayBuffer());
  const task = pdfjs.getDocument({ data, enableXfa: false });
  const pdf = await task.promise;
  return { pdf, destroy: () => task.destroy() };
}

export interface PageRender {
  promise: Promise<void>;
  cancel: () => void;
}

/**
 * Renders a page into `canvas` at `cssWidth` CSS pixels wide, sharp on HiDPI screens.
 * Cancel the previous render before drawing the same canvas again (e.g. on zoom).
 */
export function renderPageToCanvas(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  cssWidth: number,
  pixelRatio = window.devicePixelRatio || 1,
): PageRender {
  const base = page.getViewport({ scale: 1 });
  const scale = cssWidth / base.width;
  const viewport = page.getViewport({ scale: scale * pixelRatio });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = `${Math.floor(cssWidth)}px`;
  canvas.style.height = `${Math.floor(base.height * scale)}px`;
  const task = page.render({ canvas, viewport });
  return { promise: task.promise, cancel: () => task.cancel() };
}

const PRINT_ROOT_ID = 'pdf-print-root';
const PRINTING_CLASS = 'printing-pdf';
/** ~200 DPI on A4: crisp text without huge memory use. */
const PRINT_WIDTH_PX = 1654;

/**
 * Prints a PDF through the regular print dialog. Pages are rasterised into images in a
 * print-only container, so it works the same in Chromium, Electron and Safari.
 */
export async function printPdfBlob(blob: Blob): Promise<void> {
  const { pdf, destroy } = await openPdf(blob);
  const root = document.createElement('div');
  root.id = PRINT_ROOT_ID;
  root.setAttribute('aria-hidden', 'true');
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const canvas = document.createElement('canvas');
      await renderPageToCanvas(page, canvas, PRINT_WIDTH_PX, 1).promise;
      const image = new Image();
      image.alt = '';
      image.src = canvas.toDataURL('image/png');
      await image.decode().catch(() => undefined);
      root.append(image);
      page.cleanup();
    }
  } finally {
    await destroy();
  }

  document.getElementById(PRINT_ROOT_ID)?.remove();
  document.body.append(root);
  document.documentElement.classList.add(PRINTING_CLASS);
  const cleanup = () => {
    document.documentElement.classList.remove(PRINTING_CLASS);
    root.remove();
  };
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
  // Some platforms return from print() without firing `afterprint`.
  window.setTimeout(() => {
    window.removeEventListener('afterprint', cleanup);
    cleanup();
  }, 60_000);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
