import { Module } from '@nestjs/common';

import { AttendanceModule } from '../attendance/attendance.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { IdempotencyModule } from '../idempotency/idempotency.module.js';
import { TimePunchesModule } from '../time-punches/time-punches.module.js';
import { TimeAdjustmentController } from './time-adjustment.controller.js';
import { TimeAdjustmentService } from './time-adjustment.service.js';

@Module({
  imports: [AttendanceModule, AuditModule, IdempotencyModule, TimePunchesModule],
  controllers: [TimeAdjustmentController],
  providers: [TimeAdjustmentService],
  exports: [TimeAdjustmentService],
})
export class TimeAdjustmentsModule {}
