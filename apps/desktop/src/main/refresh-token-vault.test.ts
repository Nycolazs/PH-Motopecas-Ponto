// @vitest-environment node

import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it } from 'vitest';

import { RefreshTokenVault, type TokenEncryption } from './refresh-token-vault.js';

const refreshToken =
  '487d962c-c34d-486b-83be-c1aac9772f9d.ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopq';
const temporaryDirectories: string[] = [];

async function vaultPath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'ph-ponto-vault-test-'));
  temporaryDirectories.push(directory);
  return join(directory, 'auth-refresh-token.vault');
}

function reversibleEncryption(available = true): TokenEncryption {
  return {
    isAvailable: () => available,
    encrypt: (value) => Buffer.from([...value].reverse().join(''), 'utf8'),
    decrypt: (value) => [...value.toString('utf8')].reverse().join(''),
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe('RefreshTokenVault', () => {
  it('persists only encrypted bytes with restrictive permissions and restores them', async () => {
    const path = await vaultPath();
    const vault = new RefreshTokenVault(path, reversibleEncryption());

    await expect(vault.store(refreshToken)).resolves.toBe('ENCRYPTED');
    const persisted = await readFile(path);
    expect(persisted.toString('utf8')).not.toContain(refreshToken);
    if (process.platform !== 'win32') {
      expect((await stat(path)).mode & 0o777).toBe(0o600);
    }

    const restored = new RefreshTokenVault(path, reversibleEncryption());
    await expect(restored.load()).resolves.toBe(refreshToken);
    expect(restored.persistence()).toBe('ENCRYPTED');
  });

  it('uses memory only and leaves no file when secure encryption is unavailable', async () => {
    const path = await vaultPath();
    const vault = new RefreshTokenVault(path, reversibleEncryption(false));

    await expect(vault.store(refreshToken)).resolves.toBe('MEMORY_ONLY');
    await expect(vault.load()).resolves.toBe(refreshToken);
    await expect(stat(path)).rejects.toMatchObject({ code: 'ENOENT' });

    const restarted = new RefreshTokenVault(path, reversibleEncryption(false));
    await expect(restarted.load()).resolves.toBeUndefined();
  });

  it('refuses to persist when an encryption adapter returns plaintext', async () => {
    const path = await vaultPath();
    const vault = new RefreshTokenVault(path, {
      isAvailable: () => true,
      encrypt: (value) => Buffer.from(value, 'utf8'),
      decrypt: (value) => value.toString('utf8'),
    });

    await expect(vault.store(refreshToken)).resolves.toBe('MEMORY_ONLY');
    await expect(vault.load()).resolves.toBe(refreshToken);
    await expect(stat(path)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('fails safely to memory when encryption capability detection throws', async () => {
    const path = await vaultPath();
    const vault = new RefreshTokenVault(path, {
      isAvailable: () => {
        throw new Error('keychain unavailable');
      },
      encrypt: () => {
        throw new Error('must not encrypt');
      },
      decrypt: () => {
        throw new Error('must not decrypt');
      },
    });

    await expect(vault.store(refreshToken)).resolves.toBe('MEMORY_ONLY');
    expect(vault.persistence()).toBe('MEMORY_ONLY');
    await expect(vault.load()).resolves.toBe(refreshToken);
  });

  it('rejects and removes a corrupt persisted credential', async () => {
    const path = await vaultPath();
    await writeFile(path, 'not-a-valid-encrypted-refresh-token', { mode: 0o600 });
    const vault = new RefreshTokenVault(path, reversibleEncryption());

    await expect(vault.load()).resolves.toBeUndefined();
    await expect(stat(path)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('clears both memory and the encrypted file', async () => {
    const path = await vaultPath();
    const vault = new RefreshTokenVault(path, reversibleEncryption());
    await vault.store(refreshToken);

    await vault.clear();

    await expect(vault.load()).resolves.toBeUndefined();
    await expect(stat(path)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
