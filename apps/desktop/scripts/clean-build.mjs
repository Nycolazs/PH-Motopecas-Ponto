import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const targets = {
  electron: ['../dist/main', '../dist/preload', '../dist/shared'],
  renderer: ['../dist/renderer'],
};

const target = process.argv[2];
if (!(target in targets)) {
  throw new Error('Expected the build cleanup target to be "electron" or "renderer".');
}

await Promise.all(
  targets[target].map((relativePath) =>
    rm(fileURLToPath(new URL(relativePath, import.meta.url)), { recursive: true, force: true }),
  ),
);
