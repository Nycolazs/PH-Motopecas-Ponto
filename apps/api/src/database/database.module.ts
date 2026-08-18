import { Global, Module } from '@nestjs/common';

import { BootstrapAdminService } from './bootstrap-admin.service.js';
import { PrismaService } from './prisma.service.js';

@Global()
@Module({
  providers: [PrismaService, BootstrapAdminService],
  exports: [PrismaService, BootstrapAdminService],
})
export class DatabaseModule {}
