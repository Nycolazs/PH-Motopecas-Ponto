import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { HealthResponse } from '@ph-ponto/shared';

import type { EnvironmentVariables } from '../config/environment.js';
import { PrismaService } from '../database/prisma.service.js';
import { StorageReadinessService } from '../storage/storage-readiness.service.js';

@Injectable()
export class HealthService {
  public constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StorageReadinessService) private readonly storage: StorageReadinessService,
    @Inject(ConfigService) private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  public liveness(): HealthResponse {
    return this.response('ok');
  }

  public async readiness(): Promise<HealthResponse> {
    try {
      await this.withTimeout(
        this.checkDependencies(),
        this.config.get('READINESS_TIMEOUT_MS', { infer: true }),
      );
      return this.response('ok');
    } catch {
      return this.response('degraded');
    }
  }

  private response(status: HealthResponse['status']): HealthResponse {
    return {
      status,
      service: 'api',
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDependencies(): Promise<void> {
    const results = await Promise.allSettled([this.prisma.ping(), this.storage.ping()]);

    if (results.some((result) => result.status === 'rejected')) {
      throw new Error('A readiness dependency is unavailable.');
    }
  }

  private async withTimeout(
    operation: Promise<unknown>,
    timeoutMilliseconds: number,
  ): Promise<void> {
    let timeout: NodeJS.Timeout | undefined;

    try {
      await Promise.race([
        operation,
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(
            () => reject(new Error('Readiness check timed out.')),
            timeoutMilliseconds,
          );
        }),
      ]);
    } finally {
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
    }
  }
}
