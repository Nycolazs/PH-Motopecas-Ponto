import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it } from 'vitest';

import type { EnvironmentVariables } from '../config/environment.js';
import { StorageReadinessService } from './storage-readiness.service.js';

const temporaryDirectories: string[] = [];

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'ph-ponto-storage-readiness-'));
  temporaryDirectories.push(directory);
  return directory;
}

function createService(uploadDirectory: string): StorageReadinessService {
  const configService = {
    get: () => uploadDirectory,
  } as unknown as ConfigService<EnvironmentVariables, true>;
  return new StorageReadinessService(configService);
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('StorageReadinessService', () => {
  it('probes read-write access without leaving a file', async () => {
    const parent = await createTemporaryDirectory();
    const uploadDirectory = join(parent, 'uploads');

    await createService(uploadDirectory).ping();

    expect(await readdir(uploadDirectory)).toEqual([]);
  });

  it('rejects a path that cannot be used as a directory', async () => {
    const parent = await createTemporaryDirectory();
    const filePath = join(parent, 'not-a-directory');
    await writeFile(filePath, 'content', 'utf8');

    await expect(createService(filePath).ping()).rejects.toThrow();
  });
});
