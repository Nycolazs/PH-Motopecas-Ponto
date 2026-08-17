import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const frontendDist = resolve(rootDir, 'PH-Motopeças-Ponto-Frontend', 'dist');
const rootDist = resolve(rootDir, 'dist');
const rootRenderer = resolve(rootDir, 'renderer');
const rootDistRenderer = resolve(rootDir, 'dist', 'renderer');

const sourceDir = existsSync(frontendDist) ? frontendDist : existsSync(rootDist) ? rootDist : null;

if (sourceDir) {
  mkdirSync(rootDist, { recursive: true });
  mkdirSync(rootRenderer, { recursive: true });
  mkdirSync(rootDistRenderer, { recursive: true });

  for (const item of readdirSync(sourceDir)) {
    if (item !== 'main' && item !== 'preload' && item !== 'shared' && item !== 'renderer') {
      const src = resolve(sourceDir, item);
      cpSync(src, resolve(rootDist, item), { recursive: true });
      cpSync(src, resolve(rootRenderer, item), { recursive: true });
      cpSync(src, resolve(rootDistRenderer, item), { recursive: true });
    }
  }

  console.log(
    '[copy-web-dist] Successfully populated root dist, renderer, and dist/renderer for Vercel.',
  );
}
