import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { JobRolesModule } from '../job-roles/job-roles.module.js';
import { UsersModule } from '../users/users.module.js';
import { EmployeesController } from './employees.controller.js';
import { EmployeesService } from './employees.service.js';
import { EmploymentEventsService } from '../employment-events/employment-events.service.js';
import { EmployeeTimelineService } from '../employee-timeline/employee-timeline.service.js';

@Module({
  imports: [AuthModule, UsersModule, JobRolesModule, AuditModule],
  controllers: [EmployeesController],
  providers: [EmployeesService, EmploymentEventsService, EmployeeTimelineService],
  exports: [EmployeesService, EmploymentEventsService, EmployeeTimelineService],
})
export class EmployeesModule {}
