import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import type { UserRole } from '@ph-ponto/shared';

import {
  IdempotencyStatus,
  type IdempotencyOperation,
  type Prisma,
} from '../generated/prisma/client.js';
import { IdempotencyHasherService } from './idempotency-hasher.service.js';
import { MutationLockService } from './mutation-lock.service.js';

const REPLAY_WINDOW_MILLISECONDS = 24 * 60 * 60 * 1_000;

export type IdempotencyStart<TResponse> =
  | { kind: 'CLAIM'; recordId: string }
  | { kind: 'REPLAY'; response: TResponse; responseStatus: number };

export interface BeginIdempotencyInput {
  actorId: string;
  requiredRole: UserRole;
  operation: IdempotencyOperation;
  key: string;
  fingerprintPayload: unknown;
  now: Date;
}

function equalFingerprint(expected: string, actual: string): boolean {
  return expected === actual;
}

function isJsonObject(value: Prisma.JsonValue | null): value is Prisma.JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

@Injectable()
export class IdempotencyService {
  public constructor(
    @Inject(IdempotencyHasherService) private readonly hasher: IdempotencyHasherService,
    @Inject(MutationLockService) private readonly locks: MutationLockService,
  ) {}

  public async begin<TResponse>(
    transaction: Prisma.TransactionClient,
    input: BeginIdempotencyInput,
  ): Promise<IdempotencyStart<TResponse>> {
    const keyHash = this.hasher.hashKey(input.actorId, input.operation, input.key);
    const requestFingerprint = this.hasher.fingerprint(input.operation, input.fingerprintPayload);

    await this.locks.acquireIdempotencyLock(transaction, keyHash);
    await this.locks.lockActor(transaction, input.actorId, input.requiredRole);

    const existing = await transaction.idempotencyRecord.findUnique({
      where: {
        actorId_operation_keyHash: {
          actorId: input.actorId,
          operation: input.operation,
          keyHash,
        },
      },
    });

    if (existing !== null) {
      if (!equalFingerprint(existing.requestFingerprint, requestFingerprint)) {
        throw new ConflictException({
          code: 'IDEMPOTENCY_KEY_REUSED',
          message: 'Este Idempotency-Key já foi usado em outra solicitação.',
        });
      }

      if (
        existing.status !== IdempotencyStatus.COMPLETED ||
        existing.responseStatus === null ||
        !isJsonObject(existing.responseBody)
      ) {
        throw new ConflictException({
          code: 'IDEMPOTENCY_BUSY',
          message: 'Esta solicitação ainda está sendo processada. Tente novamente.',
        });
      }

      return {
        kind: 'REPLAY',
        response: existing.responseBody as TResponse,
        responseStatus: existing.responseStatus,
      };
    }

    const record = await transaction.idempotencyRecord.create({
      data: {
        actorId: input.actorId,
        operation: input.operation,
        keyHash,
        requestFingerprint,
        expiresAt: new Date(input.now.getTime() + REPLAY_WINDOW_MILLISECONDS),
        createdAt: input.now,
      },
      select: { id: true },
    });

    return { kind: 'CLAIM', recordId: record.id };
  }

  public async complete(
    transaction: Prisma.TransactionClient,
    recordId: string,
    responseStatus: number,
    response: Prisma.InputJsonObject,
  ): Promise<void> {
    const result = await transaction.idempotencyRecord.updateMany({
      where: { id: recordId, status: IdempotencyStatus.PROCESSING },
      data: {
        status: IdempotencyStatus.COMPLETED,
        responseStatus,
        responseBody: response,
      },
    });

    if (result.count !== 1) {
      throw new InternalServerErrorException({
        code: 'IDEMPOTENCY_COMPLETION_FAILED',
        message: 'Não foi possível concluir a solicitação.',
      });
    }
  }
}
