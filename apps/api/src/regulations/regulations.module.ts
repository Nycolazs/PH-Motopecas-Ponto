import { Module } from '@nestjs/common';

import { CompanyModule } from '../company/company.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { RegulationsController } from './regulations.controller.js';
import { RegulationsService } from './regulations.service.js';

@Module({
  imports: [DatabaseModule, CompanyModule],
  controllers: [RegulationsController],
  providers: [RegulationsService],
  exports: [RegulationsService],
})
export class RegulationsModule {}
