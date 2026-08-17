import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const frontendSrc = resolve(rootDir, 'PH-Motopeças-Ponto-Frontend', 'src');

if (!existsSync(frontendSrc)) {
  try {
    console.log('[prepare-submodules] Initializing git submodules for Vercel/CI...');
    execSync('git submodule update --init --recursive', {
      cwd: rootDir,
      stdio: 'inherit',
    });
  } catch (error) {
    console.warn('[prepare-submodules] Note: Could not update git submodules via CLI:', error.message);
  }
}
