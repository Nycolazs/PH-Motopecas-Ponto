import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { load } from 'js-yaml';

const directory = resolve(process.argv[2] ?? 'release');
const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const entries = await readdir(directory);
const manifests = entries.filter((name) => /^latest(?:-mac|-linux)?\.yml$/.test(name));
assert.ok(manifests.length > 0, 'Missing auto-update manifest');

async function digest(filename, algorithm, encoding) {
  const hash = createHash(algorithm);
  for await (const chunk of createReadStream(resolve(directory, filename))) hash.update(chunk);
  return hash.digest(encoding);
}

const artifactNames = new Set();
for (const manifest of manifests) {
  const data = load(await readFile(resolve(directory, manifest), 'utf8'));
  assert.equal(data.version, version, `${manifest}: incorrect version`);
  assert.ok(data.files?.length > 0, `${manifest}: no downloadable artifacts`);
  for (const file of data.files) {
    const filename = decodeURIComponent(file.url);
    assert.equal(basename(filename), filename, 'Artifact must be a local filename');
    assert.ok(filename.includes(version), `${filename}: incorrect version`);
    const size = (await stat(resolve(directory, filename))).size;
    assert.equal(file.size, size, `${filename}: size mismatch`);
    assert.equal(
      file.sha512,
      await digest(filename, 'sha512', 'base64'),
      `${filename}: checksum mismatch`,
    );
    artifactNames.add(filename);
  }
  const legacyFile = data.files.find((file) => file.url === data.path);
  assert.ok(legacyFile, `${manifest}: legacy updater path is missing`);
  assert.equal(data.sha512, legacyFile.sha512, `${manifest}: legacy checksum mismatch`);
}

const expected =
  {
    win32: [`PH-Ponto-Setup-${version}.exe`, `PH-Ponto-Setup-${version}.exe.blockmap`],
    darwin: ['arm64', 'x64'].flatMap((arch) =>
      ['dmg', 'zip'].map((extension) => `PH-Ponto-${version}-${arch}.${extension}`),
    ),
    linux: [`PH-Ponto-${version}-amd64.deb`, `PH-Ponto-${version}-x86_64.AppImage`],
  }[process.platform] ?? [];
for (const filename of expected) {
  assert.ok((await stat(resolve(directory, filename))).size > 0, `Missing ${filename}`);
  artifactNames.add(filename);
}

const checksums = [];
for (const filename of [...artifactNames].sort()) {
  checksums.push(`${await digest(filename, 'sha256', 'hex')}  ${filename}`);
}
await writeFile(
  resolve(directory, `SHA256SUMS-${process.platform}.txt`),
  checksums.join('\n') + '\n',
);
console.log(
  `Verified ${manifests.length} update manifests and ${artifactNames.size} artifacts for PH-Ponto ${version}.`,
);
