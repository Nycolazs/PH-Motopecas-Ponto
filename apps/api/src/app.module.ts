import { Module, RequestMethod, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AdjustmentRequestsModule } from './adjustment-requests/adjustment-requests.module.js';
import { AdminsModule } from './admins/admins.module.js';
import { AttendanceModule } from './attendance/attendance.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AvatarsModule } from './avatars/avatars.module.js';
import { CalendarExceptionsModule } from './calendar-exceptions/calendar-exceptions.module.js';
import { validateEnvironment } from './config/environment.js';
import { DatabaseModule } from './database/database.module.js';
import { EmployeesModule } from './employees/employees.module.js';
import { HealthModule } from './health/health.module.js';
import { RequestIdMiddleware } from './http/request-id.js';
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
