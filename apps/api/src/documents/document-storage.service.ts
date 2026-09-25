import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { isAbsolute, normalize, relative, resolve } from 'node:path';
import type { Readable } from 'node:stream';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { EnvironmentVariables } from '../config/environment.js';
import { DOCUMENTS_STORAGE_SUBDIR } from './documents.constants.js';

export interface StoredArtifactMetadata {
  id: string;
  storagePath: string;
  fileSize: number;
  checksumSha256: string;
  mimeType: string;
}

@Injectable()
export class DocumentStorageService {
  private readonly documentsDirectory: string;

  public constructor(
    @Inject(ConfigService) configService: ConfigService<EnvironmentVariables, true>,
  ) {
    const uploadRoot = resolve(configService.get('UPLOAD_DIR', { infer: true }));
    this.documentsDirectory = resolve(uploadRoot, DOCUMENTS_STORAGE_SUBDIR);
  }

  private async ensureDirectory(): Promise<void> {
    await mkdir(this.documentsDirectory, { recursive: true });
  }

  private resolveSafePath(filenameOrPath: string): string {
    const target = isAbsolute(filenameOrPath)
      ? normalize(filenameOrPath)
      : resolve(this.documentsDirectory, filenameOrPath);

    const rel = relative(this.documentsDirectory, target);
    if (rel.startsWith('..') || isAbsolute(rel)) {
      throw new NotFoundException({
        code: 'INVALID_STORAGE_PATH',
        message: 'Caminho de armazenamento inválido.',
      });
    }

    return target;
  }

  public async saveArtifact(buffer: Buffer, existingId?: string): Promise<StoredArtifactMetadata> {
    await this.ensureDirectory();

    const id = existingId ?? randomUUID();
    const filename = `${id}.pdf`;
    const targetPath = resolve(this.documentsDirectory, filename);

    const checksumSha256 = createHash('sha256').update(buffer).digest('hex');
    await writeFile(targetPath, buffer);

    return {
      id,
      storagePath: filename,
      fileSize: buffer.length,
      checksumSha256,
      mimeType: 'application/pdf',
    };
  }

  public async getArtifactBuffer(storagePath: string): Promise<Buffer> {
    const resolvedPath = this.resolveSafePath(storagePath);
    try {
      return await readFile(resolvedPath);
    } catch {
      throw new NotFoundException({
        code: 'ARTIFACT_NOT_FOUND',
        message: 'Arquivo PDF não encontrado no armazenamento.',
      });
    }
  }

  public getArtifactStream(storagePath: string): Readable {
    const resolvedPath = this.resolveSafePath(storagePath);
    return createReadStream(resolvedPath);
  }

  public async getArtifactSize(storagePath: string): Promise<number> {
    const resolvedPath = this.resolveSafePath(storagePath);
    try {
      const stats = await stat(resolvedPath);
      return stats.size;
    } catch {
      throw new NotFoundException({
        code: 'ARTIFACT_NOT_FOUND',
        message: 'Arquivo PDF não encontrado.',
      });
    }
  }

  public async deleteArtifact(storagePath: string): Promise<void> {
    const resolvedPath = this.resolveSafePath(storagePath);
    try {
      await unlink(resolvedPath);
    } catch {
      // Ignored if file does not exist
    }
  }
}
