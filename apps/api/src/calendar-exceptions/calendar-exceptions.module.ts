import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { CalendarExceptionResolverService } from './calendar-exception-resolver.service.js';
import { CalendarExceptionsController } from './calendar-exceptions.controller.js';
import { CalendarExceptionsService } from './calendar-exceptions.service.js';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [CalendarExceptionsController],
  providers: [CalendarExceptionsService, CalendarExceptionResolverService],
  exports: [CalendarExceptionResolverService],
})
export class CalendarExceptionsModule {}
