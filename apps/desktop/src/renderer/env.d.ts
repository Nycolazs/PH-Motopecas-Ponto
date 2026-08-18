/// <reference types="vite/client" />

import type { ElectronApi } from '../shared/electron-api.js';

declare global {
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
