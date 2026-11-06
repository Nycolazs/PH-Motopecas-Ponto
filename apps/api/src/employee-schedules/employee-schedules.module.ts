import { Module } from '@nestjs/common';

import { attendanceClockProvider } from '../attendance/attendance-clock.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { EmployeeSchedulesController } from './employee-schedules.controller.js';
import { EmployeeSchedulesService } from './employee-schedules.service.js';

@Module({
  imports: [DatabaseModule, AuthModule, AuditModule],
  controllers: [EmployeeSchedulesController],
  providers: [attendanceClockProvider, EmployeeSchedulesService],
  exports: [EmployeeSchedulesService],
})
export class EmployeeSchedulesModule {}
