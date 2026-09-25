import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { AuditService } from '../audit/audit.service.js';
import type { PrismaService } from '../database/prisma.service.js';
import { DocumentType } from '../generated/prisma/client.js';
import type { DocumentStorageService } from './document-storage.service.js';
import { DocumentsService } from './documents.service.js';

interface DocumentsPrismaMock {
  generatedDocument: {
    count: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
}

interface StorageMock {
  getArtifactStream: ReturnType<typeof vi.fn>;
}

interface AuditMock {
  record: ReturnType<typeof vi.fn>;
}

describe('DocumentsService', () => {
  let service: DocumentsService;
  let prismaMock: DocumentsPrismaMock;
  let storageMock: StorageMock;
  let auditMock: AuditMock;

  const mockContext = {
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
  };

  const mockDoc = {
    id: 'doc-1',
    documentType: DocumentType.CULTURE,
    title: 'Manual de Cultura v1',
    companyId: 'company-1',
    employeeId: null,
    employee: null,
    authorId: 'author-1',
    author: { id: 'author-1', name: 'Administrador' },
    artifactId: 'art-1',
    artifact: {
      id: 'art-1',
      storagePath: 'docs/test.pdf',
      fileName: 'cultura.pdf',
      fileSize: 12345,
      mimeType: 'application/pdf',
    },
    version: 1,
    supersededById: null,
    isVoid: false,
    voidReason: null,
    voidedAt: null,
    createdAt: new Date('2026-01-01T12:00:00Z'),
  };

  beforeEach(() => {
    prismaMock = {
      generatedDocument: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([mockDoc]),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(prismaMock)),
    };

    storageMock = {
      getArtifactStream: vi.fn().mockReturnValue({ pipe: vi.fn() }),
    };

    auditMock = {
      record: vi.fn().mockResolvedValue('audit-1'),
    };

    service = new DocumentsService(
      prismaMock as unknown as PrismaService,
      auditMock as unknown as AuditService,
      storageMock as unknown as DocumentStorageService,
    );
  });

  it('lists documents with pagination and filters', async () => {
    const result = await service.listDocuments({
      page: 1,
      limit: 10,
      documentType: DocumentType.CULTURE,
      search: 'Manual',
      isVoid: false,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.title).toBe('Manual de Cultura v1');
    expect(result.items[0]?.authorName).toBe('Administrador');
    expect(result.pagination.total).toBe(1);
    expect(result.pagination.totalPages).toBe(1);
  });

  it('retrieves single document by id', async () => {
    prismaMock.generatedDocument.findUnique.mockResolvedValue(mockDoc);

    const result = await service.getDocumentById('doc-1');
    expect(result.id).toBe('doc-1');
    expect(result.title).toBe('Manual de Cultura v1');
  });

  it('throws NotFoundException when document does not exist', async () => {
    prismaMock.generatedDocument.findUnique.mockResolvedValue(null);

    await expect(service.getDocumentById('non-existent')).rejects.toThrow(NotFoundException);
  });

  it('provides download stream for valid document', async () => {
    prismaMock.generatedDocument.findUnique.mockResolvedValue(mockDoc);

    const result = await service.getDownloadStream('doc-1');
    expect(result.filename).toBe('manual_de_cultura_v1_v1.pdf');
    expect(result.fileSize).toBe(12345);
    expect(storageMock.getArtifactStream).toHaveBeenCalledWith('docs/test.pdf');
  });

  it('voids an active document and records audit log', async () => {
    prismaMock.generatedDocument.findUnique.mockResolvedValue(mockDoc);
    prismaMock.generatedDocument.update.mockResolvedValue({
      ...mockDoc,
      isVoid: true,
      voidReason: 'Substituído por nova versão',
      voidedAt: new Date('2026-01-02T12:00:00Z'),
    });

    const result = await service.voidDocument(
      'admin-1',
      'doc-1',
      { reason: 'Substituído por nova versão' },
      mockContext,
    );

    expect(result.isVoid).toBe(true);
    expect(result.voidReason).toBe('Substituído por nova versão');
    expect(auditMock.record).toHaveBeenCalled();
  });

  it('throws BadRequestException if attempting to void an already voided document', async () => {
    prismaMock.generatedDocument.findUnique.mockResolvedValue({
      ...mockDoc,
      isVoid: true,
      voidReason: 'Já anulado',
      voidedAt: new Date('2026-01-02T12:00:00Z'),
    });

    await expect(
      service.voidDocument('admin-1', 'doc-1', { reason: 'Nova tentativa' }, mockContext),
    ).rejects.toThrow(BadRequestException);
  });
});
