import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const compose = readFileSync(new URL('../docker-compose.yml', import.meta.url), 'utf8');

test('the API container receives the proxy settings from .env', () => {
  // Behind the Cloudflare Tunnel the real client address (used in audit logs) only
  // reaches the API when the tunnel is a trusted proxy.
  assert.match(compose, /^\s+TRUST_PROXY_ADDRESSES: \$\{TRUST_PROXY_ADDRESSES:-/m);
});

test('there is no login lockout configuration (removed at the owner request)', () => {
  assert.doesNotMatch(compose, /AUTH_LOGIN_/);
});
