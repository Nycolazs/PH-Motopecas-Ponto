import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';

import { type EnvironmentVariables } from '../config/environment.js';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  public constructor(
    @Inject(ConfigService) configService: ConfigService<EnvironmentVariables, true>,
  ) {
    const adapter = new PrismaPg({
      connectionString: configService.get('DATABASE_URL', { infer: true }),
      connectionTimeoutMillis: configService.get('DATABASE_CONNECTION_TIMEOUT_MS', {
        infer: true,
      }),
      max: configService.get('DATABASE_POOL_MAX', { infer: true }),
      options: '-c timezone=UTC',
    });

    super({ adapter });
  }

  public async ping(): Promise<void> {
    await this.$queryRaw`SELECT 1`;
  }

  public async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
