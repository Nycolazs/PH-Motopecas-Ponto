import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { dirname } from 'node:path';
import { chmod, mkdir, open, rename, unlink } from 'node:fs/promises';

import type { AuthPersistence } from '../shared/electron-api.js';
import { isRefreshToken } from './auth-contract.js';

const MAX_VAULT_BYTES = 16_384;
const PRIVATE_FILE_MODE = 0o600;
const PRIVATE_DIRECTORY_MODE = 0o700;

export interface TokenEncryption {
  isAvailable: () => boolean;
  encrypt: (value: string) => Buffer;
  decrypt: (value: Buffer) => string;
}

export class RefreshTokenVault {
  private memoryToken: string | undefined;
  private forcedMemoryOnly = false;

  public constructor(
    private readonly vaultPath: string,
    private readonly encryption: TokenEncryption,
  ) {}

  public persistence(): AuthPersistence {
    return !this.forcedMemoryOnly && this.encryptionAvailable() ? 'ENCRYPTED' : 'MEMORY_ONLY';
  }

  public async store(token: string): Promise<AuthPersistence> {
    if (!isRefreshToken(token)) {
      await this.clear();
      return 'MEMORY_ONLY';
    }

    this.memoryToken = token;
    this.forcedMemoryOnly = false;
    if (!this.encryptionAvailable()) {
      this.forcedMemoryOnly = true;
      await this.removePersisted();
      return 'MEMORY_ONLY';
    }

    try {
      const encrypted = this.encryption.encrypt(token);
      if (
        encrypted.byteLength === 0 ||
        encrypted.byteLength > MAX_VAULT_BYTES ||
        encrypted.includes(Buffer.from(token, 'utf8'))
      ) {
        throw new Error('Invalid encrypted refresh token size.');
      }
      await this.writePrivateFile(encrypted);
      return 'ENCRYPTED';
    } catch {
      this.forcedMemoryOnly = true;
      await this.removePersisted();
      return 'MEMORY_ONLY';
    }
  }

  public async load(): Promise<string | undefined> {
    if (this.memoryToken !== undefined) return this.memoryToken;
    if (!this.encryptionAvailable()) {
      this.forcedMemoryOnly = true;
      return undefined;
    }

    try {
      const encrypted = await this.readPrivateFile();
      const token = this.encryption.decrypt(encrypted);
      if (!isRefreshToken(token)) throw new Error('Invalid encrypted refresh token.');

      this.memoryToken = token;
      this.forcedMemoryOnly = false;
      return token;
    } catch {
      this.memoryToken = undefined;
      await this.removePersisted();
      return undefined;
    }
  }

  public async clear(): Promise<void> {
    this.memoryToken = undefined;
    await this.removePersisted();
  }

  private async writePrivateFile(value: Buffer): Promise<void> {
    const directory = dirname(this.vaultPath);
    await mkdir(directory, { recursive: true, mode: PRIVATE_DIRECTORY_MODE });
    const temporaryPath = `${this.vaultPath}.${randomUUID()}.tmp`;
    const noFollow = constants.O_NOFOLLOW ?? 0;

    try {
      const handle = await open(
        temporaryPath,
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollow,
        PRIVATE_FILE_MODE,
      );
      try {
        await handle.writeFile(value);
        await handle.sync();
        await handle.chmod(PRIVATE_FILE_MODE);
      } finally {
        await handle.close();
      }

      try {
        await rename(temporaryPath, this.vaultPath);
      } catch (error) {
        if (!isReplaceConflict(error)) throw error;
        await this.removePersisted();
        await rename(temporaryPath, this.vaultPath);
      }
      await chmod(this.vaultPath, PRIVATE_FILE_MODE);
    } finally {
      await unlink(temporaryPath).catch(ignoreMissingFile);
    }
  }

  private async readPrivateFile(): Promise<Buffer> {
    const noFollow = constants.O_NOFOLLOW ?? 0;
    const handle = await open(this.vaultPath, constants.O_RDONLY | noFollow);
    try {
      const stats = await handle.stat();
      if (!stats.isFile() || stats.size < 1 || stats.size > MAX_VAULT_BYTES) {
        throw new Error('Invalid refresh token vault file.');
      }
      await handle.chmod(PRIVATE_FILE_MODE);
      return await handle.readFile();
    } finally {
      await handle.close();
    }
  }

  private async removePersisted(): Promise<void> {
    await unlink(this.vaultPath).catch(ignoreMissingFile);
  }

  private encryptionAvailable(): boolean {
    try {
      return this.encryption.isAvailable();
    } catch {
      return false;
    }
  }
}

function ignoreMissingFile(error: unknown): void {
  if (isNodeError(error) && error.code === 'ENOENT') return;
  throw error;
}

function isReplaceConflict(error: unknown): boolean {
  return (
    isNodeError(error) &&
    (error.code === 'EEXIST' || error.code === 'EACCES' || error.code === 'EPERM')
  );
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error;
}
