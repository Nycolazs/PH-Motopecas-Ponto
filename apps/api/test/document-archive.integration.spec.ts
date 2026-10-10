import { createHash, randomUUID } from 'node:crypto';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';
import {
  DocumentArchiveService,
  PREVIEW_RETENTION_MS,
} from '../src/documents/document-archive.service.js';
import { DocumentStorageService } from '../src/documents/document-storage.service.js';
import { DocumentType, UserRole } from '../src/generated/prisma/client.js';
import { clearApplicationData } from './database-test-helpers.js';

const PDF = Buffer.from('%PDF-1.7\nAdvertência escrita — documento sigiloso\n%%EOF');
const checksum = createHash('sha256').update(PDF).digest('hex');
const documentsDir = join(process.env.UPLOAD_DIR!, 'documents');
const exists = (path: string) =>
  access(join(documentsDir, path)).then(
    () => true,
    () => false,
  );

describe('encrypted document archive maintenance', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: DocumentStorageService;
  let archive: DocumentArchiveService;
  let authorId: string;
  let companyId: string;

  beforeAll(async () => {
    const moduleReference = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleReference.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    storage = app.get(DocumentStorageService);
    archive = app.get(DocumentArchiveService);
  });

  beforeEach(async () => {
    await clearApplicationData(prisma);
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "generated_documents", "document_drafts", "document_artifacts", "companies" CASCADE',
    );
    await rm(documentsDir, { recursive: true, force: true });
    authorId = (
      await prisma.user.create({
        data: {
          name: 'Gerente',
          login: 'gerente.docs',
          normalizedLogin: 'gerente.docs',
          passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$not-used-for-login',
          role: UserRole.ADMIN,
        },
      })
    ).id;
    companyId = (
      await prisma.company.create({
        data: { legalName: 'PH MOTOPECAS LTDA', tradeName: 'PH Motopeças', cnpj: '00000000000100' },
      })
    ).id;
  });

  afterAll(async () => {
    await clearApplicationData(prisma);
    await rm(documentsDir, { recursive: true, force: true });
    await app.close();
  });

  async function confirm(artifactId: string, createdAt: Date) {
    await prisma.generatedDocument.create({
      data: {
        documentType: DocumentType.DISCIPLINE_WRITTEN,
        title: 'Advertência Escrita',
        companyId,
        authorId,
        artifactId,
        documentData: {},
        createdAt,
      },
    });
  }

  it('encrypts plain-text PDFs from earlier versions into the archive', async () => {
    const id = randomUUID();
    await mkdir(documentsDir, { recursive: true });
    await writeFile(join(documentsDir, `${id}.pdf`), PDF);
    await prisma.documentArtifact.create({
      data: { id, storagePath: `${id}.pdf`, fileSize: PDF.length, checksumSha256: checksum },
    });
    await confirm(id, new Date('2026-03-15T15:00:00.000Z'));

    await archive.runMaintenance();

    const artifact = await prisma.documentArtifact.findUniqueOrThrow({ where: { id } });
    expect(artifact.storagePath).toBe(`archive/2026/03/${id}.pdf.enc`);
    expect(await exists(`${id}.pdf`)).toBe(false);
    const onDisk = await readFile(join(documentsDir, artifact.storagePath));
    expect(onDisk.includes(Buffer.from('%PDF'))).toBe(false);
    await expect(storage.readArtifact(artifact)).resolves.toEqual(PDF);
  });

  it('purges unconfirmed previews after the retention period and keeps confirmed ones', async () => {
    const now = new Date('2026-10-09T15:00:00.000Z');
    const old = new Date(now.getTime() - PREVIEW_RETENTION_MS - 60_000);

    const abandoned = await storage.savePreview(PDF);
    await prisma.documentArtifact.create({ data: { ...abandoned, createdAt: old } });
    const fresh = await storage.savePreview(PDF);
    await prisma.documentArtifact.create({ data: { ...fresh, createdAt: now } });
    const confirmed = await storage.savePreview(PDF);
    await prisma.documentArtifact.create({ data: { ...confirmed, createdAt: old } });
    await confirm(confirmed.id, old);

    await archive.runMaintenance(now);

    expect(await prisma.documentArtifact.findUnique({ where: { id: abandoned.id } })).toBeNull();
    expect(await exists(abandoned.storagePath)).toBe(false);
    expect(await prisma.documentArtifact.findUnique({ where: { id: fresh.id } })).not.toBeNull();

    const kept = await prisma.documentArtifact.findUniqueOrThrow({ where: { id: confirmed.id } });
    expect(kept.storagePath).toMatch(/^archive\/2026\/10\//);
    await expect(storage.readArtifact(kept)).resolves.toEqual(PDF);
  });

  it('never deletes a preview that a published document already uses', async () => {
    const stored = await storage.savePreview(PDF);
    await prisma.documentArtifact.create({ data: stored });
    await confirm(stored.id, new Date());

    await archive.discardPreview(stored.id);

    const artifact = await prisma.documentArtifact.findUniqueOrThrow({ where: { id: stored.id } });
    await expect(storage.readArtifact(artifact)).resolves.toEqual(PDF);
  });
});
