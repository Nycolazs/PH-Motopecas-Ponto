import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  culturePayloadSchema,
  regulationPayloadSchema,
  roleMapPayloadSchema,
  interviewPayloadSchema,
  acknowledgmentRegulationPayloadSchema,
  acknowledgmentRolePayloadSchema,
  type RegulationPayloadDto,
  type InterviewPayloadDto,
  type AcknowledgmentRegulationPayloadDto,
  type AcknowledgmentRolePayloadDto,
} from '@ph-ponto/shared';
import { AuditService } from '../audit/audit.service.js';
import type { ClientContext } from '../auth/auth.types.js';
import { CompanyService } from '../company/company.service.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  AcknowledgmentType,
  AuditAction,
  AuditOutcome,
  AuditTargetType,
  DocumentType,
  type DocumentDraft,
} from '../generated/prisma/client.js';
import type {
  ConfirmDocumentDraftDto,
  DocumentDraftResponseDto,
  GeneratedDocumentResponseDto,
  PrepareDocumentDraftDto,
  SaveDocumentDraftDto,
} from './documents.dto.js';
import { RenderJobsService } from './render-jobs.service.js';

@Injectable()
export class DocumentDraftsService {
  public constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(CompanyService) private readonly companyService: CompanyService,
    @Inject(RenderJobsService) private readonly renderJobs: RenderJobsService,
  ) {}

  public async getDraft(
    authorId: string,
    documentType: DocumentType,
    employeeId?: string,
  ): Promise<DocumentDraftResponseDto | null> {
    const draft = await this.prisma.documentDraft.findFirst({
      where: {
        authorId,
        documentType,
        employeeId: employeeId ?? null,
      },
    });

    return draft ? this.serializeDraft(draft) : null;
  }

  public async getDraftById(authorId: string, id: string): Promise<DocumentDraftResponseDto> {
    const draft = await this.prisma.documentDraft.findUnique({
      where: { id },
    });

    if (!draft) {
      throw new NotFoundException({
        code: 'DRAFT_NOT_FOUND',
        message: 'Rascunho não encontrado.',
      });
    }

    if (draft.authorId !== authorId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_DRAFT_ACCESS',
        message: 'Você não tem permissão para acessar este rascunho.',
      });
    }

    return this.serializeDraft(draft);
  }

  public async saveDraft(
    authorId: string,
    input: SaveDocumentDraftDto,
    context: ClientContext,
  ): Promise<DocumentDraftResponseDto> {
    const employeeId = input.employeeId ?? null;

    const existing = await this.prisma.documentDraft.findFirst({
      where: {
        authorId,
        documentType: input.documentType,
        employeeId,
      },
    });

    if (existing) {
      if (input.expectedRevision !== undefined && input.expectedRevision !== existing.revision) {
        throw new ConflictException({
          code: 'DRAFT_CONFLICT',
          message:
            'O rascunho foi alterado por outra sessão ou aba. Por favor, recarregue para visualizar a versão mais recente.',
          currentRevision: existing.revision,
        });
      }

      const nextRevision = existing.revision + 1;
      const updated = await this.prisma.$transaction(async (tx) => {
        const saved = await tx.documentDraft.update({
          where: { id: existing.id },
          data: {
            title: input.title.trim(),
            payload: input.payload as object,
            revision: nextRevision,
            // Invalidate previously prepared artifact since payload changed
            preparedArtifactId: null,
          },
        });

        await this.audit.record(
          {
            actorId: authorId,
            action: AuditAction.DOCUMENT_DRAFT_SAVED,
            outcome: AuditOutcome.SUCCESS,
            targetType: AuditTargetType.DOCUMENT_DRAFT,
            targetId: saved.id,
            ...context,
            afterState: {
              documentType: saved.documentType,
              revision: saved.revision,
              title: saved.title,
            },
          },
          tx,
        );

        return saved;
      });

      return this.serializeDraft(updated);
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.documentDraft.create({
        data: {
          documentType: input.documentType,
          authorId,
          employeeId,
          revision: 1,
          title: input.title.trim(),
          payload: input.payload as object,
        },
      });

      await this.audit.record(
        {
          actorId: authorId,
          action: AuditAction.DOCUMENT_DRAFT_SAVED,
          outcome: AuditOutcome.SUCCESS,
          targetType: AuditTargetType.DOCUMENT_DRAFT,
          targetId: saved.id,
          ...context,
          afterState: {
            documentType: saved.documentType,
            revision: saved.revision,
            title: saved.title,
          },
        },
        tx,
      );

      return saved;
    });

    return this.serializeDraft(created);
  }

  public async discardDraft(
    authorId: string,
    id: string,
    context: ClientContext,
  ): Promise<{ success: boolean }> {
    const draft = await this.prisma.documentDraft.findUnique({
      where: { id },
    });

    if (!draft) {
      throw new NotFoundException({
        code: 'DRAFT_NOT_FOUND',
        message: 'Rascunho não encontrado.',
      });
    }

    if (draft.authorId !== authorId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_DRAFT_ACCESS',
        message: 'Você não tem permissão para descartar este rascunho.',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.documentDraft.delete({
        where: { id },
      });

      await this.audit.record(
        {
          actorId: authorId,
          action: AuditAction.DOCUMENT_DRAFT_DISCARDED,
          outcome: AuditOutcome.SUCCESS,
          targetType: AuditTargetType.DOCUMENT_DRAFT,
          targetId: id,
          ...context,
          beforeState: {
            documentType: draft.documentType,
            title: draft.title,
            revision: draft.revision,
          },
        },
        tx,
      );
    });

    return { success: true };
  }

  public async prepareDraft(
    authorId: string,
    id: string,
    input: PrepareDocumentDraftDto,
    context: ClientContext,
  ): Promise<DocumentDraftResponseDto> {
    const draft = await this.prisma.documentDraft.findUnique({
      where: { id },
    });

    if (!draft) {
      throw new NotFoundException({
        code: 'DRAFT_NOT_FOUND',
        message: 'Rascunho não encontrado.',
      });
    }

    if (draft.authorId !== authorId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_DRAFT_ACCESS',
        message: 'Você não tem permissão para preparar este rascunho.',
      });
    }

    if (draft.revision !== input.expectedRevision) {
      throw new ConflictException({
        code: 'DRAFT_CONFLICT',
        message: 'A revisão do rascunho mudou. Salve as alterações antes de preparar o documento.',
        currentRevision: draft.revision,
      });
    }

    // Complete schema validation before preparation
    this.validateCompletePayload(draft.documentType, draft.payload);

    // Create and execute render job
    const job = await this.renderJobs.createJob(
      draft.documentType,
      draft.payload as Record<string, unknown>,
      draft.id,
    );

    const artifact = await this.renderJobs.executeJob(job.id);

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.documentDraft.update({
        where: { id: draft.id },
        data: {
          preparedArtifactId: artifact.id,
        },
      });

      await this.audit.record(
        {
          actorId: authorId,
          action: AuditAction.DOCUMENT_PREPARED,
          outcome: AuditOutcome.SUCCESS,
          targetType: AuditTargetType.DOCUMENT_DRAFT,
          targetId: draft.id,
          ...context,
          afterState: {
            artifactId: artifact.id,
            revision: draft.revision,
          },
        },
        tx,
      );

      return saved;
    });

    return this.serializeDraft(updated);
  }

  public async confirmDraft(
    authorId: string,
    id: string,
    input: ConfirmDocumentDraftDto,
    context: ClientContext,
  ): Promise<GeneratedDocumentResponseDto> {
    const draft = await this.prisma.documentDraft.findUnique({
      where: { id },
      include: { author: true, employee: true },
    });

    if (!draft) {
      throw new NotFoundException({
        code: 'DRAFT_NOT_FOUND',
        message: 'Rascunho não encontrado.',
      });
    }

    if (draft.authorId !== authorId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_DRAFT_ACCESS',
        message: 'Você não tem permissão para confirmar este rascunho.',
      });
    }

    if (draft.revision !== input.expectedRevision) {
      throw new ConflictException({
        code: 'DRAFT_CONFLICT',
        message: 'A revisão do rascunho mudou. Prepare o documento novamente antes de confirmar.',
        currentRevision: draft.revision,
      });
    }

    if (!draft.preparedArtifactId || draft.preparedArtifactId !== input.preparedArtifactId) {
      throw new BadRequestException({
        code: 'ARTIFACT_MISMATCH',
        message:
          'O documento visualizado mudou ou não está preparado. Por favor, visualize novamente antes de confirmar.',
      });
    }

    const companyDto = await this.companyService.getCompany();

    // Atomic confirmation
    const generated = await this.prisma.$transaction(async (tx) => {
      // 1. Create GeneratedDocument
      const doc = await tx.generatedDocument.create({
        data: {
          documentType: draft.documentType,
          title: draft.title,
          companyId: companyDto.id,
          employeeId: draft.employeeId,
          authorId: draft.authorId,
          artifactId: draft.preparedArtifactId!,
          documentData: draft.payload as object,
          version: 1,
        },
        include: {
          author: true,
          employee: true,
          artifact: true,
        },
      });

      // 2. Domain-specific action
      if (draft.documentType === DocumentType.CULTURE) {
        let cultureProfile = await tx.cultureProfile.findUnique({
          where: { companyId: companyDto.id },
        });

        if (!cultureProfile) {
          cultureProfile = await tx.cultureProfile.create({
            data: { companyId: companyDto.id },
          });
        }

        const latestVersion = await tx.cultureProfileVersion.findFirst({
          where: { cultureProfileId: cultureProfile.id },
          orderBy: { versionNumber: 'desc' },
        });

        const nextVersionNumber = (latestVersion?.versionNumber ?? 0) + 1;
        const payload = draft.payload as {
          mission: string;
          vision: string;
          values: Array<{ title: string; description: string }>;
          motto?: string | null;
        };

        await tx.cultureProfileVersion.create({
          data: {
            cultureProfileId: cultureProfile.id,
            versionNumber: nextVersionNumber,
            mission: payload.mission,
            vision: payload.vision,
            values: payload.values as object,
            motto: payload.motto ?? null,
            generatedDocumentId: doc.id,
            createdById: authorId,
          },
        });

        await this.audit.record(
          {
            actorId: authorId,
            action: AuditAction.CULTURE_PROFILE_PUBLISHED,
            outcome: AuditOutcome.SUCCESS,
            targetType: AuditTargetType.CULTURE_PROFILE,
            targetId: cultureProfile.id,
            ...context,
            afterState: {
              versionNumber: nextVersionNumber,
              generatedDocumentId: doc.id,
            },
          },
          tx,
        );
      } else if (draft.documentType === DocumentType.REGULATION) {
        let regulation = await tx.companyRegulation.findUnique({
          where: { companyId: companyDto.id },
        });

        if (!regulation) {
          regulation = await tx.companyRegulation.create({
            data: { companyId: companyDto.id },
          });
        }

        const latestVersion = await tx.companyRegulationVersion.findFirst({
          where: { companyRegulationId: regulation.id },
          orderBy: { versionNumber: 'desc' },
        });

        const nextVersionNumber = (latestVersion?.versionNumber ?? 0) + 1;
        const payload = draft.payload as RegulationPayloadDto;

        await tx.companyRegulationVersion.create({
          data: {
            companyRegulationId: regulation.id,
            versionNumber: nextVersionNumber,
            title: payload.title,
            effectiveDate: new Date(`${payload.effectiveDate}T12:00:00Z`),
            content: payload as object,
            generatedDocumentId: doc.id,
            createdById: authorId,
          },
        });

        await this.audit.record(
          {
            actorId: authorId,
            action: AuditAction.REGULATION_PUBLISHED,
            outcome: AuditOutcome.SUCCESS,
            targetType: AuditTargetType.REGULATION,
            targetId: regulation.id,
            ...context,
            afterState: {
              versionNumber: nextVersionNumber,
              generatedDocumentId: doc.id,
            },
          },
          tx,
        );
      } else if (draft.documentType === DocumentType.INTERVIEW) {
        const payload = draft.payload as InterviewPayloadDto;
        const interview = await tx.hiringInterview.create({
          data: {
            candidateName: payload.candidateName,
            candidateEmail: payload.candidateEmail ?? null,
            candidatePhone: payload.candidatePhone ?? null,
            jobRoleId: payload.jobRoleId ?? null,
            roleTitle: payload.roleTitle,
            interviewDate: new Date(`${payload.interviewDate}T12:00:00Z`),
            interviewerName: payload.interviewerName,
            evaluatorId: authorId,
            recommendation: payload.recommendation,
            notes: payload.generalNotes ?? null,
            scores: payload.criteriaScores as object,
            generatedDocumentId: doc.id,
          },
        });

        await this.audit.record(
          {
            actorId: authorId,
            action: AuditAction.INTERVIEW_RECORDED,
            outcome: AuditOutcome.SUCCESS,
            targetType: AuditTargetType.INTERVIEW,
            targetId: interview.id,
            ...context,
            afterState: {
              candidateName: payload.candidateName,
              recommendation: payload.recommendation,
              generatedDocumentId: doc.id,
            },
          },
          tx,
        );
      } else if (draft.documentType === DocumentType.ACKNOWLEDGMENT_REGULATION) {
        const payload = draft.payload as AcknowledgmentRegulationPayloadDto;
        const ack = await tx.employeeDocumentAcknowledgment.create({
          data: {
            employeeId: payload.employeeId,
            acknowledgmentType: AcknowledgmentType.REGULATION,
            regulationVersionId: payload.regulationVersionId,
            generatedDocumentId: doc.id,
            createdById: authorId,
          },
        });

        await this.audit.record(
          {
            actorId: authorId,
            action: AuditAction.ACKNOWLEDGMENT_GENERATED,
            outcome: AuditOutcome.SUCCESS,
            targetType: AuditTargetType.ACKNOWLEDGMENT,
            targetId: ack.id,
            ...context,
            afterState: {
              employeeId: payload.employeeId,
              acknowledgmentType: 'REGULATION',
              generatedDocumentId: doc.id,
            },
          },
          tx,
        );
      } else if (draft.documentType === DocumentType.ACKNOWLEDGMENT_ROLE) {
        const payload = draft.payload as AcknowledgmentRolePayloadDto;
        const ack = await tx.employeeDocumentAcknowledgment.create({
          data: {
            employeeId: payload.employeeId,
            acknowledgmentType: AcknowledgmentType.ROLE,
            jobRoleVersionId: payload.jobRoleVersionId,
            generatedDocumentId: doc.id,
            createdById: authorId,
          },
        });

        await this.audit.record(
          {
            actorId: authorId,
            action: AuditAction.ACKNOWLEDGMENT_GENERATED,
            outcome: AuditOutcome.SUCCESS,
            targetType: AuditTargetType.ACKNOWLEDGMENT,
            targetId: ack.id,
            ...context,
            afterState: {
              employeeId: payload.employeeId,
              acknowledgmentType: 'ROLE',
              generatedDocumentId: doc.id,
            },
          },
          tx,
        );
      }

      // 3. Delete draft
      await tx.documentDraft.delete({
        where: { id: draft.id },
      });

      // 4. Record audit event
      await this.audit.record(
        {
          actorId: authorId,
          action: AuditAction.DOCUMENT_CONFIRMED,
          outcome: AuditOutcome.SUCCESS,
          targetType: AuditTargetType.GENERATED_DOCUMENT,
          targetId: doc.id,
          ...context,
          afterState: {
            documentType: doc.documentType,
            title: doc.title,
            artifactId: doc.artifactId,
          },
        },
        tx,
      );

      return doc;
    });

    return {
      id: generated.id,
      documentType: generated.documentType,
      title: generated.title,
      companyId: generated.companyId,
      employeeId: generated.employeeId,
      employeeName: generated.employee?.name ?? null,
      authorId: generated.authorId,
      authorName: generated.author?.name ?? null,
      artifactId: generated.artifactId,
      fileSize: generated.artifact?.fileSize ?? null,
      version: generated.version,
      supersededById: generated.supersededById,
      isVoid: generated.isVoid,
      voidReason: generated.voidReason,
      voidedAt: generated.voidedAt?.toISOString() ?? null,
      createdAt: generated.createdAt.toISOString(),
    };
  }

  private validateCompletePayload(type: DocumentType, payload: unknown): void {
    if (type === DocumentType.CULTURE) {
      const parsed = culturePayloadSchema.safeParse(payload);
      if (!parsed.success) {
        throw new BadRequestException({
          code: 'INVALID_DOCUMENT_PAYLOAD',
          message:
            'Os campos obrigatórios da cultura da empresa não foram preenchidos corretamente.',
          errors: parsed.error.issues,
        });
      }
    } else if (type === DocumentType.REGULATION) {
      const parsed = regulationPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        throw new BadRequestException({
          code: 'INVALID_DOCUMENT_PAYLOAD',
          message:
            'Os campos obrigatórios do regimento interno não foram preenchidos corretamente.',
          errors: parsed.error.issues,
        });
      }
    } else if (type === DocumentType.ROLE_MAP) {
      const parsed = roleMapPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        throw new BadRequestException({
          code: 'INVALID_DOCUMENT_PAYLOAD',
          message:
            'Os campos obrigatórios da descrição de cargo não foram preenchidos corretamente.',
          errors: parsed.error.issues,
        });
      }
    } else if (type === DocumentType.INTERVIEW) {
      const parsed = interviewPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        throw new BadRequestException({
          code: 'INVALID_DOCUMENT_PAYLOAD',
          message:
            'Os campos obrigatórios da entrevista de contratação não foram preenchidos corretamente.',
          errors: parsed.error.issues,
        });
      }
    } else if (type === DocumentType.ACKNOWLEDGMENT_REGULATION) {
      const parsed = acknowledgmentRegulationPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        throw new BadRequestException({
          code: 'INVALID_DOCUMENT_PAYLOAD',
          message: 'Os dados do termo de ciência do regimento são inválidos.',
          errors: parsed.error.issues,
        });
      }
    } else if (type === DocumentType.ACKNOWLEDGMENT_ROLE) {
      const parsed = acknowledgmentRolePayloadSchema.safeParse(payload);
      if (!parsed.success) {
        throw new BadRequestException({
          code: 'INVALID_DOCUMENT_PAYLOAD',
          message: 'Os dados do termo de ciência de cargo são inválidos.',
          errors: parsed.error.issues,
        });
      }
    }
  }

  private serializeDraft(draft: DocumentDraft): DocumentDraftResponseDto {
    return {
      id: draft.id,
      documentType: draft.documentType,
      authorId: draft.authorId,
      employeeId: draft.employeeId,
      revision: draft.revision,
      title: draft.title,
      payload: draft.payload as Record<string, unknown>,
      preparedArtifactId: draft.preparedArtifactId,
      createdAt: draft.createdAt.toISOString(),
      updatedAt: draft.updatedAt.toISOString(),
    };
  }
}
