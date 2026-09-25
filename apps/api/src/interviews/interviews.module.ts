import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { InterviewsController } from './interviews.controller.js';
import { InterviewsService } from './interviews.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [InterviewsController],
  providers: [InterviewsService],
  exports: [InterviewsService],
})
export class InterviewsModule {}
