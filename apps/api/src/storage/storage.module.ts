import { Global, Module } from '@nestjs/common';

import { StorageReadinessService } from './storage-readiness.service.js';

@Global()
@Module({
  providers: [StorageReadinessService],
  exports: [StorageReadinessService],
})
export class StorageModule {}
