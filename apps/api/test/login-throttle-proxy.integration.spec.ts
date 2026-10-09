import { randomUUID } from 'node:crypto';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Must be set before AppModule (and its ConfigModule) is imported.
vi.hoisted(() => {
  process.env.TRUST_PROXY_ADDRESSES = 'loopback';
  process.env.AUTH_LOGIN_IP_MAX_ATTEMPTS = '5';
});

import { AppModule } from '../src/app.module.js';
import { PasswordService } from '../src/auth/password.service.js';
import { configureApplication } from '../src/bootstrap.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { UserRole } from '../src/generated/prisma/client.js';
import { clearApplicationData } from './database-test-helpers.js';

const PASSWORD = 'proxy-throttle-password';

describe('login throttling behind the Cloudflare Tunnel proxy', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let passwordHash: string;

  beforeAll(async () => {
    const moduleReference = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleReference.createNestApplication<NestExpressApplication>();
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
    passwordHash = await app.get(PasswordService).hash(PASSWORD);
  });

  beforeEach(async () => {
    await clearApplicationData(prisma);
    await prisma.user.create({
      data: {
        name: 'Gerente da Loja',
        login: 'gerente.proxy',
        normalizedLogin: 'gerente.proxy',
        passwordHash,
        role: UserRole.ADMIN,
      },
    });
  });

  afterAll(async () => {
    await clearApplicationData(prisma);
    await app.close();
  });

  const attempt = (clientIp: string, login: string, password: string) =>
    request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Forwarded-For', clientIp)
      .send({ login, password });

  it("never lets one client's failed attempts block other people", async () => {
    // Someone guessing passwords for different logins from one address.
    for (let index = 0; index < 5; index += 1) {
      await attempt('203.0.113.10', `desconhecido-${randomUUID().slice(0, 6)}`, 'errada').expect(
        401,
      );
    }
    const blocked = await attempt('203.0.113.10', 'gerente.proxy', PASSWORD).expect(429);
    expect(blocked.body.code).toBe('LOGIN_RATE_LIMITED');

    // A different person, also arriving through the tunnel, logs in normally.
    const ok = await attempt('198.51.100.20', 'gerente.proxy', PASSWORD).expect(200);
    expect(ok.body.accessToken).toEqual(expect.any(String));
  });

  it('still protects each login against password guessing from many addresses', async () => {
    for (let index = 0; index < 3; index += 1) {
      await attempt(`192.0.2.${index + 1}`, 'gerente.proxy', 'errada').expect(401);
    }
    await attempt('192.0.2.99', 'gerente.proxy', PASSWORD).expect(429);
  });
});
