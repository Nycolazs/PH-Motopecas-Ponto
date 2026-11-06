import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const png = (path) => readFileSync(new URL(`../packages/shared/brand/${path}`, import.meta.url));
const size = (buffer) => ({ width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) });

test('the brand ships a logo and a square icon big enough for every desktop installer', () => {
  const logo = png('logo.png');
  const icon = png('icon.png');
  const signature = '89504e470d0a1a0a';
  assert.equal(logo.subarray(0, 8).toString('hex'), signature, 'logo.png must be a PNG');
  assert.equal(icon.subarray(0, 8).toString('hex'), signature, 'icon.png must be a PNG');
  const { width, height } = size(icon);
  assert.equal(width, height, 'icon.png must be square');
  assert.ok(width >= 512, 'icon.png must be at least 512x512 (macOS and Windows installers)');
});

test('the brand file declares every field the build reads', () => {
  const source = readFileSync(new URL('../packages/shared/src/brand.ts', import.meta.url), 'utf8');
  for (const key of ['productName', 'companyName', 'clockLabel', 'appId', 'artifactPrefix']) {
    assert.match(source, new RegExp(`${key}: '[^']+'`), `brand.ts must set ${key}`);
  }
});
