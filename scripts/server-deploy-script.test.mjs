import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';

const script = new URL('../ops/server/auto-deploy.sh', import.meta.url);

test('the production auto-deploy script is valid bash and executable', () => {
  execFileSync('bash', ['-n', script.pathname]);
  assert.ok(statSync(script).mode & 0o100, 'auto-deploy.sh must be executable');
});

test('a deploy is only recorded after the API and the web panel are healthy', () => {
  const source = readFileSync(script, 'utf8');
  const recorded = source.indexOf('>"$STATE_DIR/deployed-commit"');
  assert.ok(recorded > source.indexOf('Health.Status'), 'records after the API health check');
  assert.ok(recorded > source.indexOf('<title>PH-Ponto'), 'records after the web panel check');
  assert.match(source, /flock -n 9/);
});

test('the web panel check waits for nginx instead of trying once', () => {
  const source = readFileSync(script, 'utf8');
  const check = source.slice(source.indexOf('web_ok=""'), source.indexOf('[ -n "$web_ok" ]'));
  assert.match(check, /for _ in \$\(seq 1 \d+\)/);
  assert.match(check, /sleep \d/);
});
