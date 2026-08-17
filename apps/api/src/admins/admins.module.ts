import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';
import { AdminsController } from './admins.controller.js';
import { AdminsService } from './admins.service.js';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [AdminsController],
  providers: [AdminsService],
})
export class AdminsModule {}
