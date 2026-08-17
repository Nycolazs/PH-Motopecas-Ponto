import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

// 1. Locate or clone frontend directory in pure ASCII path
let frontendDir = resolve(rootDir, 'PH-Motopeças-Ponto-Frontend');
if (!existsSync(resolve(frontendDir, 'src'))) {
  frontendDir = resolve(rootDir, '.vercel_frontend');
  if (!existsSync(resolve(frontendDir, 'src'))) {
    console.log('[vercel-build] Fetching frontend source from GitHub...');
    if (existsSync(frontendDir)) {
      rmSync(frontendDir, { recursive: true, force: true });
    }
    execSync(
      'git clone --depth 1 https://github.com/Nycolazs/PH-Motopecas-Ponto-Frontend.git .vercel_frontend',
      {
        cwd: rootDir,
        stdio: 'inherit',
      },
    );
  }
}

console.log('[vercel-build] Using frontend directory:', frontendDir);

// 2. Build shared package if present in root
try {
  console.log('[vercel-build] Building shared package...');
  execSync('pnpm --filter @ph-ponto/shared build', {
    cwd: rootDir,
    stdio: 'inherit',
  });
} catch (e) {
  console.warn('[vercel-build] Shared package note:', e.message);
}

// 3. Install & Build frontend directly
console.log('[vercel-build] Installing and building frontend with Vite...');
execSync('pnpm install --no-frozen-lockfile && pnpm build', {
  cwd: frontendDir,
  stdio: 'inherit',
});

// 4. Populate root dist, public, and renderer
const frontendDist = resolve(frontendDir, 'dist');
const rootDist = resolve(rootDir, 'dist');
const rootPublic = resolve(rootDir, 'public');
const rootRenderer = resolve(rootDir, 'renderer');

mkdirSync(rootDist, { recursive: true });
mkdirSync(rootPublic, { recursive: true });
mkdirSync(rootRenderer, { recursive: true });

if (existsSync(frontendDist)) {
  for (const item of readdirSync(frontendDist)) {
    if (item !== 'main' && item !== 'preload' && item !== 'shared' && item !== 'renderer') {
      const src = resolve(frontendDist, item);
      cpSync(src, resolve(rootDist, item), { recursive: true });
      cpSync(src, resolve(rootPublic, item), { recursive: true });
      cpSync(src, resolve(rootRenderer, item), { recursive: true });
    }
  }
}

console.log(
  '[vercel-build] Build complete! Root dist, public and renderer populated successfully.',
);
