import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

let sourceDir = null;
const directFrontendDist = resolve(rootDir, 'PH-Motopeças-Ponto-Frontend', 'dist');
if (existsSync(directFrontendDist)) {
  sourceDir = directFrontendDist;
} else {
  // Find any frontend directory case-insensitively / NFC normalized
  for (const entry of readdirSync(rootDir)) {
    const fullPath = resolve(rootDir, entry);
    if (statSync(fullPath).isDirectory() && entry.toLowerCase().includes('frontend')) {
      const candidateDist = resolve(fullPath, 'dist');
      if (existsSync(candidateDist)) {
        sourceDir = candidateDist;
        break;
      }
    }
  }
}

if (!sourceDir && existsSync(resolve(rootDir, 'dist'))) {
  sourceDir = resolve(rootDir, 'dist');
}

if (sourceDir) {
  const rootDist = resolve(rootDir, 'dist');
  const rootRenderer = resolve(rootDir, 'renderer');
  const rootDistRenderer = resolve(rootDir, 'dist', 'renderer');

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
