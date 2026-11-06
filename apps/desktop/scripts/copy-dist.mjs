import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const rendererDir = fileURLToPath(new URL('../dist/renderer/', import.meta.url));
const assetsDir = fileURLToPath(new URL('../dist/renderer/assets/', import.meta.url));

if (!existsSync(new URL('../dist/renderer/index.html', import.meta.url))) {
  throw new Error('Build the renderer before copying its static icon assets.');
}

mkdirSync(assetsDir, { recursive: true });
// The Electron main process loads the window/tray icon from here (see main/app-icon.ts).
for (const [source, target] of [
  ['icon.png', 'app-icon.png'],
  ['logo.png', 'brand-logo.png'],
]) {
  copyFileSync(
    new URL(`../../../packages/shared/brand/${source}`, import.meta.url),
    new URL(`../dist/renderer/assets/${target}`, import.meta.url),
  );
}

console.log(`[copy-dist] Static icon assets added to ${rendererDir}.`);
