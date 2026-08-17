import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import type { Prisma, SessionRevocationReason } from '../generated/prisma/client.js';

type TransactionClient = Prisma.TransactionClient;
type SessionDatabase = Pick<PrismaService, 'refreshSession'> | TransactionClient;

@Injectable()
export class SessionRevocationService {
  public constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  public async revokeAllForUser(
    userId: string,
    reason: SessionRevocationReason,
    transaction?: TransactionClient,
    revokedAt = new Date(),
  ): Promise<number> {
    return this.revokeWhere({ userId }, reason, transaction, revokedAt);
  }

  public async revokeFamily(
    familyId: string,
    reason: SessionRevocationReason,
    transaction?: TransactionClient,
    revokedAt = new Date(),
  ): Promise<number> {
    return this.revokeWhere({ familyId }, reason, transaction, revokedAt);
  }

  public async revokeSession(
    sessionId: string,
    reason: SessionRevocationReason,
    transaction?: TransactionClient,
    revokedAt = new Date(),
  ): Promise<number> {
    return this.revokeWhere({ id: sessionId }, reason, transaction, revokedAt);
  }

  private async revokeWhere(
    where: { userId: string } | { familyId: string } | { id: string },
    reason: SessionRevocationReason,
    transaction?: TransactionClient,
    revokedAt = new Date(),
  ): Promise<number> {
    const database: SessionDatabase = transaction ?? this.prisma;
    const result = await database.refreshSession.updateMany({
      where: { ...where, revokedAt: null },
      data: { revokedAt, revocationReason: reason },
    });
    return result.count;
  }
}
