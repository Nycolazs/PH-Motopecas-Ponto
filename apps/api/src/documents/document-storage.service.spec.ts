import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  decryptDocument,
  DocumentStorageService,
  encryptDocument,
  ENCRYPTED_FILE_MAGIC,
} from './document-storage.service.js';

const KEY_HEX = 'ab'.repeat(32);
const PDF = Buffer.from('%PDF-1.7\nConteúdo confidencial do colaborador\n%%EOF');

function createService(uploadDir: string, key = KEY_HEX): DocumentStorageService {
  const values: Record<string, string> = { UPLOAD_DIR: uploadDir, DOCUMENTS_ENCRYPTION_KEY: key };
  return new DocumentStorageService({ get: (name: string) => values[name] } as never);
}

describe('DocumentStorageService', () => {
  let uploadDir: string;
  let storage: DocumentStorageService;

  beforeEach(async () => {
    uploadDir = await mkdtemp(join(tmpdir(), 'ph-ponto-docs-'));
    storage = createService(uploadDir);
  });

  afterEach(async () => {
    await rm(uploadDir, { recursive: true, force: true });
  });

  it('never writes the PDF in plain text and reads it back intact', async () => {
    const stored = await storage.savePreview(PDF);

    expect(stored.storagePath).toBe(`previews/${stored.id}.pdf.enc`);
    const onDisk = await readFile(join(uploadDir, 'documents', stored.storagePath));
    expect(onDisk.subarray(0, ENCRYPTED_FILE_MAGIC.length)).toEqual(ENCRYPTED_FILE_MAGIC);
    expect(onDisk.includes(Buffer.from('%PDF'))).toBe(false);
    expect(onDisk.includes(Buffer.from('confidencial'))).toBe(false);
    expect((await stat(join(uploadDir, 'documents', stored.storagePath))).mode & 0o777).toBe(0o600);

    expect(stored.checksumSha256).toBe(createHash('sha256').update(PDF).digest('hex'));
    await expect(storage.readArtifact(stored)).resolves.toEqual(PDF);
  });

  it('moves confirmed PDFs to the archive by São Paulo month', async () => {
    const stored = await storage.savePreview(PDF);
    // 02:00 UTC on Oct 1st is still September 30th in São Paulo.
    const archived = await storage.moveToArchive(
      stored.id,
      stored.storagePath,
      new Date('2026-10-01T02:00:00.000Z'),
    );

    expect(archived).toBe(`archive/2026/09/${stored.id}.pdf.enc`);
    await expect(storage.readArtifact({ ...stored, storagePath: archived })).resolves.toEqual(PDF);
    await expect(storage.moveToArchive(stored.id, archived, new Date())).resolves.toBe(archived);
  });

  it('refuses a file moved onto another artifact or opened with another key', async () => {
    const stored = await storage.savePreview(PDF);

    await expect(
      storage.readArtifact({ ...stored, id: '00000000-0000-4000-8000-000000000000' }),
    ).rejects.toMatchObject({ response: { code: 'ARTIFACT_DECRYPTION_FAILED' } });
    await expect(
      createService(uploadDir, 'cd'.repeat(32)).readArtifact(stored),
    ).rejects.toMatchObject({ response: { code: 'ARTIFACT_DECRYPTION_FAILED' } });
  });

  it('detects files that do not match the recorded checksum', async () => {
    const stored = await storage.savePreview(PDF);
    await expect(
      storage.readArtifact({ ...stored, checksumSha256: '0'.repeat(64) }),
    ).rejects.toMatchObject({ response: { code: 'ARTIFACT_INTEGRITY_FAILED' } });
  });

  it('encrypts legacy plain-text PDFs without losing them', async () => {
    const legacyPath = join(uploadDir, 'documents', 'legacy-id.pdf');
    await storage.ensureRootDirectory();
    await writeFile(legacyPath, PDF);

    const destination = 'archive/2026/01/legacy-id.pdf.enc';
    await storage.encryptLegacyFile('legacy-id', 'legacy-id.pdf', destination);
    const checksumSha256 = createHash('sha256').update(PDF).digest('hex');

    await expect(
      storage.readArtifact({ id: 'legacy-id', storagePath: destination, checksumSha256 }),
    ).resolves.toEqual(PDF);
    await expect(storage.deleteArtifact('legacy-id.pdf')).resolves.toBe(true);
    await expect(storage.deleteArtifact('legacy-id.pdf')).resolves.toBe(false);
  });

  it('rejects storage paths outside the documents folder', async () => {
    await expect(
      storage.readArtifact({ id: 'x', storagePath: '../../etc/passwd', checksumSha256: '' }),
    ).rejects.toMatchObject({ response: { code: 'INVALID_STORAGE_PATH' } });
  });

  it('round-trips the encryption helpers with authenticated data', () => {
    const key = Buffer.from(KEY_HEX, 'hex');
    const sealed = encryptDocument(key, 'artifact-a', PDF);
    expect(decryptDocument(key, 'artifact-a', sealed)).toEqual(PDF);
    expect(() => decryptDocument(key, 'artifact-b', sealed)).toThrow();
    expect(() => decryptDocument(key, 'artifact-a', PDF)).toThrow(/header/);
  });
});
