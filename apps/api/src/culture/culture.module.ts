import { Module } from '@nestjs/common';
import { CompanyModule } from '../company/company.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { CultureController } from './culture.controller.js';
import { CultureService } from './culture.service.js';

@Module({
  imports: [DatabaseModule, CompanyModule],
  controllers: [CultureController],
  providers: [CultureService],
  exports: [CultureService],
})
export class CultureModule {}
