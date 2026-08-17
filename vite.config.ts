import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: resolve(__dirname, 'PH-Motopeças-Ponto-Frontend/src/renderer'),
  base: '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@ph-ponto/shared': resolve(__dirname, 'packages/shared/src'),
      '@renderer': resolve(__dirname, 'PH-Motopeças-Ponto-Frontend/src/renderer'),
    },
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    sourcemap: true,
  },
});
