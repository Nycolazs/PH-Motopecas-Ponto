import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { businessDateFromInstant } from '@ph-ponto/shared';

import { detectImageMimeType } from '../avatars/image-utils.js';
import { decodeDocumentsEncryptionKey } from '../config/documents-encryption-key.js';
import type { EnvironmentVariables } from '../config/environment.js';
import { decryptDocument, encryptDocument } from '../documents/document-storage.service.js';

/** Folder under UPLOAD_DIR: justifications/<yyyy>/<mm>/<attachment id>.enc */
export const JUSTIFICATIONS_STORAGE_SUBDIR = 'justifications';

export type AttachmentMimeType = 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';

/** Real file type from its first bytes; the name or the browser's claim is never trusted. */
export function detectAttachmentMimeType(contents: Buffer): AttachmentMimeType | null {
  const image = detectImageMimeType(contents);
  if (image !== null) return image;
  return contents.subarray(0, 5).toString('latin1') === '%PDF-' ? 'application/pdf' : null;
}

export interface StoredAttachment {
  id: string;
  storagePath: string;
  byteSize: number;
  checksumSha256: string;
}

/**
 * Stores atestado photos/PDFs encrypted with the same AES-256-GCM key as the document
 * archive (DOCUMENTS_ENCRYPTION_KEY), bound to the attachment id.
 */
@Injectable()
export class JustificationAttachmentStorageService {
  private readonly directory: string;
  private readonly key: Buffer;

  public constructor(
    @Inject(ConfigService) configService: ConfigService<EnvironmentVariables, true>,
  ) {
    this.directory = resolve(
      resolve(configService.get('UPLOAD_DIR', { infer: true })),
      JUSTIFICATIONS_STORAGE_SUBDIR,
    );
    this.key = decodeDocumentsEncryptionKey(
      configService.get('DOCUMENTS_ENCRYPTION_KEY', { infer: true }),
    );
  }

  private resolveSafePath(storagePath: string): string {
    const target = resolve(this.directory, storagePath);
    const rel = relative(this.directory, target);
    if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) {
      throw new NotFoundException({
        code: 'INVALID_STORAGE_PATH',
        message: 'Caminho de armazenamento inválido.',
      });
    }
    return target;
  }

  public async save(contents: Buffer, now: Date): Promise<StoredAttachment> {
    const id = randomUUID();
    const [year, month] = businessDateFromInstant(now).split('-');
    const storagePath = `${year}/${month}/${id}.enc`;
    const target = this.resolveSafePath(storagePath);
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    const temporary = `${target}.${randomUUID()}.tmp`;
    await writeFile(temporary, encryptDocument(this.key, id, contents), { mode: 0o600 });
    await rename(temporary, target);
    return {
      id,
      storagePath,
      byteSize: contents.length,
      checksumSha256: createHash('sha256').update(contents).digest('hex'),
    };
  }

  /** Removes a file whose database record could not be written. */
  public async discard(storagePath: string): Promise<void> {
    await unlink(this.resolveSafePath(storagePath)).catch(() => undefined);
  }

  public async read(attachment: {
    id: string;
    storagePath: string;
    checksumSha256: string;
  }): Promise<Buffer> {
    let payload: Buffer;
    try {
      payload = await readFile(this.resolveSafePath(attachment.storagePath));
    } catch {
      throw new NotFoundException({
        code: 'ATTACHMENT_FILE_NOT_FOUND',
        message: 'O arquivo do atestado não foi encontrado no servidor.',
      });
    }
    let contents: Buffer;
    try {
      contents = decryptDocument(this.key, attachment.id, payload);
    } catch {
      throw new InternalServerErrorException({
        code: 'ATTACHMENT_DECRYPTION_FAILED',
        message: 'Não foi possível abrir o arquivo. Verifique a chave de criptografia.',
      });
    }
    if (createHash('sha256').update(contents).digest('hex') !== attachment.checksumSha256) {
      throw new InternalServerErrorException({
        code: 'ATTACHMENT_INTEGRITY_FAILED',
        message: 'O arquivo armazenado não confere com o registro original.',
      });
    }
    return contents;
  }
}
