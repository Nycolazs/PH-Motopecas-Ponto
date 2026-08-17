import { healthResponseSchema } from '@ph-ponto/shared';
import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../database/prisma.service.js';
import type { StorageReadinessService } from '../storage/storage-readiness.service.js';
import { HealthService } from './health.service.js';

function createService(
  databasePing: () => Promise<void>,
  storagePing: () => Promise<void> = async () => undefined,
  timeoutMilliseconds = 100,
): HealthService {
  return new HealthService(
    { ping: databasePing } as unknown as PrismaService,
    { ping: storagePing } as unknown as StorageReadinessService,
    { get: () => timeoutMilliseconds } as never,
  );
}

describe('HealthService', () => {
  it('reports liveness without querying PostgreSQL', () => {
    const databasePing = vi.fn<() => Promise<void>>();
    const storagePing = vi.fn<() => Promise<void>>();
    const result = createService(databasePing, storagePing).liveness();

    expect(healthResponseSchema.parse(result)).toMatchObject({ status: 'ok', service: 'api' });
    expect(databasePing).not.toHaveBeenCalled();
    expect(storagePing).not.toHaveBeenCalled();
  });

  it('reports readiness after successful PostgreSQL and storage probes', async () => {
    const databasePing = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const storagePing = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const result = await createService(databasePing, storagePing).readiness();

    expect(result.status).toBe('ok');
    expect(databasePing).toHaveBeenCalledOnce();
    expect(storagePing).toHaveBeenCalledOnce();
  });

  it('reports degraded readiness without leaking a database error', async () => {
    const ping = vi
      .fn<() => Promise<void>>()
      .mockRejectedValue(new Error('postgresql://admin:secret@database.internal/ph_ponto'));
    const result = await createService(ping).readiness();

    expect(result.status).toBe('degraded');
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('reports degraded readiness when storage is unavailable', async () => {
    const databasePing = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const storagePing = vi.fn<() => Promise<void>>().mockRejectedValue(new Error('/private/path'));

    expect((await createService(databasePing, storagePing).readiness()).status).toBe('degraded');
  });

  it('bounds readiness checks with a timeout', async () => {
    const neverResolves = () => new Promise<void>(() => undefined);

    expect((await createService(neverResolves, neverResolves, 1).readiness()).status).toBe(
      'degraded',
    );
  });
});
