import { createReadStream } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Readable } from 'node:stream';

import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser, ClientContext } from '../auth/auth.types.js';
import type { EnvironmentVariables } from '../config/environment.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  AuditAction,
  AuditOutcome,
  AuditTargetType,
  AvatarMimeType,
} from '../generated/prisma/client.js';
import type { AvatarViewDto, UploadAvatarDto } from './avatar.dto.js';
import { computeSha256, detectImageMimeType, extractDimensions } from './image-utils.js';

const MAXIMUM_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB

const MIME_MAP: Record<'image/jpeg' | 'image/png' | 'image/webp', AvatarMimeType> = {
  'image/jpeg': AvatarMimeType.IMAGE_JPEG,
  'image/png': AvatarMimeType.IMAGE_PNG,
  'image/webp': AvatarMimeType.IMAGE_WEBP,
};

const EXTENSION_MAP: Record<AvatarMimeType, string> = {
  [AvatarMimeType.IMAGE_JPEG]: '.jpg',
  [AvatarMimeType.IMAGE_PNG]: '.png',
  [AvatarMimeType.IMAGE_WEBP]: '.webp',
};

const CONTENT_TYPE_MAP: Record<AvatarMimeType, string> = {
  [AvatarMimeType.IMAGE_JPEG]: 'image/jpeg',
  [AvatarMimeType.IMAGE_PNG]: 'image/png',
  [AvatarMimeType.IMAGE_WEBP]: 'image/webp',
};

@Injectable()
export class AvatarsService {
  private readonly uploadDirectory: string;

  public constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(ConfigService) configService: ConfigService<EnvironmentVariables, true>,
  ) {
    this.uploadDirectory = resolve(configService.get('UPLOAD_DIR', { infer: true }));
  }

  public async upload(
    actor: AuthenticatedUser,
    userId: string,
    input: UploadAvatarDto,
    context: ClientContext,
  ): Promise<AvatarViewDto> {
    // Only ADMIN or the user themselves can upload an avatar
    if (actor.role !== 'ADMIN' && actor.id !== userId) {
      throw new ForbiddenException({
        code: 'ACCESS_DENIED',
        message: 'Você não tem permissão para alterar este avatar.',
      });
    }

    const cleanBase64 = input.dataBase64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    if (buffer.length === 0) {
      throw new BadRequestException({
        code: 'INVALID_AVATAR',
        message: 'O arquivo de imagem enviado está vazio ou corrompido.',
      });
    }

    if (buffer.length > MAXIMUM_AVATAR_BYTES) {
      throw new BadRequestException({
        code: 'AVATAR_TOO_LARGE',
        message: 'A foto de perfil deve ter no máximo 2 MB.',
      });
    }

    const detectedMime = detectImageMimeType(buffer);
    if (detectedMime === null) {
      throw new BadRequestException({
        code: 'INVALID_IMAGE_TYPE',
        message: 'O formato do arquivo é inválido. Utilize JPEG, PNG ou WebP.',
      });
    }

    const prismaMime = MIME_MAP[detectedMime];
    const checksum = computeSha256(buffer);
    const { width, height } = extractDimensions(buffer, detectedMime);

    // Save image to upload folder
    const avatarsDir = resolve(this.uploadDirectory, 'avatars');
    await mkdir(avatarsDir, { recursive: true, mode: 0o750 });
    const extension = EXTENSION_MAP[prismaMime];
    const filename = `${checksum}${extension}`;
    const filePath = resolve(avatarsDir, filename);
    await writeFile(filePath, buffer);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        include: { avatar: true },
      });

      if (user === null) {
        throw new NotFoundException({
          code: 'USER_NOT_FOUND',
          message: 'Usuário não encontrado.',
        });
      }

      const isReplacement = user.avatar !== null;
      const avatar = await tx.avatar.upsert({
        where: { userId },
        create: {
          userId,
          objectKey: `avatars/${filename}`,
          mimeType: prismaMime,
          byteSize: buffer.length,
          width,
          height,
          checksum,
        },
        update: {
          objectKey: `avatars/${filename}`,
          mimeType: prismaMime,
          byteSize: buffer.length,
          width,
          height,
          checksum,
        },
      });

      await this.audit.record(
        {
          actorId: actor.id,
          action: isReplacement ? AuditAction.AVATAR_REPLACED : AuditAction.AVATAR_UPLOADED,
          outcome: AuditOutcome.SUCCESS,
          targetType: AuditTargetType.AVATAR,
          targetId: userId,
          ...context,
          metadata: {
            byteSize: buffer.length,
            width,
            height,
            mimeType: detectedMime,
          },
        },
        tx,
      );

      return {
        id: avatar.id,
        userId: avatar.userId,
        mimeType: avatar.mimeType,
        byteSize: avatar.byteSize,
        width: avatar.width,
        height: avatar.height,
        checksum: avatar.checksum,
        createdAt: avatar.createdAt.toISOString(),
      };
    });
  }

  public async getAvatarStream(
    userId: string,
  ): Promise<{ stream: Readable; mimeType: string; checksum: string; byteSize: number }> {
    const avatar = await this.prisma.avatar.findUnique({
      where: { userId },
    });

    if (avatar === null) {
      throw new NotFoundException({
        code: 'AVATAR_NOT_FOUND',
        message: 'Foto de perfil não encontrada.',
      });
    }

    const filePath = resolve(this.uploadDirectory, avatar.objectKey);
    const stream = createReadStream(filePath);

    return {
      stream,
      mimeType: CONTENT_TYPE_MAP[avatar.mimeType],
      checksum: avatar.checksum,
      byteSize: avatar.byteSize,
    };
  }

  public async remove(
    actor: AuthenticatedUser,
    userId: string,
    context: ClientContext,
  ): Promise<void> {
    if (actor.role !== 'ADMIN' && actor.id !== userId) {
      throw new ForbiddenException({
        code: 'ACCESS_DENIED',
        message: 'Você não tem permissão para remover este avatar.',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      const avatar = await tx.avatar.findUnique({
        where: { userId },
      });

      if (avatar === null) {
        return;
      }

      await tx.avatar.delete({
        where: { userId },
      });

      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.AVATAR_REMOVED,
          outcome: AuditOutcome.SUCCESS,
          targetType: AuditTargetType.AVATAR,
          targetId: userId,
          ...context,
        },
        tx,
      );

      // Clean up file if no other user uses the exact same checksum
      const others = await tx.avatar.count({
        where: { checksum: avatar.checksum },
      });

      if (others === 0) {
        const filePath = resolve(this.uploadDirectory, avatar.objectKey);
        try {
          await unlink(filePath);
        } catch {
          // File cleanup failure is non-fatal
        }
      }
    });
  }
}
