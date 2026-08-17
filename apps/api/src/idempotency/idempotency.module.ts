import { Module } from '@nestjs/common';

import { IdempotencyHasherService } from './idempotency-hasher.service.js';
import { IdempotencyKeyPipe } from './idempotency-key.pipe.js';
import { IdempotencyService } from './idempotency.service.js';
import { MutationLockService } from './mutation-lock.service.js';

@Module({
  providers: [
    IdempotencyHasherService,
    IdempotencyKeyPipe,
    IdempotencyService,
    MutationLockService,
  ],
  exports: [IdempotencyKeyPipe, IdempotencyService, MutationLockService],
})
export class IdempotencyModule {}
