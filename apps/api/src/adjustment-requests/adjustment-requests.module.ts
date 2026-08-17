import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { IdempotencyModule } from '../idempotency/idempotency.module.js';
import { TimeAdjustmentsModule } from '../time-adjustments/time-adjustments.module.js';
import { TimePunchesModule } from '../time-punches/time-punches.module.js';
import { AdjustmentRequestsController } from './adjustment-requests.controller.js';
import { AdjustmentRequestsService } from './adjustment-requests.service.js';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    AuditModule,
    IdempotencyModule,
    TimePunchesModule,
    TimeAdjustmentsModule,
  ],
  controllers: [AdjustmentRequestsController],
  providers: [AdjustmentRequestsService],
  exports: [AdjustmentRequestsService],
})
export class AdjustmentRequestsModule {}
