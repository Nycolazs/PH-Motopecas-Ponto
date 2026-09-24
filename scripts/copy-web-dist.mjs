import { cpSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const sourceDir = fileURLToPath(new URL('../apps/desktop/dist/renderer/', import.meta.url));
const outputDir = fileURLToPath(new URL('../dist/', import.meta.url));

if (!existsSync(new URL('../apps/desktop/dist/renderer/index.html', import.meta.url))) {
  throw new Error('Build apps/desktop/dist/renderer before copying the web distribution.');
}

// Only the ignored root distribution is replaced; source/public directories are untouched.
rmSync(outputDir, { recursive: true, force: true });
cpSync(sourceDir, outputDir, { recursive: true });
console.log(`[copy-web-dist] Web distribution written to ${outputDir}.`);
