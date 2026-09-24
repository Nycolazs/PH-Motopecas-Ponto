import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const rendererDir = fileURLToPath(new URL('../dist/renderer/', import.meta.url));
const assetsDir = fileURLToPath(new URL('../dist/renderer/assets/', import.meta.url));

if (!existsSync(new URL('../dist/renderer/index.html', import.meta.url))) {
  throw new Error('Build the renderer before copying its static icon assets.');
}

mkdirSync(assetsDir, { recursive: true });
for (const filename of ['app-icon.png', 'phmotos-logo.png']) {
  copyFileSync(
    new URL(`../src/renderer/assets/${filename}`, import.meta.url),
    new URL(`../dist/renderer/assets/${filename}`, import.meta.url),
  );
}

console.log(`[copy-dist] Static icon assets added to ${rendererDir}.`);
