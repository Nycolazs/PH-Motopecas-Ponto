import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import type { EnvironmentVariables } from '../config/environment.js';
import { IdempotencyOperation, IdempotencyStatus } from '../generated/prisma/client.js';
import { IdempotencyHasherService } from './idempotency-hasher.service.js';
import { IdempotencyKeyPipe } from './idempotency-key.pipe.js';
import { IdempotencyService } from './idempotency.service.js';
import type { MutationLockService } from './mutation-lock.service.js';

const actorId = '487d962c-c34d-486b-83be-c1aac9772f9d';
const key = '23144362-e369-49e4-9241-1920b05e32f7';
const now = new Date('2026-08-14T12:00:00.000Z');

function hasher(): IdempotencyHasherService {
  const config = {
    get: vi.fn().mockReturnValue('test-refresh-secret-with-at-least-32-characters'),
  } as unknown as ConfigService<EnvironmentVariables, true>;
  return new IdempotencyHasherService(config);
}

function transactionHarness(existing: Record<string, unknown> | null = null) {
  const findUnique = vi.fn().mockResolvedValue(existing);
  const create = vi.fn().mockResolvedValue({ id: '9bb83b30-89ea-44b2-8996-ef89d380d527' });
  const updateMany = vi.fn().mockResolvedValue({ count: 1 });
  return {
    transaction: {
      idempotencyRecord: { findUnique, create, updateMany },
    },
    findUnique,
    create,
    updateMany,
  };
}

describe('IdempotencyKeyPipe', () => {
  const pipe = new IdempotencyKeyPipe();

  it('normalizes a valid UUID and rejects a missing or malformed header', () => {
    expect(pipe.transform(key.toUpperCase())).toBe(key);
    expect(() => pipe.transform(undefined)).toThrowError(expect.objectContaining({ status: 400 }));
    expect(() => pipe.transform('not-a-uuid')).toThrowError(
      expect.objectContaining({ status: 400 }),
    );
  });
});

describe('IdempotencyHasherService', () => {
  it('creates stable domain-separated HMAC fingerprints independent of object key order', () => {
    const service = hasher();
    const first = service.fingerprint(IdempotencyOperation.INSERT_TIME_PUNCH, {
      employeeId: actorId,
      occurredAt: '2026-08-14T11:00:00.000Z',
    });
    const reordered = service.fingerprint(IdempotencyOperation.INSERT_TIME_PUNCH, {
      occurredAt: '2026-08-14T11:00:00.000Z',
      employeeId: actorId,
    });

    expect(first).toBe(reordered);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(service.hashKey(actorId, IdempotencyOperation.INSERT_TIME_PUNCH, key)).not.toBe(first);
  });
});

describe('IdempotencyService', () => {
  it('locks the idempotency scope then actor before replaying a completed response', async () => {
    const hash = hasher();
    const requestFingerprint = hash.fingerprint(IdempotencyOperation.CREATE_TIME_PUNCH, {
      action: 'create-own-time-punch',
    });
    const locksShape = {
      acquireIdempotencyLock: vi.fn().mockResolvedValue(undefined),
      lockActor: vi.fn().mockResolvedValue({ id: actorId, role: 'EMPLOYEE', isActive: true }),
    };
    const harness = transactionHarness({
      requestFingerprint,
      status: IdempotencyStatus.COMPLETED,
      responseStatus: 201,
      responseBody: { idempotencyKey: key },
    });
    const service = new IdempotencyService(hash, locksShape as unknown as MutationLockService);

    await expect(
      service.begin(harness.transaction as never, {
        actorId,
        requiredRole: 'EMPLOYEE',
        operation: IdempotencyOperation.CREATE_TIME_PUNCH,
        key,
        fingerprintPayload: { action: 'create-own-time-punch' },
        now,
      }),
    ).resolves.toEqual({
      kind: 'REPLAY',
      responseStatus: 201,
      response: { idempotencyKey: key },
    });
    expect(locksShape.acquireIdempotencyLock.mock.invocationCallOrder[0]).toBeLessThan(
      locksShape.lockActor.mock.invocationCallOrder[0]!,
    );
    expect(locksShape.lockActor.mock.invocationCallOrder[0]).toBeLessThan(
      harness.findUnique.mock.invocationCallOrder[0]!,
    );
  });

  it('rejects reuse with a different fingerprint', async () => {
    const locks = {
      acquireIdempotencyLock: vi.fn().mockResolvedValue(undefined),
      lockActor: vi.fn().mockResolvedValue({}),
    } as unknown as MutationLockService;
    const harness = transactionHarness({
      requestFingerprint: '0'.repeat(64),
      status: IdempotencyStatus.COMPLETED,
      responseStatus: 201,
      responseBody: {},
    });
    const service = new IdempotencyService(hasher(), locks);

    await expect(
      service.begin(harness.transaction as never, {
        actorId,
        requiredRole: 'ADMIN',
        operation: IdempotencyOperation.ADJUST_TIME_PUNCH,
        key,
        fingerprintPayload: { correctedOccurredAt: 'different' },
        now,
      }),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: 'IDEMPOTENCY_KEY_REUSED' },
    });
  });

  it('creates a transient claim and completes it with a bounded response', async () => {
    const locks = {
      acquireIdempotencyLock: vi.fn().mockResolvedValue(undefined),
      lockActor: vi.fn().mockResolvedValue({}),
    } as unknown as MutationLockService;
    const harness = transactionHarness();
    const service = new IdempotencyService(hasher(), locks);
    const start = await service.begin(harness.transaction as never, {
      actorId,
      requiredRole: 'EMPLOYEE',
      operation: IdempotencyOperation.CREATE_TIME_PUNCH,
      key,
      fingerprintPayload: {},
      now,
    });

    expect(start).toEqual({ kind: 'CLAIM', recordId: '9bb83b30-89ea-44b2-8996-ef89d380d527' });
    expect(harness.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId,
          operation: IdempotencyOperation.CREATE_TIME_PUNCH,
          createdAt: now,
        }),
      }),
    );
    await service.complete(
      harness.transaction as never,
      '9bb83b30-89ea-44b2-8996-ef89d380d527',
      201,
      { idempotencyKey: key },
    );
    expect(harness.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: IdempotencyStatus.COMPLETED }),
      }),
    );
  });
});
