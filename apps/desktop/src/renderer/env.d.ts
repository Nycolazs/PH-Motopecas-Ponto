/// <reference types="vite/client" />

import type { ElectronApi } from '../shared/electron-api.js';

declare global {
  /** Version of the desktop client released with this build (apps/desktop/package.json). */
  const __DESKTOP_VERSION__: string;

  interface Window {
    phPonto?: ElectronApi;
  }
}

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export {};
