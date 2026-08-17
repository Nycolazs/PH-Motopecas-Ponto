import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import type { ClientContext } from '../auth/auth.types.js';
import { PasswordService } from '../auth/password.service.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { AuditAction, AuditTargetType } from '../generated/prisma/client.js';
import type { ChangeOwnPasswordDto } from './user.dto.js';
import { safeUserSelect, toUserView, type UserViewDto } from './user.view.js';

@Injectable()
export class UsersService {
  public constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  public async getOwnProfile(userId: string): Promise<UserViewDto> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, isActive: true },
      select: safeUserSelect,
    });

    if (user === null) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Perfil não encontrado.',
      });
    }

    return toUserView(user);
  }

  public async changeOwnPassword(
    userId: string,
    input: ChangeOwnPasswordDto,
    context: ClientContext,
  ): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, isActive: true },
      select: { id: true, role: true, passwordHash: true },
    });

    if (user === null) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Usuário não encontrado ou inativo.',
      });
    }

    const verification = await this.passwords.verify(input.currentPassword, user.passwordHash);
    if (!verification.valid) {
      throw new BadRequestException({
        code: 'INVALID_CURRENT_PASSWORD',
        message: 'A senha atual informada está incorreta.',
      });
    }

    const newPasswordHash = await this.passwords.hash(input.newPassword);

    await this.prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: user.id },
        data: { passwordHash: newPasswordHash },
      });

      await this.audit.record(
        {
          actorId: user.id,
          action:
            user.role === 'ADMIN'
              ? AuditAction.ADMIN_PASSWORD_RESET
              : AuditAction.USER_PASSWORD_RESET,
          targetType: AuditTargetType.USER,
          targetId: user.id,
          ...context,
          metadata: { selfService: true, credentialChanged: true },
        },
        transaction,
      );
    });
  }
}
