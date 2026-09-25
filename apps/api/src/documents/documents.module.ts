import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { CompanyModule } from '../company/company.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { DocumentDraftsController } from './document-drafts.controller.js';
import { DocumentDraftsService } from './document-drafts.service.js';
import { DocumentStorageService } from './document-storage.service.js';
import { DocumentTemplatesService } from './document-templates.service.js';
import { DocumentsController } from './documents.controller.js';
import { DocumentsService } from './documents.service.js';
import { PdfRendererService } from './pdf-renderer.service.js';
import { RenderJobsService } from './render-jobs.service.js';

@Module({
  imports: [DatabaseModule, AuditModule, AuthModule, CompanyModule],
  controllers: [DocumentDraftsController, DocumentsController],
  providers: [
    DocumentStorageService,
    PdfRendererService,
    DocumentTemplatesService,
    RenderJobsService,
    DocumentDraftsService,
    DocumentsService,
  ],
  exports: [
    DocumentStorageService,
    PdfRendererService,
    DocumentTemplatesService,
    RenderJobsService,
    DocumentDraftsService,
    DocumentsService,
  ],
})
export class DocumentsModule {}
