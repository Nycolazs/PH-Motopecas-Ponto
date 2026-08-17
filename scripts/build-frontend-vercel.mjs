import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const frontendDir = resolve(rootDir, 'PH-Motopeças-Ponto-Frontend');
const frontendSrc = resolve(frontendDir, 'src');

// 1. Ensure frontend repository files are present
if (!existsSync(frontendSrc)) {
  console.log('[vercel-build] Frontend source missing, fetching submodule or repository...');
  try {
    execSync('git submodule update --init --recursive', {
      cwd: rootDir,
      stdio: 'inherit',
    });
  } catch (err) {
    console.warn(
      '[vercel-build] git submodule update failed, fallback to direct git clone...',
      err.message,
    );
  }

  if (!existsSync(frontendSrc)) {
    try {
      execSync(
        'git clone --depth 1 https://github.com/Nycolazs/PH-Motopecas-Ponto-Frontend.git "PH-Motopeças-Ponto-Frontend"',
        {
          cwd: rootDir,
          stdio: 'inherit',
        },
      );
    } catch (cloneErr) {
      console.error('[vercel-build] Direct clone failed:', cloneErr.message);
    }
  }
}

// 2. Ensure frontend is on latest main branch
try {
  execSync('git checkout main && git pull origin main', {
    cwd: frontendDir,
    stdio: 'ignore',
  });
} catch {
  // Ignored if detached HEAD or offline
}

// 3. Build shared package
try {
  console.log('[vercel-build] Building shared package...');
  execSync('pnpm --filter @ph-ponto/shared build', {
    cwd: rootDir,
    stdio: 'inherit',
  });
} catch (e) {
  console.warn('[vercel-build] Shared package build note:', e.message);
}

// 4. Install & Build frontend directly
console.log('[vercel-build] Building frontend with Vite...');
execSync('pnpm install --no-frozen-lockfile && pnpm build', {
  cwd: frontendDir,
  stdio: 'inherit',
});

// 5. Populate root dist, public, and renderer
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
