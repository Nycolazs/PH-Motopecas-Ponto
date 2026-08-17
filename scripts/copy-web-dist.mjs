import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const sourceDir = resolve(rootDir, 'PH-Motopeças-Ponto-Frontend', 'dist', 'renderer');

if (existsSync(sourceDir)) {
  const rootDist = resolve(rootDir, 'dist');
  const rootRenderer = resolve(rootDir, 'renderer');

  mkdirSync(rootDist, { recursive: true });
  cpSync(sourceDir, rootDist, { recursive: true });

  mkdirSync(rootRenderer, { recursive: true });
  cpSync(sourceDir, rootRenderer, { recursive: true });

  console.log(
    `[copy-web-dist] Successfully copied web build to root dist and renderer directories.`,
  );
}
