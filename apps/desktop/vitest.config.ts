import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const desktopVersion = (
  JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
    version: string;
  }
).version;

export default defineConfig({
  define: { __DESKTOP_VERSION__: JSON.stringify(desktopVersion) },
  plugins: [react()],
  resolve: {
    alias: {
      '@renderer': fileURLToPath(new URL('./src/renderer', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/renderer/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    testTimeout: 20000,
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});
