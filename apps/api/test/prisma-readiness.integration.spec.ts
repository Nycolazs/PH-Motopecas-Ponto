import { readdir, rm } from 'node:fs/promises';

import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { healthResponseSchema } from '@ph-ponto/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/bootstrap.js';
import { PrismaService } from '../src/database/prisma.service.js';

const uploadDirectory = process.env.UPLOAD_DIR!;

describe('API readiness with real PostgreSQL', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication<NestExpressApplication>();
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
    await rm(uploadDirectory, { recursive: true, force: true });
  });

  it('reports ready only after real database and storage probes succeed', async () => {
    const response = await request(app.getHttpServer()).get('/health/ready').expect(200);
    expect(healthResponseSchema.parse(response.body).status).toBe('ok');

    const files = await readdir(uploadDirectory);
    expect(files.filter((name) => name.startsWith('.ph-ponto-readiness-'))).toEqual([]);
  });

  it('keeps PostgreSQL sessions and timestamptz round trips in UTC', async () => {
    const instant = new Date('2018-11-04T02:30:00.000Z');
    const [row] = await prisma.$queryRaw<Array<{ timezone: string; instant: Date }>>`
      SELECT current_setting('TimeZone') AS "timezone", ${instant}::timestamptz AS "instant"
    `;

    expect(row).toBeDefined();
    expect(row!.timezone).toBe('UTC');
    expect(row!.instant.toISOString()).toBe(instant.toISOString());
  });
});
