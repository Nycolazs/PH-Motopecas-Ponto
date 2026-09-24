import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

import pg from 'pg';

import { integrationDatabaseTarget, validateLocalDatabaseUrl } from './local-targets.mjs';

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

async function ensureDatabaseExists(databaseUrl, databaseName) {
  validateLocalDatabaseUrl(databaseUrl, { testOnly: true });
  const maintenanceUrl = new URL(databaseUrl);
  maintenanceUrl.pathname = '/postgres';
  maintenanceUrl.searchParams.delete('schema');

  const client = new pg.Client({ connectionString: maintenanceUrl.toString() });
  await client.connect();

  try {
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      databaseName,
    ]);

    if (existing.rowCount === 0) {
      // The allow-list above makes this identifier interpolation safe. PostgreSQL does not
      // support CREATE DATABASE with a bind parameter.
      await client.query(`CREATE DATABASE "${databaseName}"`);
    }
  } finally {
    await client.end();
  }
}

async function resetIntegrationSchema(databaseUrl) {
  validateLocalDatabaseUrl(databaseUrl, { testOnly: true });

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    await client.query('CREATE SCHEMA public');
  } finally {
    await client.end();
  }
}

function runCommand(command, arguments_, environment) {
  return new Promise((resolve, reject) => {
    const executable = process.platform === 'win32' ? `${command}.cmd` : command;
    const child = spawn(executable, arguments_, {
      env: environment,
      stdio: 'inherit',
    });

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

const { databaseName, value: databaseUrl } = integrationDatabaseTarget(process.env);
const uploadDirectory = await mkdtemp(join(tmpdir(), 'ph-ponto-integration-'));
const environment = {
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: databaseUrl,
  API_BASE_URL: 'http://127.0.0.1:3333',
  JWT_SECRET: 'test-access-secret-with-at-least-32-characters',
  JWT_REFRESH_SECRET: 'test-refresh-secret-with-at-least-32-characters',
  INITIAL_ADMIN_USERNAME: 'admin',
  INITIAL_ADMIN_PASSWORD: 'test-bootstrap-password',
  UPLOAD_DIR: uploadDirectory,
  SWAGGER_ENABLED: 'false',
  AUTH_LOGIN_MAX_ATTEMPTS: '3',
  APP_TIMEZONE: 'America/Sao_Paulo',
};

try {
  await ensureDatabaseExists(databaseUrl, databaseName);
  await resetIntegrationSchema(databaseUrl);
  await runCommand('prisma', ['generate'], environment);
  await runCommand('prisma', ['migrate', 'deploy'], environment);
  await runCommand('vitest', ['run', '--config', 'vitest.integration.config.ts'], environment);
} finally {
  // Only this run's freshly allocated temporary upload directory is removed.
  await rm(uploadDirectory, { recursive: true, force: true });
}
