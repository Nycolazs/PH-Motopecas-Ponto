import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import type { AuditService } from '../audit/audit.service.js';
import type { CompanyService } from '../company/company.service.js';
import type { PrismaService } from '../database/prisma.service.js';
import { DocumentType } from '../generated/prisma/client.js';
import { DocumentDraftsService } from './document-drafts.service.js';
import type { RenderJobsService } from './render-jobs.service.js';

interface DraftsPrismaMock {
  documentDraft: {
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  generatedDocument: {
    create: ReturnType<typeof vi.fn>;
  };
  cultureProfile: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  cultureProfileVersion: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
}

interface AuditMock {
  record: ReturnType<typeof vi.fn>;
}

interface CompanyServiceMock {
  getCompany: ReturnType<typeof vi.fn>;
}

interface RenderJobsMock {
  createJob: ReturnType<typeof vi.fn>;
  executeJob: ReturnType<typeof vi.fn>;
}

describe('DocumentDraftsService', () => {
  let service: DocumentDraftsService;
  let prismaMock: DraftsPrismaMock;
  let auditMock: AuditMock;
  let companyServiceMock: CompanyServiceMock;
  let renderJobsMock: RenderJobsMock;

  const mockContext = {
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
  };

  const validCulturePayload = {
    mission: 'Prover as melhores peças para motocicletas com rapidez.',
    vision: 'Ser a distribuidora líder no interior paulista até 2030.',
    values: [
      { title: 'Qualidade', description: 'Produtos rigorosamente testados.' },
      { title: 'Respeito', description: 'Ética em todas as relações.' },
    ],
    motto: 'Velocidade e confiança na sua jornada.',
  };

  const mockDraft = {
    id: 'draft-1',
    documentType: DocumentType.CULTURE,
    title: 'Manual de Cultura Organizacional',
    authorId: 'admin-1',
    employeeId: null,
    revision: 1,
    payload: validCulturePayload,
    preparedArtifactId: null,
    createdAt: new Date('2026-01-01T10:00:00Z'),
    updatedAt: new Date('2026-01-01T10:00:00Z'),
  };

  beforeEach(() => {
    prismaMock = {
      documentDraft: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      generatedDocument: {
        create: vi.fn(),
      },
      cultureProfile: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      cultureProfileVersion: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(prismaMock)),
    };

    auditMock = {
      record: vi.fn().mockResolvedValue('audit-1'),
    };

    companyServiceMock = {
      getCompany: vi.fn().mockResolvedValue({
        id: '10000000-0000-0000-0000-000000000001',
        legalName: 'PH MOTOPECAS LTDA',
        tradeName: 'PH Motopeças',
        cnpj: '00.000.000/0001-00',
      }),
    };

    renderJobsMock = {
      createJob: vi.fn().mockResolvedValue({ id: 'job-1' }),
      executeJob: vi.fn().mockResolvedValue({ id: 'artifact-1', fileSize: 54321 }),
    };

    service = new DocumentDraftsService(
      prismaMock as unknown as PrismaService,
      auditMock as unknown as AuditService,
      companyServiceMock as unknown as CompanyService,
      renderJobsMock as unknown as RenderJobsService,
    );
  });

  describe('saveDraft', () => {
    it('creates a new draft at revision 1 if no draft exists', async () => {
      prismaMock.documentDraft.findFirst.mockResolvedValue(null);
      prismaMock.documentDraft.create.mockResolvedValue(mockDraft);

      const result = await service.saveDraft(
        'admin-1',
        {
          documentType: DocumentType.CULTURE,
          title: 'Manual de Cultura Organizacional',
          payload: validCulturePayload,
        },
        mockContext,
      );

      expect(prismaMock.documentDraft.create).toHaveBeenCalled();
      expect(auditMock.record).toHaveBeenCalled();
      expect(result.id).toBe('draft-1');
      expect(result.revision).toBe(1);
    });

    it('updates existing draft and increments revision', async () => {
      prismaMock.documentDraft.findFirst.mockResolvedValue(mockDraft);
      prismaMock.documentDraft.update.mockResolvedValue({
        ...mockDraft,
        revision: 2,
        title: 'Manual de Cultura Atualizado',
      });

      const result = await service.saveDraft(
        'admin-1',
        {
          documentType: DocumentType.CULTURE,
          title: 'Manual de Cultura Atualizado',
          payload: validCulturePayload,
          expectedRevision: 1,
        },
        mockContext,
      );

      expect(prismaMock.documentDraft.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'draft-1' },
          data: expect.objectContaining({
            revision: 2,
            preparedArtifactId: null,
          }),
        }),
      );
      expect(result.revision).toBe(2);
    });

