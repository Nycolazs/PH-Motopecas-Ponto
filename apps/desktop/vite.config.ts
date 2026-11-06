import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const desktopVersion = (
  JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
    version: string;
  }
).version;

const sharedEntry = fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url));
const brandAssets = fileURLToPath(new URL('../../packages/shared/brand', import.meta.url));

/** Page title and icon come from the white-label brand (packages/shared/src/brand.ts). */
function brandHtml(): Plugin {
  const source = readFileSync(
    new URL('../../packages/shared/src/brand.ts', import.meta.url),
    'utf8',
  );
  const read = (key: string) => new RegExp(`${key}: '([^']*)'`).exec(source)?.[1] ?? '';
  const icon = readFileSync(new URL('../../packages/shared/brand/icon.png', import.meta.url));
  const iconUrl = `data:image/png;base64,${icon.toString('base64')}`;
  const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return {
    name: 'brand-html',
    transformIndexHtml(html) {
      return html
        .replace('%BRAND_TITLE%', escape(`${read('productName')} · ${read('companyName')}`))
        .replaceAll('%BRAND_ICON%', iconUrl);
    },
  };
}

export default defineConfig({
  root: fileURLToPath(new URL('./src/renderer', import.meta.url)),
  base: '/',
  define: { __DESKTOP_VERSION__: JSON.stringify(desktopVersion) },
  plugins: [react(), tailwindcss(), brandHtml()],
  resolve: {
    alias: {
      '@renderer': fileURLToPath(new URL('./src/renderer', import.meta.url)),
      '@ph-ponto/shared': sharedEntry,
      '@brand': brandAssets,
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: fileURLToPath(new URL('./dist/renderer', import.meta.url)),
    emptyOutDir: true,
    sourcemap: true,
  },
});
