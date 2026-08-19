import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { VacationsController } from './vacations.controller.js';
import { VacationsService } from './vacations.service.js';

@Module({
  imports: [DatabaseModule, AuthModule, AuditModule],
  controllers: [VacationsController],
  providers: [VacationsService],
  exports: [VacationsService],
})
export class VacationsModule {}
