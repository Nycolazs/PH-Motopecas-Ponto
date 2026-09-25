import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { CompanyModule } from '../company/company.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { DisciplineController } from './discipline.controller.js';
import { DisciplineService } from './discipline.service.js';

@Module({
  imports: [DatabaseModule, AuditModule, CompanyModule],
  controllers: [DisciplineController],
  providers: [DisciplineService],
  exports: [DisciplineService],
})
export class DisciplineModule {}
