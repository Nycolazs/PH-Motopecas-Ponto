import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

configure({ asyncUtilTimeout: 10000 });

afterEach(() => {
  cleanup();
  if (typeof window !== 'undefined') window.localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// pdf.js needs canvas/worker APIs that jsdom lacks; tests exercise the viewer contract
// (pages, print, download) against this stand-in.
vi.mock('../lib/pdf.js', () => ({
  // Every mocked PDF has two pages.
  openPdf: vi.fn(async () => ({
    pdf: {
      numPages: 2,
      getPage: vi.fn(async () => ({ cleanup: vi.fn() })),
    },
    destroy: vi.fn(async () => undefined),
  })),
  renderPageToCanvas: vi.fn(() => ({ promise: Promise.resolve(), cancel: vi.fn() })),
  printPdfBlob: vi.fn(async () => undefined),
  downloadBlob: vi.fn(),
}));
