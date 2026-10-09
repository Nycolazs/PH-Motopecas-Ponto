import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AuditModule } from '../audit/audit.module.js';
import type { EnvironmentVariables } from '../config/environment.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService, WHATSAPP_GATEWAY } from './notifications.service.js';
import { WhatsappGateway } from './whatsapp-gateway.js';

@Module({
  imports: [AuditModule],
  controllers: [NotificationsController],
  providers: [
    {
      provide: WHATSAPP_GATEWAY,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) =>
        new WhatsappGateway({
          baseUrl: config.get('OPENWA_BASE_URL', { infer: true }),
          apiKey: config.get('OPENWA_API_KEY', { infer: true }),
        }),
    },
    NotificationsService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
