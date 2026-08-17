import { spawn } from 'node:child_process';
import process from 'node:process';

import pg from 'pg';

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

const DEFAULT_INTEGRATION_DATABASE_URL = process.env.DATABASE_URL
  ? process.env.DATABASE_URL.replace(/\/([a-zA-Z0-9_]+)(\?|$)/, '/$1_test$2')
  : 'postgresql://ph_ponto:ph_ponto_dev@127.0.0.1:55432/ph_ponto_test?schema=public';

function integrationDatabaseUrl() {
  const value = process.env.TEST_DATABASE_URL ?? DEFAULT_INTEGRATION_DATABASE_URL;
  const parsed = new URL(value);
  const databaseName = decodeURIComponent(parsed.pathname.slice(1));

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Integration tests cannot run with NODE_ENV=production.');
  }

  if (!/^[a-zA-Z0-9_]+_test$/.test(databaseName)) {
    throw new Error(
      `Refusing to prepare non-test database "${databaseName}". The name must end in _test.`,
    );
  }

  return { databaseName, value };
}

async function ensureDatabaseExists(databaseUrl, databaseName) {
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
  const parsed = new URL(databaseUrl);
  const configuredSchema = parsed.searchParams.get('schema') ?? 'public';
  if (configuredSchema !== 'public') {
    throw new Error('Integration tests only reset the isolated public schema.');
  }

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

const { databaseName, value: databaseUrl } = integrationDatabaseUrl();
const environment = {
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: databaseUrl,
  SWAGGER_ENABLED: 'false',
  AUTH_LOGIN_MAX_ATTEMPTS: '3',
  APP_TIMEZONE: 'America/Fortaleza',
};

await ensureDatabaseExists(databaseUrl, databaseName);
await resetIntegrationSchema(databaseUrl);
await runCommand('prisma', ['generate'], environment);
await runCommand('prisma', ['migrate', 'deploy'], environment);
await runCommand('vitest', ['run', '--config', 'vitest.integration.config.ts'], environment);
