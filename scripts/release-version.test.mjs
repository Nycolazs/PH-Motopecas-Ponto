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
  const desktop = versionOf('apps/desktop/package.json');
  const page = read('apps/desktop/src/renderer/pages/admin/downloads-page.tsx');
  assert.match(page, new RegExp(`CURRENT_VERSION = '${desktop.replace(/\./g, '\\.')}'`));
});
