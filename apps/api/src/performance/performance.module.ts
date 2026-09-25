import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { CompanyModule } from '../company/company.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { PerformanceController } from './performance.controller.js';
import { PerformanceService } from './performance.service.js';

@Module({
  imports: [DatabaseModule, AuditModule, CompanyModule],
  controllers: [PerformanceController],
  providers: [PerformanceService],
  exports: [PerformanceService],
})
export class PerformanceModule {}
