import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const compose = readFileSync(new URL('../docker-compose.yml', import.meta.url), 'utf8');

test('the API container receives the proxy and login throttling settings from .env', () => {
  // Without these, production behind the Cloudflare Tunnel sees one shared client address
  // and a single person's failed logins lock everyone out.
  for (const name of [
    'TRUST_PROXY_ADDRESSES',
    'AUTH_LOGIN_MAX_ATTEMPTS',
    'AUTH_LOGIN_IP_MAX_ATTEMPTS',
    'AUTH_LOGIN_BLOCK_SECONDS',
  ]) {
    assert.match(compose, new RegExp(`^\\s+${name}: \\$\\{${name}:-`, 'm'), name);
  }
});
