import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'ph-ponto-build-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const relativePath of ['scripts/copy-web-dist.mjs', 'apps/desktop/scripts/copy-dist.mjs']) {
    const destination = join(root, relativePath);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(new URL(`../${relativePath}`, import.meta.url), destination);
  }
  return root;
}

function write(root, relativePath, content) {
  const destination = join(root, relativePath);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, content);
}

test('web distribution contains only fresh renderer assets and preserves source/public files', (t) => {
  const root = fixture(t);
  write(root, 'apps/desktop/dist/renderer/index.html', '<html>renderer</html>');
  write(root, 'apps/desktop/dist/renderer/assets/app.js', 'renderer');
  write(root, 'apps/desktop/dist/main/index.js', 'private-main-process');
  write(root, 'dist/assets/stale.js', 'stale');
  write(root, 'public/index.html', 'tracked-public');
  write(root, 'apps/desktop/renderer/index.html', 'legacy-renderer');

  execFileSync(process.execPath, [join(root, 'scripts/copy-web-dist.mjs')]);

  assert.equal(readFileSync(join(root, 'dist/index.html'), 'utf8'), '<html>renderer</html>');
  assert.equal(readFileSync(join(root, 'dist/assets/app.js'), 'utf8'), 'renderer');
  assert.equal(existsSync(join(root, 'dist/assets/stale.js')), false);
  assert.equal(existsSync(join(root, 'dist/main')), false);
  assert.equal(readFileSync(join(root, 'public/index.html'), 'utf8'), 'tracked-public');
  assert.equal(
    readFileSync(join(root, 'apps/desktop/renderer/index.html'), 'utf8'),
    'legacy-renderer',
  );
});

test('missing renderer fails before replacing a previously generated distribution', (t) => {
  const root = fixture(t);
  write(root, 'dist/index.html', 'previous-build');

  assert.throws(() =>
    execFileSync(process.execPath, [join(root, 'scripts/copy-web-dist.mjs')], { stdio: 'pipe' }),
  );

  assert.equal(readFileSync(join(root, 'dist/index.html'), 'utf8'), 'previous-build');
});

test('static assets are copied only into the ignored renderer output', (t) => {
  const root = fixture(t);
  write(root, 'apps/desktop/dist/renderer/index.html', '<html>renderer</html>');
  write(root, 'apps/desktop/src/renderer/assets/app-icon.png', 'official-icon');
  write(root, 'apps/desktop/src/renderer/assets/phmotos-logo.png', 'official-logo');

  execFileSync(process.execPath, [join(root, 'apps/desktop/scripts/copy-dist.mjs')]);

  assert.equal(
    readFileSync(join(root, 'apps/desktop/dist/renderer/assets/app-icon.png'), 'utf8'),
    'official-icon',
  );
  assert.equal(
    readFileSync(join(root, 'apps/desktop/dist/renderer/assets/phmotos-logo.png'), 'utf8'),
    'official-logo',
  );
  assert.equal(existsSync(join(root, 'apps/desktop/renderer')), false);
  assert.equal(existsSync(join(root, 'public')), false);
});
