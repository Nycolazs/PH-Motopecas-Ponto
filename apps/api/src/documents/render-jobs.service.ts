import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type {
  AcknowledgmentRegulationPayloadDto,
  AcknowledgmentRolePayloadDto,
  CulturePayloadDto,
  DisciplineSuspensionPayloadDto,
  DisciplineVerbalPayloadDto,
  DisciplineWrittenPayloadDto,
  InterviewPayloadDto,
  PerformanceReviewPayloadDto,
  RegulationPayloadDto,
  RoleMapPayloadDto,
} from '@ph-ponto/shared';
import { CompanyService } from '../company/company.service.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  DocumentType,
  RenderJobStatus,
  type DocumentArtifact,
  type RenderJob,
} from '../generated/prisma/client.js';
import { MAXIMUM_RENDER_JOB_ATTEMPTS, RENDER_JOB_LEASE_SECONDS } from './documents.constants.js';
import { DocumentStorageService } from './document-storage.service.js';
import { DocumentTemplatesService } from './document-templates.service.js';
import { PdfRendererService } from './pdf-renderer.service.js';

@Injectable()
export class RenderJobsService {
  private readonly logger = new Logger(RenderJobsService.name);

  public constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CompanyService) private readonly companyService: CompanyService,
    @Inject(DocumentStorageService) private readonly storage: DocumentStorageService,
    @Inject(DocumentTemplatesService) private readonly templates: DocumentTemplatesService,
    @Inject(PdfRendererService) private readonly pdfRenderer: PdfRendererService,
  ) {}

  public async createJob(
    documentType: DocumentType,
    payload: Record<string, unknown>,
    draftId?: string,
  ): Promise<RenderJob> {
    return this.prisma.renderJob.create({
      data: {
        documentType,
        payload: payload as object,
        draftId: draftId ?? null,
        status: RenderJobStatus.PENDING,
      },
    });
  }

  public async executeJob(jobId: string): Promise<DocumentArtifact> {
    const job = await this.prisma.renderJob.findUnique({
      where: { id: jobId },
      include: { draft: true },
    });

    if (!job) {
      throw new NotFoundException({
        code: 'RENDER_JOB_NOT_FOUND',
        message: 'Trabalho de renderização não encontrado.',
      });
    }

    const leaseUntil = new Date(Date.now() + RENDER_JOB_LEASE_SECONDS * 1000);
    await this.prisma.renderJob.update({
      where: { id: jobId },
      data: {
        status: RenderJobStatus.PROCESSING,
        leasedAt: new Date(),
        leasedUntil: leaseUntil,
        attempts: { increment: 1 },
      },
    });

    try {
      const companyDto = await this.companyService.getCompany();
      const company = await this.prisma.company.findUniqueOrThrow({
        where: { id: companyDto.id },
      });

      let html: string;

      switch (job.documentType) {
        case DocumentType.CULTURE: {
          const payload = job.payload as unknown as CulturePayloadDto;
          const versionNumber = job.draft?.revision ?? 1;
          html = this.templates.renderCultureDocument(company, payload, versionNumber);
          break;
        }
        case DocumentType.REGULATION: {
          const payload = job.payload as unknown as RegulationPayloadDto;
          const versionNumber = job.draft?.revision ?? 1;
          html = this.templates.renderRegulationDocument(company, payload, versionNumber);
          break;
        }
        case DocumentType.ROLE_MAP: {
          const payload = job.payload as unknown as RoleMapPayloadDto;
          const versionNumber = job.draft?.revision ?? 1;
          html = this.templates.renderRoleMapDocument(company, payload, versionNumber);
          break;
        }
        case DocumentType.INTERVIEW: {
          const payload = job.payload as unknown as InterviewPayloadDto;
          html = this.templates.renderInterviewDocument(company, payload);
          break;
        }
        case DocumentType.ACKNOWLEDGMENT_REGULATION: {
          const payload = job.payload as unknown as AcknowledgmentRegulationPayloadDto;
          html = this.templates.renderAcknowledgmentRegulationDocument(company, payload);
          break;
        }
        case DocumentType.ACKNOWLEDGMENT_ROLE: {
          const payload = job.payload as unknown as AcknowledgmentRolePayloadDto;
          html = this.templates.renderAcknowledgmentRoleDocument(company, payload);
          break;
        }
        case DocumentType.DISCIPLINE_VERBAL: {
          const payload = job.payload as unknown as DisciplineVerbalPayloadDto;
          html = this.templates.renderDisciplineVerbalDocument(company, payload);
          break;
        }
        case DocumentType.DISCIPLINE_WRITTEN: {
          const payload = job.payload as unknown as DisciplineWrittenPayloadDto;
          html = this.templates.renderDisciplineWrittenDocument(company, payload);
          break;
        }
        case DocumentType.DISCIPLINE_SUSPENSION: {
          const payload = job.payload as unknown as DisciplineSuspensionPayloadDto;
          html = this.templates.renderDisciplineSuspensionDocument(company, payload);
          break;
        }
        case DocumentType.PERFORMANCE_REVIEW: {
          const payload = job.payload as unknown as PerformanceReviewPayloadDto;
          html = this.templates.renderPerformanceReviewDocument(company, payload);
          break;
        }
        default:
          throw new BadRequestException({
            code: 'UNSUPPORTED_DOCUMENT_TYPE',
            message: `Tipo de documento ${job.documentType} não suportado para renderização.`,
          });
      }

      const pdfBuffer = await this.pdfRenderer.renderHtmlToPdf(html);
      const stored = await this.storage.saveArtifact(pdfBuffer);

      const artifact = await this.prisma.documentArtifact.create({
        data: {
          id: stored.id,
          storagePath: stored.storagePath,
          fileSize: stored.fileSize,
          mimeType: stored.mimeType,
          checksumSha256: stored.checksumSha256,
        },
      });

      await this.prisma.renderJob.update({
        where: { id: jobId },
        data: {
          status: RenderJobStatus.COMPLETED,
          artifactId: artifact.id,
          leasedUntil: null,
        },
      });

      if (job.draftId) {
        await this.prisma.documentDraft.update({
          where: { id: job.draftId },
          data: {
            preparedArtifactId: artifact.id,
          },
        });
      }

      return artifact;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(`Render job ${jobId} failed: ${errorMessage}`, err);

      const isFinalAttempt = job.attempts + 1 >= MAXIMUM_RENDER_JOB_ATTEMPTS;

      await this.prisma.renderJob.update({
        where: { id: jobId },
        data: {
          status: isFinalAttempt ? RenderJobStatus.FAILED : RenderJobStatus.PENDING,
          error: errorMessage,
          leasedUntil: null,
        },
      });

      throw err;
    }
  }
}
