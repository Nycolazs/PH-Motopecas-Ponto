import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { access, mkdir, open, rm, type FileHandle } from 'node:fs/promises';
import { resolve } from 'node:path';

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { EnvironmentVariables } from '../config/environment.js';

@Injectable()
export class StorageReadinessService {
  private readonly uploadDirectory: string;

  public constructor(
    @Inject(ConfigService) configService: ConfigService<EnvironmentVariables, true>,
  ) {
    this.uploadDirectory = resolve(configService.get('UPLOAD_DIR', { infer: true }));
  }

  public async ping(): Promise<void> {
    await mkdir(this.uploadDirectory, { recursive: true, mode: 0o750 });
    await access(this.uploadDirectory, constants.R_OK | constants.W_OK);

    const probePath = resolve(
      this.uploadDirectory,
      `.ph-ponto-readiness-${process.pid}-${randomUUID()}`,
    );
    let probe: FileHandle | undefined;

    try {
      probe = await open(probePath, 'wx', 0o600);
      await probe.writeFile('ok', 'utf8');
      await probe.sync();
    } finally {
      try {
        await probe?.close();
      } finally {
        await rm(probePath, { force: true });
      }
    }
  }
}
