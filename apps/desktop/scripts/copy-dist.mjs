import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendDir = resolve(__dirname, '..');
const distDir = resolve(frontendDir, 'dist');
const distRendererDir = resolve(distDir, 'renderer');
const rendererDir = resolve(frontendDir, 'renderer');
const buildDir = resolve(frontendDir, 'build');
const srcAssetsDir = resolve(frontendDir, 'src', 'renderer', 'assets');

if (existsSync(distDir)) {
  mkdirSync(distRendererDir, { recursive: true });
  mkdirSync(rendererDir, { recursive: true });

  for (const item of readdirSync(distDir)) {
    if (item !== 'main' && item !== 'preload' && item !== 'shared' && item !== 'renderer') {
      const src = resolve(distDir, item);
      cpSync(src, resolve(distRendererDir, item), { recursive: true });
      cpSync(src, resolve(rendererDir, item), { recursive: true });
    }
  }

  // Copy build icons to dist and dist/renderer for runtime lookup
  if (existsSync(buildDir)) {
    const distBuildDir = resolve(distDir, 'build');
    mkdirSync(distBuildDir, { recursive: true });
    for (const item of readdirSync(buildDir)) {
      const src = resolve(buildDir, item);
      cpSync(src, resolve(distBuildDir, item), { recursive: true });
      cpSync(src, resolve(distDir, item), { recursive: true });
      cpSync(src, resolve(distRendererDir, item), { recursive: true });
    }
  }

  // Copy official source assets (app-icon, phmotos-logo) to dist assets without hashes
  if (existsSync(srcAssetsDir)) {
    const distAssetsDir = resolve(distDir, 'assets');
    const distRendererAssetsDir = resolve(distRendererDir, 'assets');
    mkdirSync(distAssetsDir, { recursive: true });
    mkdirSync(distRendererAssetsDir, { recursive: true });

    for (const item of readdirSync(srcAssetsDir)) {
      const src = resolve(srcAssetsDir, item);
      cpSync(src, resolve(distAssetsDir, item), { recursive: true });
      cpSync(src, resolve(distRendererAssetsDir, item), { recursive: true });
      cpSync(src, resolve(distDir, item), { recursive: true });
      cpSync(src, resolve(distRendererDir, item), { recursive: true });
    }
  }

  console.log('[copy-dist] Successfully synchronized dist, dist/renderer, renderer, and icon assets.');
}
