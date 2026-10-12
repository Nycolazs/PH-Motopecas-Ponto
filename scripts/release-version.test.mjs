import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const versionOf = (path) => JSON.parse(read(path)).version;

test('every workspace package is released with the same version', () => {
  const root = versionOf('package.json');
  for (const path of [
    'apps/api/package.json',
    'apps/desktop/package.json',
    'packages/shared/package.json',
  ]) {
    assert.equal(versionOf(path), root, `${path} must match the root version`);
  }
});

test('the admin downloads page links to the installers of the current release', () => {
  // The version comes from apps/desktop/package.json at build time, never typed by hand.
  const page = read('apps/desktop/src/renderer/pages/admin/downloads-page.tsx');
  assert.match(page, /const CURRENT_VERSION = __DESKTOP_VERSION__;/);
  for (const config of ['apps/desktop/vite.config.ts', 'apps/desktop/vitest.config.ts']) {
    const source = read(config);
    assert.match(source, /readFileSync\(new URL\('\.\/package\.json', import\.meta\.url\)/);
    assert.match(source, /__DESKTOP_VERSION__: JSON\.stringify\(desktopVersion\)/);
  }
});
