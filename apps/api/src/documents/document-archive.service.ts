import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { EnvironmentVariables } from '../config/environment.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  DocumentStorageService,
  isArchivedStoragePath,
  isEncryptedStoragePath,
  PREVIEWS_FOLDER,
} from './document-storage.service.js';

/** Previews never confirmed are deleted after this long. */
export const PREVIEW_RETENTION_MS = 24 * 60 * 60 * 1000;
const MAINTENANCE_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Owns the lifecycle of stored PDFs: a rendered PDF is only a temporary, encrypted
 * preview until the administrator confirms (publishes or prints) it; then it moves to
 * the encrypted archive. Unconfirmed previews are purged automatically.
 */
@Injectable()
export class DocumentArchiveService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(DocumentArchiveService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  public constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DocumentStorageService) private readonly storage: DocumentStorageService,
    @Inject(ConfigService) private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  public onApplicationBootstrap(): void {
    if (this.config.get('NODE_ENV', { infer: true }) === 'test') return;
    void this.runMaintenance();
    this.timer = setInterval(() => void this.runMaintenance(), MAINTENANCE_INTERVAL_MS);
    this.timer.unref?.();
  }

  public onModuleDestroy(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  public async runMaintenance(now = new Date()): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.storage.ensureRootDirectory();
      await this.encryptLegacyArtifacts();
      await this.archiveConfirmedPreviews();
      await this.purgeExpiredPreviews(now);
    } catch (error) {
      this.logger.error(
        `Document storage maintenance failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.running = false;
    }
  }

  /**
   * Moves a just-confirmed PDF into the archive. Failure is logged and retried by the
   * maintenance pass; the document stays readable from its preview location meanwhile.
   */
  public async archive(artifactId: string, confirmedAt: Date): Promise<void> {
    try {
      const artifact = await this.prisma.documentArtifact.findUnique({ where: { id: artifactId } });
      if (artifact === null || isArchivedStoragePath(artifact.storagePath)) return;
      const storagePath = await this.storage.moveToArchive(
        artifact.id,
        artifact.storagePath,
        confirmedAt,
      );
      await this.prisma.documentArtifact.update({
        where: { id: artifact.id },
        data: { storagePath },
      });
    } catch (error) {
      this.logger.error(
        `Could not archive document artifact ${artifactId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Deletes a preview that was replaced or discarded, unless a document already uses it. */
  public async discardPreview(artifactId: string | null): Promise<void> {
    if (artifactId === null) return;
    try {
      await this.deleteUnconfirmedArtifact(artifactId);
    } catch (error) {
      this.logger.error(
        `Could not discard preview ${artifactId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async deleteUnconfirmedArtifact(artifactId: string): Promise<boolean> {
    const artifact = await this.prisma.documentArtifact.findUnique({
      where: { id: artifactId },
      select: { id: true, storagePath: true, _count: { select: { generatedDocuments: true } } },
    });
    if (artifact === null || artifact._count.generatedDocuments > 0) return false;
    // The relation filter makes the delete a no-op if a confirmation raced in meanwhile.
    const deleted = await this.prisma.documentArtifact.deleteMany({
      where: { id: artifact.id, generatedDocuments: { none: {} } },
    });
    if (deleted.count === 0) return false;
    await this.storage.deleteArtifact(artifact.storagePath);
    return true;
  }

  private async purgeExpiredPreviews(now: Date): Promise<void> {
    const expired = await this.prisma.documentArtifact.findMany({
      where: {
        createdAt: { lt: new Date(now.getTime() - PREVIEW_RETENTION_MS) },
        generatedDocuments: { none: {} },
      },
      select: { id: true },
      take: 200,
    });
    let purged = 0;
    for (const { id } of expired) {
      if (await this.deleteUnconfirmedArtifact(id)) purged += 1;
    }
    if (purged > 0) this.logger.log(`Purged ${purged} expired PDF preview(s).`);
  }

  private async archiveConfirmedPreviews(): Promise<void> {
    const pending = await this.prisma.documentArtifact.findMany({
      where: {
        storagePath: { startsWith: `${PREVIEWS_FOLDER}/` },
        generatedDocuments: { some: {} },
      },
      select: { id: true, generatedDocuments: { select: { createdAt: true }, take: 1 } },
    });
    for (const artifact of pending) {
      await this.archive(artifact.id, artifact.generatedDocuments[0]?.createdAt ?? new Date());
    }
  }

  /** Encrypts plaintext PDFs written before encryption at rest was introduced. */
  private async encryptLegacyArtifacts(): Promise<void> {
    const legacy = await this.prisma.documentArtifact.findMany({
      where: { NOT: { storagePath: { endsWith: '.pdf.enc' } } },
      select: {
        id: true,
        storagePath: true,
        createdAt: true,
        generatedDocuments: { select: { createdAt: true }, take: 1 },
      },
    });
    let migrated = 0;
    for (const artifact of legacy) {
      if (isEncryptedStoragePath(artifact.storagePath)) continue;
      const confirmedAt = artifact.generatedDocuments[0]?.createdAt;
      const destination =
        confirmedAt === undefined
          ? `${PREVIEWS_FOLDER}/${artifact.id}.pdf.enc`
          : this.storage.archivePathFor(artifact.id, confirmedAt);
      try {
        await this.storage.encryptLegacyFile(artifact.id, artifact.storagePath, destination);
        await this.prisma.documentArtifact.update({
          where: { id: artifact.id },
          data: { storagePath: destination },
        });
        await this.storage.deleteArtifact(artifact.storagePath);
        migrated += 1;
      } catch (error) {
        this.logger.error(
          `Could not encrypt legacy document artifact ${artifact.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    if (migrated > 0) this.logger.log(`Encrypted ${migrated} legacy PDF artifact(s) at rest.`);
  }
}
