import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { healthResponseSchema } from '@ph-ponto/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/bootstrap.js';
import type { EnvironmentVariables } from '../src/config/environment.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { StorageReadinessService } from '../src/storage/storage-readiness.service.js';

describe('API smoke', () => {
  let app: NestExpressApplication;
  const prisma = {
    ping: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    $disconnect: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  };
  const storage = {
    ping: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(StorageReadinessService)
      .useValue(storage)
      .compile();

    app = module.createNestApplication<NestExpressApplication>();
    configureApplication(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves liveness with security and correlation headers', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(healthResponseSchema.parse(response.body)).toMatchObject({
      status: 'ok',
      service: 'api',
    });
    expect(response.headers).toHaveProperty('x-request-id');
    expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
  });

  it('checks PostgreSQL and storage readiness', async () => {
    const response = await request(app.getHttpServer()).get('/health/ready').expect(200);

    expect(response.body.status).toBe('ok');
    expect(prisma.ping).toHaveBeenCalledOnce();
    expect(storage.ping).toHaveBeenCalledOnce();
  });

  it('returns a safe Portuguese problem for unknown routes', async () => {
    const response = await request(app.getHttpServer())
      .get('/missing')
      .set('X-Request-Id', 'smoke-test-request')
      .expect(404);

    expect(response.body).toMatchObject({
      status: 404,
      code: 'RESOURCE_NOT_FOUND',
      message: 'Recurso não encontrado.',
      requestId: 'smoke-test-request',
    });
  });

  it('does not expose Swagger when disabled', async () => {
    await request(app.getHttpServer()).get('/docs').expect(404);
    expect(app.get(ConfigService<EnvironmentVariables, true>).get('SWAGGER_ENABLED')).toBe(false);
  });
});
