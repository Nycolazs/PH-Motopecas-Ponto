import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendDir = resolve(__dirname, '..');
const distDir = resolve(frontendDir, 'dist');
const distRendererDir = resolve(distDir, 'renderer');
const rendererDir = resolve(frontendDir, 'renderer');
const publicDir = resolve(frontendDir, 'public');

if (existsSync(distDir)) {
  mkdirSync(distRendererDir, { recursive: true });
  mkdirSync(rendererDir, { recursive: true });
  mkdirSync(publicDir, { recursive: true });

  for (const item of readdirSync(distDir)) {
    if (item !== 'main' && item !== 'preload' && item !== 'shared' && item !== 'renderer') {
      const src = resolve(distDir, item);
      cpSync(src, resolve(distRendererDir, item), { recursive: true });
      cpSync(src, resolve(rendererDir, item), { recursive: true });
      cpSync(src, resolve(publicDir, item), { recursive: true });
    }
  }

  console.log('[copy-dist] Successfully synchronized dist, public, dist/renderer, and renderer.');
}
