import { Module } from '@nestjs/common';

import { AttendanceModule } from '../attendance/attendance.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { IdempotencyModule } from '../idempotency/idempotency.module.js';
import { EffectiveTimePunchService } from './effective-time-punch.service.js';
import { timePunchClockProvider } from './clock.js';
import { TIME_PUNCH_CLOCK } from './clock.js';
import { TimePunchController } from './time-punch.controller.js';
import { TimePunchService } from './time-punch.service.js';

@Module({
  imports: [AttendanceModule, AuditModule, IdempotencyModule],
  controllers: [TimePunchController],
  providers: [timePunchClockProvider, EffectiveTimePunchService, TimePunchService],
  exports: [TIME_PUNCH_CLOCK, EffectiveTimePunchService, TimePunchService],
})
export class TimePunchesModule {}
