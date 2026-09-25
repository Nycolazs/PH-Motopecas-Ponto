import { Module, RequestMethod, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AcknowledgmentsModule } from './acknowledgments/acknowledgments.module.js';
import { AdjustmentRequestsModule } from './adjustment-requests/adjustment-requests.module.js';
import { AdminsModule } from './admins/admins.module.js';
import { AttendanceModule } from './attendance/attendance.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AvatarsModule } from './avatars/avatars.module.js';
import { CalendarExceptionsModule } from './calendar-exceptions/calendar-exceptions.module.js';
import { CompanyModule } from './company/company.module.js';
import { validateEnvironment } from './config/environment.js';
import { CultureModule } from './culture/culture.module.js';
import { DatabaseModule } from './database/database.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { EmployeesModule } from './employees/employees.module.js';
import { HealthModule } from './health/health.module.js';
import { RequestIdMiddleware } from './http/request-id.js';
import { InterviewsModule } from './interviews/interviews.module.js';
import { JobRolesModule } from './job-roles/job-roles.module.js';
import { DisciplineModule } from './discipline/discipline.module.js';
import { PerformanceModule } from './performance/performance.module.js';
import { RegulationsModule } from './regulations/regulations.module.js';
import { SchedulesModule } from './schedules/schedules.module.js';
import { StorageModule } from './storage/storage.module.js';
import { TimeAdjustmentsModule } from './time-adjustments/time-adjustments.module.js';
import { TimePunchesModule } from './time-punches/time-punches.module.js';
import { UsersModule } from './users/users.module.js';
import { VacationsModule } from './vacations/vacations.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env', '../.env'],
      validate: validateEnvironment,
    }),
    DatabaseModule,
    StorageModule,
    AuditModule,
    AuthModule,
    AvatarsModule,
    UsersModule,
    EmployeesModule,
    AdminsModule,
    CompanyModule,
    JobRolesModule,
    DocumentsModule,
    CultureModule,
    RegulationsModule,
    InterviewsModule,
    AcknowledgmentsModule,
    DisciplineModule,
    PerformanceModule,
    SchedulesModule,
    CalendarExceptionsModule,
    AttendanceModule,
    TimePunchesModule,
    TimeAdjustmentsModule,
    AdjustmentRequestsModule,
    VacationsModule,
    HealthModule,
  ],
})
export class AppModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
