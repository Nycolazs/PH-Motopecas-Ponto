import { spawn } from 'node:child_process';
import process from 'node:process';

const DEVELOPMENT_DEFAULTS = Object.freeze({
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://ph_ponto:ph_ponto_dev@127.0.0.1:55432/ph_ponto?schema=public',
  API_BASE_URL: 'http://localhost:3000',
  JWT_SECRET: 'development-access-secret-change-before-production',
  JWT_REFRESH_SECRET: 'development-refresh-secret-change-before-production',
  INITIAL_ADMIN_USERNAME: 'admin',
  INITIAL_ADMIN_PASSWORD: 'development-bootstrap-password-change-me',
  UPLOAD_DIR: './data/uploads',
});

try {
  process.loadEnvFile?.('.env');
} catch {
  // Optional local environment file
}
try {
  process.loadEnvFile?.('../../.env');
} catch {
  // Optional root environment file
}

function localEnvironment() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'The local database helper is disabled in production. Provide explicit configuration and use db:migrate:deploy.',
    );
  }

  return { ...DEVELOPMENT_DEFAULTS, ...process.env };
}

function runCommand(command, arguments_, environment) {
  return new Promise((resolve, reject) => {
    const executable = process.platform === 'win32' ? `${command}.cmd` : command;
    const child = spawn(executable, arguments_, { env: environment, stdio: 'inherit' });

    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (signal !== null) {
        reject(new Error(`${command} stopped after receiving ${signal}.`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`${command} exited with code ${String(code)}.`));
        return;
      }

      resolve();
    });
  });
}

const operation = process.argv[2];
const environment = localEnvironment();

if (operation === 'migrate') {
  await runCommand('prisma', ['migrate', 'deploy'], environment);
} else if (operation === 'seed') {
  await runCommand('prisma', ['generate'], environment);
  await runCommand('tsx', ['src/database/seed.ts'], environment);
} else {
  throw new Error('Expected the local database operation "migrate" or "seed".');
}
