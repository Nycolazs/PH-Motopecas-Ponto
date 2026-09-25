import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { AcknowledgmentsController } from './acknowledgments.controller.js';
import { AcknowledgmentsService } from './acknowledgments.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [AcknowledgmentsController],
  providers: [AcknowledgmentsService],
  exports: [AcknowledgmentsService],
})
export class AcknowledgmentsModule {}
