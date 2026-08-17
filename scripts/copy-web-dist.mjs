import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

const candidates = [
  resolve(rootDir, 'apps', 'desktop', 'dist'),
  resolve(rootDir, 'PH-Motopeças-Ponto-Frontend', 'dist'),
  resolve(rootDir, 'dist'),
];

let sourceDir = null;
for (const cand of candidates) {
  if (existsSync(cand) && existsSync(resolve(cand, 'index.html'))) {
    sourceDir = cand;
    break;
  }
}

if (!sourceDir) {
  for (const cand of candidates) {
    if (existsSync(cand)) {
      sourceDir = cand;
      break;
    }
  }
}

if (sourceDir) {
  const rootDist = resolve(rootDir, 'dist');
  const rootPublic = resolve(rootDir, 'public');
  const rootRenderer = resolve(rootDir, 'renderer');
  const rootDistRenderer = resolve(rootDir, 'dist', 'renderer');

  mkdirSync(rootDist, { recursive: true });
  mkdirSync(rootPublic, { recursive: true });
  mkdirSync(rootRenderer, { recursive: true });
  mkdirSync(rootDistRenderer, { recursive: true });

  for (const item of readdirSync(sourceDir)) {
    if (item !== 'main' && item !== 'preload' && item !== 'shared' && item !== 'renderer') {
      const src = resolve(sourceDir, item);
      cpSync(src, resolve(rootDist, item), { recursive: true });
      cpSync(src, resolve(rootPublic, item), { recursive: true });
      cpSync(src, resolve(rootRenderer, item), { recursive: true });
      cpSync(src, resolve(rootDistRenderer, item), { recursive: true });
    }
  }

  console.log(
    `[copy-web-dist] Successfully populated root dist, public, and renderer from ${sourceDir}.`,
  );
}
