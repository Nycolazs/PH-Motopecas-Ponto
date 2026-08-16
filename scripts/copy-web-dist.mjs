import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const sourceDir = resolve(rootDir, 'PH-Motopeças-Ponto-Frontend', 'dist', 'renderer');
const targetDir = resolve(rootDir, 'dist');

rmSync(targetDir, { recursive: true, force: true });
mkdirSync(targetDir, { recursive: true });
cpSync(sourceDir, targetDir, { recursive: true });
console.log(`[copy-web-dist] Successfully prepared root dist for Vercel.`);
