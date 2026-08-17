import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import { AUTH_CLOCK, AUTH_CONFIGURATION } from './auth.constants.js';
import type { AuthClock } from './clock.js';
import { withSerializableRetry } from './prisma-retry.js';
import type { AuthConfiguration } from './auth.types.js';

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1_000);
}

@Injectable()
export class LoginRateLimiterService {
  public constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AUTH_CONFIGURATION) private readonly configuration: AuthConfiguration,
    @Inject(AUTH_CLOCK) private readonly clock: AuthClock,
  ) {}

  /**
   * Atomically reserves one login attempt for every supplied privacy-preserving bucket.
   * The current attempt is allowed when it reaches the threshold; later attempts are blocked.
   */
  public async consume(bucketHashes: readonly string[]): Promise<void> {
    const uniqueBuckets = [...new Set(bucketHashes)].sort();
    const now = this.clock();
    const allowed = await withSerializableRetry(() =>
      this.prisma.$transaction(
        async (transaction) => {
          for (const keyHash of uniqueBuckets) {
            const existing = await transaction.loginThrottle.findUnique({ where: { keyHash } });

            if (existing?.blockedUntil !== null && existing?.blockedUntil !== undefined) {
              if (existing.blockedUntil.getTime() > now.getTime()) {
                return false;
              }
            }

            const windowExpired =
              existing === null ||
              now.getTime() - existing.windowStartedAt.getTime() >=
                this.configuration.loginWindowSeconds * 1_000;
            const attempts = windowExpired ? 1 : existing.attempts + 1;
            const blockedUntil =
              attempts >= this.configuration.loginMaxAttempts
                ? addSeconds(now, this.configuration.loginBlockSeconds)
                : null;

            await transaction.loginThrottle.upsert({
              where: { keyHash },
              create: { keyHash, attempts, windowStartedAt: now, blockedUntil },
              update: {
                attempts,
                ...(windowExpired ? { windowStartedAt: now } : {}),
                blockedUntil,
              },
            });
          }

          return true;
        },
        { isolationLevel: 'Serializable' },
      ),
    );

    if (!allowed) {
      throw new HttpException(
        {
          code: 'LOGIN_RATE_LIMITED',
          message: 'Muitas tentativas. Tente novamente em instantes.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  public async clear(bucketHashes: readonly string[]): Promise<void> {
    await this.prisma.loginThrottle.deleteMany({
      where: { keyHash: { in: [...new Set(bucketHashes)] } },
    });
  }
}