    it('throws ConflictException if expectedRevision does not match current draft revision', async () => {
      prismaMock.documentDraft.findFirst.mockResolvedValue(mockDraft); // revision is 1

      await expect(
        service.saveDraft(
          'admin-1',
          {
            documentType: DocumentType.CULTURE,
            title: 'Manual de Cultura Atualizado',
            payload: validCulturePayload,
            expectedRevision: 99, // mismatch
          },
          mockContext,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('discardDraft', () => {
    it('deletes draft and records audit log', async () => {
      prismaMock.documentDraft.findUnique.mockResolvedValue(mockDraft);

      const result = await service.discardDraft('admin-1', 'draft-1', mockContext);

      expect(prismaMock.documentDraft.delete).toHaveBeenCalledWith({ where: { id: 'draft-1' } });
      expect(auditMock.record).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('throws ForbiddenException if actor is not the draft author', async () => {
      prismaMock.documentDraft.findUnique.mockResolvedValue(mockDraft);

      await expect(service.discardDraft('other-user', 'draft-1', mockContext)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('prepareDraft', () => {
    it('validates schema, creates render job, and saves preparedArtifactId', async () => {
      prismaMock.documentDraft.findUnique.mockResolvedValue(mockDraft);
      prismaMock.documentDraft.update.mockResolvedValue({
        ...mockDraft,
        preparedArtifactId: 'artifact-1',
      });

      const result = await service.prepareDraft(
        'admin-1',
        'draft-1',
        { expectedRevision: 1 },
        mockContext,
      );

      expect(renderJobsMock.createJob).toHaveBeenCalledWith(
        DocumentType.CULTURE,
        validCulturePayload,
        'draft-1',
      );
      expect(renderJobsMock.executeJob).toHaveBeenCalledWith('job-1');
      expect(prismaMock.documentDraft.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { preparedArtifactId: 'artifact-1' },
        }),
      );
      expect(result.preparedArtifactId).toBe('artifact-1');
    });

    it('throws BadRequestException if payload fails complete schema validation', async () => {
      prismaMock.documentDraft.findUnique.mockResolvedValue({
        ...mockDraft,
        payload: { mission: '' }, // invalid culture payload (missing vision, values, etc.)
      });

      await expect(
        service.prepareDraft('admin-1', 'draft-1', { expectedRevision: 1 }, mockContext),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('confirmDraft', () => {
    it('promotes prepared artifact into GeneratedDocument, updates domain profile, and deletes draft', async () => {
      const preparedDraft = {
        ...mockDraft,
        preparedArtifactId: 'artifact-1',
        author: { id: 'admin-1', name: 'Admin' },
        employee: null,
      };

      prismaMock.documentDraft.findUnique.mockResolvedValue(preparedDraft);
      prismaMock.cultureProfile.findUnique.mockResolvedValue({ id: 'profile-1' });
      prismaMock.cultureProfileVersion.findFirst.mockResolvedValue(null);

      const generatedDoc = {
        id: 'doc-1',
        documentType: DocumentType.CULTURE,
        title: 'Manual de Cultura Organizacional',
        companyId: '10000000-0000-0000-0000-000000000001',
        employeeId: null,
        employee: null,
        authorId: 'admin-1',
        author: { id: 'admin-1', name: 'Admin' },
        artifactId: 'artifact-1',
        artifact: { fileSize: 54321 },
        version: 1,
        supersededById: null,
        isVoid: false,
        voidReason: null,
        voidedAt: null,
        createdAt: new Date('2026-01-01T12:00:00Z'),
      };

      prismaMock.generatedDocument.create.mockResolvedValue(generatedDoc);

      const result = await service.confirmDraft(
        'admin-1',
        'draft-1',
        {
          expectedRevision: 1,
          preparedArtifactId: 'artifact-1',
        },
        mockContext,
      );

      expect(prismaMock.generatedDocument.create).toHaveBeenCalled();
      expect(prismaMock.cultureProfileVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cultureProfileId: 'profile-1',
            versionNumber: 1,
            generatedDocumentId: 'doc-1',
          }),
        }),
      );
      expect(prismaMock.documentDraft.delete).toHaveBeenCalledWith({ where: { id: 'draft-1' } });
      expect(result.id).toBe('doc-1');
      expect(result.artifactId).toBe('artifact-1');
    });

    it('throws BadRequestException if preparedArtifactId does not match draft preparedArtifactId', async () => {
      prismaMock.documentDraft.findUnique.mockResolvedValue({
        ...mockDraft,
        preparedArtifactId: 'artifact-1',
      });

      await expect(
        service.confirmDraft(
          'admin-1',
          'draft-1',
          {
            expectedRevision: 1,
            preparedArtifactId: 'different-artifact',
          },
          mockContext,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
