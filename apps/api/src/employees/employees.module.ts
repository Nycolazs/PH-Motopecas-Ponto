import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { JobRolesModule } from '../job-roles/job-roles.module.js';
import { UsersModule } from '../users/users.module.js';
import { EmployeesController } from './employees.controller.js';
import { EmployeesService } from './employees.service.js';

@Module({
  imports: [AuthModule, UsersModule, JobRolesModule],
  controllers: [EmployeesController],
  providers: [EmployeesService],
})
export class EmployeesModule {}
