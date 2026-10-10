import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { businessDateFromInstant } from '@ph-ponto/shared';

import type { EnvironmentVariables } from '../config/environment.js';
import { decodeDocumentsEncryptionKey } from '../config/documents-encryption-key.js';
import { DOCUMENTS_STORAGE_SUBDIR } from './documents.constants.js';

export interface StoredArtifactMetadata {
  id: string;
  storagePath: string;
  fileSize: number;
  checksumSha256: string;
  mimeType: string;
}

/**
 * On-disk layout (relative to `UPLOAD_DIR/documents`):
 *   previews/<id>.pdf.enc            temporary PDFs shown before the admin confirms/prints
 *   archive/<yyyy>/<mm>/<id>.pdf.enc PDFs confirmed into the company archive
 *
 * Every file is encrypted with AES-256-GCM: MAGIC | IV (12) | AUTH TAG (16) | CIPHERTEXT.
 * The artifact id is bound as additional authenticated data, so a file copied onto
 * another artifact's path fails to decrypt instead of serving the wrong document.
 */
export const ENCRYPTED_FILE_MAGIC = Buffer.from('PHPDF1', 'ascii');
const IV_BYTES = 12;
const TAG_BYTES = 16;
const HEADER_BYTES = ENCRYPTED_FILE_MAGIC.length + IV_BYTES + TAG_BYTES;
export const PREVIEWS_FOLDER = 'previews';
export const ARCHIVE_FOLDER = 'archive';
const ENCRYPTED_EXTENSION = '.pdf.enc';

export function isArchivedStoragePath(storagePath: string): boolean {
  return storagePath.startsWith(`${ARCHIVE_FOLDER}/`);
}

export function isEncryptedStoragePath(storagePath: string): boolean {
  return storagePath.endsWith(ENCRYPTED_EXTENSION);
}

export function encryptDocument(key: Buffer, artifactId: string, plaintext: Buffer): Buffer {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(artifactId, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([ENCRYPTED_FILE_MAGIC, iv, cipher.getAuthTag(), ciphertext]);
}

export function decryptDocument(key: Buffer, artifactId: string, payload: Buffer): Buffer {
  if (
    payload.length < HEADER_BYTES ||
    !payload.subarray(0, ENCRYPTED_FILE_MAGIC.length).equals(ENCRYPTED_FILE_MAGIC)
  ) {
    throw new Error('Encrypted document header is missing.');
  }
  const ivStart = ENCRYPTED_FILE_MAGIC.length;
  const iv = payload.subarray(ivStart, ivStart + IV_BYTES);
  const tag = payload.subarray(ivStart + IV_BYTES, HEADER_BYTES);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(Buffer.from(artifactId, 'utf8'));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(payload.subarray(HEADER_BYTES)), decipher.final()]);
}

@Injectable()
export class DocumentStorageService {
  private readonly documentsDirectory: string;
  private readonly key: Buffer;

  public constructor(
    @Inject(ConfigService) configService: ConfigService<EnvironmentVariables, true>,
  ) {
    const uploadRoot = resolve(configService.get('UPLOAD_DIR', { infer: true }));
    this.documentsDirectory = resolve(uploadRoot, DOCUMENTS_STORAGE_SUBDIR);
    this.key = decodeDocumentsEncryptionKey(
      configService.get('DOCUMENTS_ENCRYPTION_KEY', { infer: true }),
    );
  }

  private resolveSafePath(storagePath: string): string {
    const target = resolve(this.documentsDirectory, storagePath);
    const rel = relative(this.documentsDirectory, target);
    if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) {
      throw new NotFoundException({
        code: 'INVALID_STORAGE_PATH',
        message: 'Caminho de armazenamento inválido.',
      });
    }
    return target;
  }

  private async writePrivateFile(storagePath: string, contents: Buffer): Promise<void> {
    const target = this.resolveSafePath(storagePath);
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    const temporary = `${target}.${randomUUID()}.tmp`;
    await writeFile(temporary, contents, { mode: 0o600 });
    await rename(temporary, target);
  }

  /** Encrypts and stores a freshly rendered PDF as a temporary preview. */
  public async savePreview(plaintext: Buffer): Promise<StoredArtifactMetadata> {
    const id = randomUUID();
    const storagePath = `${PREVIEWS_FOLDER}/${id}${ENCRYPTED_EXTENSION}`;
    await this.writePrivateFile(storagePath, encryptDocument(this.key, id, plaintext));
    return {
      id,
      storagePath,
      fileSize: plaintext.length,
      checksumSha256: createHash('sha256').update(plaintext).digest('hex'),
      mimeType: 'application/pdf',
    };
  }

  /** Archive location for an artifact confirmed at `confirmedAt` (São Paulo year/month). */
  public archivePathFor(artifactId: string, confirmedAt: Date): string {
    const [year, month] = businessDateFromInstant(confirmedAt).split('-');
    return `${ARCHIVE_FOLDER}/${year}/${month}/${artifactId}${ENCRYPTED_EXTENSION}`;
  }

  /** Moves a confirmed preview into the archive folder and returns its new path. */
  public async moveToArchive(
    artifactId: string,
    storagePath: string,
    confirmedAt: Date,
  ): Promise<string> {
    if (isArchivedStoragePath(storagePath)) return storagePath;
    const destination = this.archivePathFor(artifactId, confirmedAt);
    const target = this.resolveSafePath(destination);
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    await rename(this.resolveSafePath(storagePath), target);
    return destination;
  }

  /**
   * Writes an encrypted copy of a plaintext PDF stored by earlier versions. The caller
   * deletes the plaintext file only after the database points at the encrypted copy.
   */
  public async encryptLegacyFile(
    artifactId: string,
    legacyStoragePath: string,
    destination: string,
  ): Promise<void> {
    const plaintext = await readFile(this.resolveSafePath(legacyStoragePath));
    await this.writePrivateFile(destination, encryptDocument(this.key, artifactId, plaintext));
  }

  /** Reads and decrypts an artifact, verifying it against the recorded checksum. */
  public async readArtifact(artifact: {
    id: string;
    storagePath: string;
    checksumSha256: string;
  }): Promise<Buffer> {
    let payload: Buffer;
    try {
      payload = await readFile(this.resolveSafePath(artifact.storagePath));
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new NotFoundException({
        code: 'ARTIFACT_NOT_FOUND',
        message: 'Arquivo PDF não encontrado no armazenamento.',
      });
    }

    let plaintext: Buffer;
    try {
      plaintext = isEncryptedStoragePath(artifact.storagePath)
        ? decryptDocument(this.key, artifact.id, payload)
        : payload;
    } catch {
      throw new InternalServerErrorException({
        code: 'ARTIFACT_DECRYPTION_FAILED',
        message:
          'Não foi possível abrir o PDF armazenado. Verifique a chave de criptografia dos documentos.',
      });
    }

    const checksum = createHash('sha256').update(plaintext).digest('hex');
    if (checksum !== artifact.checksumSha256) {
      throw new InternalServerErrorException({
        code: 'ARTIFACT_INTEGRITY_FAILED',
        message: 'O PDF armazenado não confere com o registro original.',
      });
    }
    return plaintext;
  }

  /** Removes a stored file. Returns false when it was already gone. */
  public async deleteArtifact(storagePath: string): Promise<boolean> {
    try {
      await unlink(this.resolveSafePath(storagePath));
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw error;
    }
  }

  /** Restricts the documents directory to the API user. */
  public async ensureRootDirectory(): Promise<void> {
    await mkdir(this.documentsDirectory, { recursive: true, mode: 0o700 });
    await chmod(this.documentsDirectory, 0o700);
  }
}
