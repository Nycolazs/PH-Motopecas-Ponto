import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Build the checked-out workspace and locked dependencies; never fetch another source tree.
execFileSync('pnpm', ['build:web'], {
  cwd: fileURLToPath(new URL('../', import.meta.url)),
  stdio: 'inherit',
});
