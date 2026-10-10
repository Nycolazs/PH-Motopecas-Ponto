import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { ClientContext } from '../auth/auth.types.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  AuditAction,
  AuditOutcome,
  AuditTargetType,
  type Prisma,
} from '../generated/prisma/client.js';
import { DocumentStorageService } from './document-storage.service.js';
import type {
  GeneratedDocumentResponseDto,
  ListDocumentsQueryDto,
  VoidDocumentDto,
  DocumentListResponseDto,
} from './documents.dto.js';

@Injectable()
export class DocumentsService {
  public constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(DocumentStorageService) private readonly storage: DocumentStorageService,
  ) {}

  public async listDocuments(query: ListDocumentsQueryDto): Promise<DocumentListResponseDto> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.GeneratedDocumentWhereInput = {
      ...(query.documentType ? { documentType: query.documentType } : {}),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.isVoid !== undefined ? { isVoid: query.isVoid } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search.trim(), mode: 'insensitive' } },
              { employee: { name: { contains: query.search.trim(), mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.generatedDocument.count({ where }),
      this.prisma.generatedDocument.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: true,
          author: true,
          artifact: true,
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items: items.map((doc) => ({
        id: doc.id,
        documentType: doc.documentType,
        title: doc.title,
        companyId: doc.companyId,
        employeeId: doc.employeeId,
        employeeName: doc.employee?.name ?? null,
        authorId: doc.authorId,
        authorName: doc.author?.name ?? null,
        artifactId: doc.artifactId,
        fileSize: doc.artifact?.fileSize ?? null,
        version: doc.version,
        supersededById: doc.supersededById,
        isVoid: doc.isVoid,
        voidReason: doc.voidReason,
        voidedAt: doc.voidedAt?.toISOString() ?? null,
        createdAt: doc.createdAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  public async getDocumentById(id: string): Promise<GeneratedDocumentResponseDto> {
    const doc = await this.prisma.generatedDocument.findUnique({
      where: { id },
      include: {
        employee: true,
        author: true,
        artifact: true,
      },
    });

    if (!doc) {
      throw new NotFoundException({
        code: 'DOCUMENT_NOT_FOUND',
        message: 'Documento não encontrado.',
      });
    }

    return {
      id: doc.id,
      documentType: doc.documentType,
      title: doc.title,
      companyId: doc.companyId,
      employeeId: doc.employeeId,
      employeeName: doc.employee?.name ?? null,
      authorId: doc.authorId,
      authorName: doc.author?.name ?? null,
      artifactId: doc.artifactId,
      fileSize: doc.artifact?.fileSize ?? null,
      version: doc.version,
      supersededById: doc.supersededById,
      isVoid: doc.isVoid,
      voidReason: doc.voidReason,
      voidedAt: doc.voidedAt?.toISOString() ?? null,
      createdAt: doc.createdAt.toISOString(),
    };
  }

  public async getDownloadFile(id: string): Promise<{ contents: Buffer; filename: string }> {
    const doc = await this.prisma.generatedDocument.findUnique({
      where: { id },
      include: { artifact: true },
    });

    if (!doc) {
      throw new NotFoundException({
        code: 'DOCUMENT_NOT_FOUND',
        message: 'Documento não encontrado.',
      });
    }

    const contents = await this.storage.readArtifact(doc.artifact);
    return { contents, filename: documentPdfFilename(doc.title, doc.version) };
  }

  public async getPreviewFile(artifactId: string): Promise<Buffer> {
    const artifact = await this.prisma.documentArtifact.findUnique({
      where: { id: artifactId },
    });

    if (!artifact) {
      throw new NotFoundException({
        code: 'ARTIFACT_NOT_FOUND',
        message: 'A prévia expirou ou não foi encontrada. Gere a visualização novamente.',
      });
    }

    return this.storage.readArtifact(artifact);
  }

  public async voidDocument(
    actorId: string,
    id: string,
    input: VoidDocumentDto,
    context: ClientContext,
  ): Promise<GeneratedDocumentResponseDto> {
    const doc = await this.prisma.generatedDocument.findUnique({
      where: { id },
      include: {
        employee: true,
        author: true,
        artifact: true,
      },
    });

    if (!doc) {
      throw new NotFoundException({
        code: 'DOCUMENT_NOT_FOUND',
        message: 'Documento não encontrado.',
      });
    }

    if (doc.isVoid) {
      throw new BadRequestException({
        code: 'DOCUMENT_ALREADY_VOID',
        message: 'Este documento já foi anulado.',
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const voided = await tx.generatedDocument.update({
        where: { id },
        data: {
          isVoid: true,
          voidReason: input.reason.trim(),
          voidedById: actorId,
          voidedAt: new Date(),
        },
        include: {
          employee: true,
          author: true,
          artifact: true,
        },
      });

      if (tx.disciplinaryAction) {
        await tx.disciplinaryAction.updateMany({
          where: { generatedDocumentId: id, isVoid: false },
          data: {
            isVoid: true,
            voidReason: input.reason.trim(),
            voidedById: actorId,
            voidedAt: voided.voidedAt,
          },
        });
      }

      await this.audit.record(
        {
          actorId,
          action: AuditAction.DOCUMENT_VOIDED,
          outcome: AuditOutcome.SUCCESS,
          targetType: AuditTargetType.GENERATED_DOCUMENT,
          targetId: id,
          ...context,
          afterState: {
            title: doc.title,
            documentType: doc.documentType,
            reason: input.reason.trim(),
          },
        },
        tx,
      );

      return voided;
    });

    return {
      id: updated.id,
      documentType: updated.documentType,
      title: updated.title,
      companyId: updated.companyId,
      employeeId: updated.employeeId,
      employeeName: updated.employee?.name ?? null,
      authorId: updated.authorId,
      authorName: updated.author?.name ?? null,
      artifactId: updated.artifactId,
      fileSize: updated.artifact?.fileSize ?? null,
      version: updated.version,
      supersededById: updated.supersededById,
      isVoid: updated.isVoid,
      voidReason: updated.voidReason,
      voidedAt: updated.voidedAt?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
    };
  }
}

/** ASCII-only download name, e.g. "advertencia_escrita_joao_silva_v1.pdf". */
export function documentPdfFilename(title: string, version: number): string {
  const slug = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);
  return `${slug || 'documento'}_v${version}.pdf`;
}
