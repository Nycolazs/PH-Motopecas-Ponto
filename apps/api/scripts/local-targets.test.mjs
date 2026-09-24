import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import {
  assertLocalApiUrl,
  assertLocalMode,
  integrationDatabaseTarget,
  validateLocalDatabaseUrl,
} from './local-targets.mjs';

const databaseUrl = 'postgresql://local:fixture@127.0.0.1:55432/ph_ponto?schema=public';

test('derives a separate test database without changing credentials, port or schema', () => {
  const result = integrationDatabaseTarget({ DATABASE_URL: databaseUrl });
  assert.equal(result.databaseName, 'ph_ponto_test');
  assert.equal(result.value, databaseUrl.replace('/ph_ponto?', '/ph_ponto_test?'));
});

test('does not append a second test suffix and honors an explicit local test database', () => {
  const testUrl = databaseUrl.replace('/ph_ponto?', '/ph_ponto_test?');
  assert.equal(integrationDatabaseTarget({ DATABASE_URL: testUrl }).value, testUrl);
  assert.equal(
    integrationDatabaseTarget({ TEST_DATABASE_URL: testUrl }).databaseName,
    'ph_ponto_test',
  );
});

test('allows only PostgreSQL loopback targets with the public schema', () => {
  for (const host of ['127.0.0.1', 'localhost', '[::1]']) {
    assert.equal(
      validateLocalDatabaseUrl(`postgresql://local@${host}:55432/ph_ponto_test`, {
        testOnly: true,
      }).databaseName,
      'ph_ponto_test',
    );
  }
  for (const value of [
    'postgresql://local@database.example/ph_ponto_test',
    'postgresql://local@localhost.example/ph_ponto_test',
    'postgresql://local@192.168.1.2/ph_ponto_test',
    'postgresql://local@127.0.0.1/ph_ponto_test?host=database.example',
    'postgresql://local@127.0.0.1/ph_ponto_test?hostaddr=192.168.1.2',
    'postgresql://local@127.0.0.1/ph_ponto_test?options=-c%20search_path=other',
    'postgresql://local@127.0.0.1/ph_ponto_test?schema=other',
    'postgresql://local@127.0.0.1/ph_ponto_test?schema=public&schema=public',
    'postgresql://local@127.0.0.1/ph_ponto_test#other',
    'https://127.0.0.1/ph_ponto_test',
  ]) {
    assert.throws(() => validateLocalDatabaseUrl(value, { testOnly: true }));
  }
});

test('refuses non-test, system, unsafe and truncated database names before cleanup', () => {
  for (const name of [
    'ph_ponto',
    'postgres',
    'template0',
    'template1',
    '',
    '_test',
    'ph-ponto_test',
    'ph_ponto_test%2Fother',
    'ph_ponto%22_test',
    'ph_ponto%00_test',
    `${'a'.repeat(59)}_test`,
  ]) {
    assert.throws(() =>
      validateLocalDatabaseUrl(`postgresql://local@127.0.0.1/${name}`, { testOnly: true }),
    );
  }
});

test('production and remote source databases cannot derive destructive test targets', () => {
  assert.throws(() => assertLocalMode({ NODE_ENV: 'production' }));
  assert.throws(() => assertLocalMode({ NODE_ENV: ' Production ' }));
  assert.throws(() =>
    integrationDatabaseTarget({ NODE_ENV: 'production', TEST_DATABASE_URL: databaseUrl }),
  );
  assert.throws(() =>
    integrationDatabaseTarget({ DATABASE_URL: 'postgresql://local@database.example/ph_ponto' }),
  );
  assert.throws(() => integrationDatabaseTarget({ TEST_DATABASE_URL: databaseUrl }));
});

test('invalid URL errors never repeat credential input', () => {
  assert.throws(() => validateLocalDatabaseUrl('private-secret@not-a-url'), {
    message: 'Database target must be a valid URL.',
  });
});

test('API dependencies of local helpers also require loopback HTTP without credentials', () => {
  assert.doesNotThrow(() => assertLocalApiUrl('http://127.0.0.1:3000'));
  assert.doesNotThrow(() => assertLocalApiUrl('http://localhost:3000'));
  for (const value of [
    'https://api.example',
    'http://username:password@127.0.0.1',
    'file:///tmp/api',
  ]) {
    assert.throws(() => assertLocalApiUrl(value));
  }
});

test('both entrypoints reject production before spawning database tools', () => {
  for (const script of ['run-local-database-command.mjs', 'run-integration-tests.mjs']) {
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(new URL(script, import.meta.url)), 'migrate'],
      { env: { ...process.env, NODE_ENV: 'production' }, encoding: 'utf8' },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /cannot run with NODE_ENV=production/);
    assert.doesNotMatch(result.stdout, /Datasource|migrations|Applying migration/);
  }
});

test('both entrypoints reject a remote test-named database before opening a connection', () => {
  for (const script of ['run-local-database-command.mjs', 'run-integration-tests.mjs']) {
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(new URL(script, import.meta.url)), 'migrate'],
      {
        env: {
          ...process.env,
          NODE_ENV: 'test',
          DATABASE_URL: 'postgresql://fixture:private-value@database.example/ph_ponto_test',
          TEST_DATABASE_URL: 'postgresql://fixture:private-value@database.example/ph_ponto_test',
        },
        encoding: 'utf8',
      },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /only accept literal loopback hosts/);
    assert.doesNotMatch(result.stderr, /private-value|ENOTFOUND|ECONNREFUSED/);
    assert.doesNotMatch(result.stdout, /Datasource|migrations|Applying migration/);
  }
});
