import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('the web image serves the renderer build output, not the nginx placeholder', () => {
  const viteConfig = read('apps/desktop/vite.config.ts');
  const dockerfile = read('apps/desktop/Dockerfile');
  const outDir = /outDir: fileURLToPath\(new URL\('\.\/([^']+)'/.exec(viteConfig)?.[1];
  assert.ok(outDir, 'vite outDir must be declared');
  assert.match(
    dockerfile,
    new RegExp(
      `COPY --from=build /app/apps/desktop/${outDir.replace(/\//g, '\\/')} /usr/share/nginx/html`,
    ),
  );
});

test('the web server sends ES module workers (pdf.js) with a JavaScript MIME type', () => {
  const nginx = read('apps/desktop/nginx.conf');
  const mjsBlock = nginx.slice(nginx.indexOf('location ~* \\.mjs$'));
  assert.ok(nginx.includes('location ~* \\.mjs$'), 'a dedicated .mjs location exists');
  assert.match(mjsBlock.slice(0, 300), /default_type text\/javascript;/);
});
