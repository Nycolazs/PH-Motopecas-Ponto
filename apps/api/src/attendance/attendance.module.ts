import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { CalendarExceptionsModule } from '../calendar-exceptions/calendar-exceptions.module.js';
import { SchedulesModule } from '../schedules/schedules.module.js';
import { ATTENDANCE_SUMMARY_RESOLVER } from '../time-punches/attendance-summary.port.js';
import { AdminAttendanceController, AttendanceController } from './attendance.controller.js';
import { attendanceClockProvider } from './attendance-clock.js';
import { AttendanceService } from './attendance.service.js';

@Module({
  imports: [AuthModule, SchedulesModule, CalendarExceptionsModule],
  controllers: [AttendanceController, AdminAttendanceController],
  providers: [
    attendanceClockProvider,
    AttendanceService,
    { provide: ATTENDANCE_SUMMARY_RESOLVER, useExisting: AttendanceService },
  ],
  exports: [AttendanceService, ATTENDANCE_SUMMARY_RESOLVER],
})
export class AttendanceModule {}
