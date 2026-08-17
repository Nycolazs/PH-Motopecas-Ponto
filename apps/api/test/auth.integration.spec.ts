import { randomUUID } from 'node:crypto';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { PasswordService } from '../src/auth/password.service.js';
import { configureApplication } from '../src/bootstrap.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { AuditAction, SessionRevocationReason, UserRole } from '../src/generated/prisma/client.js';
import { clearApplicationData } from './database-test-helpers.js';

const ADMIN_PASSWORD = 'admin-password-123';
const EMPLOYEE_PASSWORD = 'employee-password-123';
const NEW_EMPLOYEE_PASSWORD = 'employee-password-456';

describe('authentication and authorization with real PostgreSQL', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let adminPasswordHash: string;
  let employeePasswordHash: string;
  let adminId: string;
  let employeeId: string;

  beforeAll(async () => {
    const moduleReference = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleReference.createNestApplication<NestExpressApplication>();
    configureApplication(app);
    await app.init();

    prisma = app.get(PrismaService);
    const passwords = app.get(PasswordService);
    [adminPasswordHash, employeePasswordHash] = await Promise.all([
      passwords.hash(ADMIN_PASSWORD),
      passwords.hash(EMPLOYEE_PASSWORD),
    ]);
  });

  beforeEach(async () => {
    await clearApplicationData(prisma);
    const [admin, employee] = await Promise.all([
      prisma.user.create({
        data: {
          name: 'Administrador de teste',
          login: 'admin.integration',
          normalizedLogin: 'admin.integration',
          passwordHash: adminPasswordHash,
          role: UserRole.ADMIN,
        },
      }),
      prisma.user.create({
        data: {
          name: 'Funcionário de teste',
          login: 'employee.integration',
          normalizedLogin: 'employee.integration',
          passwordHash: employeePasswordHash,
          role: UserRole.EMPLOYEE,
        },
      }),
    ]);
    adminId = admin.id;
    employeeId = employee.id;
  });

  afterAll(async () => {
    await clearApplicationData(prisma);
    await app.close();
  });

  async function login(login: string, password: string) {
    return request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Request-Id', `integration-login-${randomUUID()}`)
      .send({ login, password, deviceName: 'Teste de integração' })
      .expect(200);
  }

  it('protects routes, exposes only the own profile, and enforces ADMIN role boundaries', async () => {
    const unauthenticated = await request(app.getHttpServer()).get('/users/me').expect(401);
    expect(unauthenticated.body.code).toBe('AUTHENTICATION_REQUIRED');

    const employeeLogin = await login('EMPLOYEE.INTEGRATION', EMPLOYEE_PASSWORD);
    const employeeAccessToken = employeeLogin.body.accessToken as string;
    const ownProfile = await request(app.getHttpServer())
      .get('/users/me')
      .auth(employeeAccessToken, { type: 'bearer' })
      .expect(200);
    expect(ownProfile.body).toMatchObject({ id: employeeId, role: UserRole.EMPLOYEE });
    expect(JSON.stringify(ownProfile.body)).not.toContain('password');

    const forbidden = await request(app.getHttpServer())
      .get(`/employees/${adminId}`)
      .auth(employeeAccessToken, { type: 'bearer' })
      .expect(403);
    expect(forbidden.body.code).toBe('FORBIDDEN');

    const adminLogin = await login('admin.integration', ADMIN_PASSWORD);
    const employeeList = await request(app.getHttpServer())
      .get('/employees')
      .auth(adminLogin.body.accessToken as string, { type: 'bearer' })
      .expect(200);
    expect(employeeList.body.items).toEqual([
      expect.objectContaining({ id: employeeId, role: UserRole.EMPLOYEE }),
    ]);
    expect(JSON.stringify(employeeList.body)).not.toContain('passwordHash');

    const audits = await request(app.getHttpServer())
      .get('/audit-logs')
      .auth(adminLogin.body.accessToken as string, { type: 'bearer' })
      .expect(200);
    expect(audits.body.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ action: AuditAction.LOGIN_SUCCEEDED })]),
    );
  });

  it('rotates twice and revokes the complete refresh family when an old token is replayed', async () => {
    const initial = await login('admin.integration', ADMIN_PASSWORD);
    const firstRotation = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: initial.body.refreshToken })
      .expect(200);
    const secondRotation = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: firstRotation.body.refreshToken })
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: firstRotation.body.refreshToken })
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: secondRotation.body.refreshToken })
      .expect(401);

    const sessions = await prisma.refreshSession.findMany({ where: { userId: adminId } });
    expect(sessions).toHaveLength(3);
    expect(
      sessions.every(
        (session) =>
          session.revokedAt !== null &&
          session.revocationReason === SessionRevocationReason.REFRESH_REUSE,
      ),
    ).toBe(true);
    expect(
      await prisma.auditLog.count({
        where: { actorId: adminId, action: AuditAction.REFRESH_REUSED },
      }),
    ).toBe(1);
  });

  it('rejects inactive users without creating a session and records a safe failed login', async () => {
    await prisma.user.update({ where: { id: employeeId }, data: { isActive: false } });

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ login: 'employee.integration', password: EMPLOYEE_PASSWORD })
      .expect(401);
    expect(response.body).toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: 'Login ou senha inválidos.',
    });
    expect(await prisma.refreshSession.count({ where: { userId: employeeId } })).toBe(0);

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { actorId: employeeId, action: AuditAction.LOGIN_FAILED },
    });
    expect(JSON.stringify(audit)).not.toContain(EMPLOYEE_PASSWORD);
    expect(JSON.stringify(audit)).not.toContain(employeePasswordHash);
  });

  it('protects the last ADMIN and audits password reset without disrupting active sessions', async () => {
    const adminLogin = await login('admin.integration', ADMIN_PASSWORD);
    const adminAccessToken = adminLogin.body.accessToken as string;

    const lastAdmin = await request(app.getHttpServer())
      .patch(`/admins/${adminId}/status`)
      .auth(adminAccessToken, { type: 'bearer' })
      .send({ isActive: false })
      .expect(409);
    expect(lastAdmin.body.code).toBe('LAST_ACTIVE_ADMIN');

    const createdAdmin = await request(app.getHttpServer())
      .post('/admins')
      .auth(adminAccessToken, { type: 'bearer' })
      .send({ name: 'Segundo administrador', login: 'admin.two', password: 'admin-two-password' })
      .expect(201);
    expect(createdAdmin.body).toMatchObject({ role: UserRole.ADMIN, isActive: true });
    expect(JSON.stringify(createdAdmin.body)).not.toContain('password');

    await request(app.getHttpServer())
      .post('/employees')
      .auth(adminAccessToken, { type: 'bearer' })
      .send({ name: 'Duplicado', login: 'EMPLOYEE.INTEGRATION', password: 'another-password' })
      .expect(409);

    const employeeLogin = await login('employee.integration', EMPLOYEE_PASSWORD);
    await request(app.getHttpServer())
      .post(`/employees/${employeeId}/password-reset`)
      .auth(adminAccessToken, { type: 'bearer' })
      .send({ password: NEW_EMPLOYEE_PASSWORD })
      .expect(204);

    await request(app.getHttpServer())
      .get('/auth/me')
      .auth(employeeLogin.body.accessToken as string, { type: 'bearer' })
      .expect(200);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ login: 'employee.integration', password: EMPLOYEE_PASSWORD })
      .expect(401);
    await login('employee.integration', NEW_EMPLOYEE_PASSWORD);

    expect(
      await prisma.auditLog.count({
        where: { actorId: adminId, action: AuditAction.USER_PASSWORD_RESET },
      }),
    ).toBe(1);
  });

  it('blocks brute-force attempts using privacy-preserving database buckets', async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ login: 'employee.integration', password: 'senha-incorreta' })
        .expect(401);
    }

    const blocked = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ login: 'employee.integration', password: EMPLOYEE_PASSWORD })
      .expect(429);
    expect(blocked.body.code).toBe('LOGIN_RATE_LIMITED');
    expect(await prisma.refreshSession.count({ where: { userId: employeeId } })).toBe(0);
    expect(await prisma.loginThrottle.count()).toBe(2);
  });
});
