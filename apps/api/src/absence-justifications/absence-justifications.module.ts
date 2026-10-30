import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { AbsenceJustificationsController } from './absence-justifications.controller.js';
import { AbsenceJustificationsService } from './absence-justifications.service.js';
import { JustificationAttachmentStorageService } from './justification-attachment-storage.service.js';

@Module({
  imports: [DatabaseModule, AuthModule, AuditModule],
  controllers: [AbsenceJustificationsController],
  providers: [AbsenceJustificationsService, JustificationAttachmentStorageService],
})
export class AbsenceJustificationsModule {}
