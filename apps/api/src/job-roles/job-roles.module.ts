import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { JobRolesController } from './job-roles.controller.js';
import { JobRolesService } from './job-roles.service.js';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [JobRolesController],
  providers: [JobRolesService],
  exports: [JobRolesService],
})
export class JobRolesModule {}
