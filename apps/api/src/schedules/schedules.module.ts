import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { scheduleClockProvider } from './schedule-clock.js';
import { ScheduleResolverService } from './schedule-resolver.service.js';
import { SchedulesController } from './schedules.controller.js';
import { SchedulesService } from './schedules.service.js';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [SchedulesController],
  providers: [scheduleClockProvider, SchedulesService, ScheduleResolverService],
  exports: [ScheduleResolverService],
})
export class SchedulesModule {}
