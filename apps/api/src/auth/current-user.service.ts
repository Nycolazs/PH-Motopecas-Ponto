import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import { AUTH_CLOCK } from './auth.constants.js';
import type { AuthClock } from './clock.js';
import type { AccessTokenClaims, AuthenticatedUser } from './auth.types.js';

function invalidSession(): UnauthorizedException {
  return new UnauthorizedException({
    code: 'AUTHENTICATION_REQUIRED',
    message: 'Sua sessão não é válida. Entre novamente.',
  });
}

@Injectable()
export class CurrentUserService {
  public constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AUTH_CLOCK) private readonly clock: AuthClock,
  ) {}

  public async resolve(claims: AccessTokenClaims): Promise<AuthenticatedUser> {
    const session = await this.prisma.refreshSession.findUnique({
      where: { id: claims.sid },
      select: {
        revokedAt: true,
        expiresAt: true,
        absoluteExpiresAt: true,
        user: {
          select: { id: true, name: true, login: true, role: true, isActive: true },
        },
      },
    });
    const now = this.clock().getTime();

    if (
      session === null ||
      session.revokedAt !== null ||
      session.expiresAt.getTime() <= now ||
      session.absoluteExpiresAt.getTime() <= now ||
      !session.user.isActive ||
      session.user.id !== claims.sub ||
      session.user.role !== claims.role
    ) {
      throw invalidSession();
    }

    return {
      id: session.user.id,
      name: session.user.name,
      login: session.user.login,
      role: session.user.role,
      sessionId: claims.sid,
    };
  }
}
