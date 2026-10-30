import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { PasswordService } from '../src/auth/password.service.js';
import { configureApplication } from '../src/bootstrap.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { AuditAction, UserRole, Weekday } from '../src/generated/prisma/client.js';
import { clearApplicationData } from './database-test-helpers.js';

const PASSWORD = 'justification-test-password';

function weekdaySchedule() {
  return Object.values(Weekday).map((weekday) =>
    weekday === Weekday.SUNDAY || weekday === Weekday.SATURDAY
      ? {
          weekday,
          isOpen: false,
          openingMinute: null,
          closingMinute: null,
          lunchEnabled: false,
          lunchStartMinute: null,
          lunchEndMinute: null,
        }
      : {
          weekday,
          isOpen: true,
          openingMinute: 480,
          closingMinute: 1_020,
          lunchEnabled: true,
          lunchStartMinute: 720,
          lunchEndMinute: 780,
        },
  );
}

describe('abono e atestado (absence justifications) with real PostgreSQL', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let passwordHash: string;
  let employeeId: string;
  let adminToken: string;
  let employeeToken: string;

  const http = () => request(app.getHttpServer());
  const asAdmin = <T extends request.Test>(test: T) => test.auth(adminToken, { type: 'bearer' });

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
    const createdAt = new Date('2025-01-01T00:00:00.000Z');
    const [admin, employee] = await Promise.all([
      prisma.user.create({
        data: {
          name: 'Gestora',
          login: 'gestora',
          normalizedLogin: 'gestora',
          passwordHash,
          role: UserRole.ADMIN,
          createdAt,
        },
      }),
      prisma.user.create({
        data: {
          name: 'Colaborador Atestado',
          login: 'colaborador',
          normalizedLogin: 'colaborador',
          passwordHash,
          role: UserRole.EMPLOYEE,
          createdAt,
        },
      }),
    ]);
    employeeId = employee.id;
    await prisma.businessScheduleVersion.create({
      data: {
        effectiveDate: new Date('2025-01-01T00:00:00.000Z'),
        createdById: admin.id,
        days: { create: weekdaySchedule() },
      },
    });
    const login = async (name: string) =>
      (await http().post('/auth/login').send({ login: name, password: PASSWORD }).expect(200)).body
        .accessToken as string;
    adminToken = await login('gestora');
    employeeToken = await login('colaborador');
  });

  afterAll(async () => {
    await clearApplicationData(prisma);
    await app.close();
  });

  const justify = (body: Record<string, unknown>) =>
    asAdmin(http().post('/absence-justifications')).send({ employeeId, ...body });

  it('forgives the missing hours in the day, the history and the timesheet', async () => {
    // Monday 2026-01-05: worked 2h and left with an atestado for the day and Tuesday.
    // 08:00 and 10:00 in the business time zone (UTC-3).
    for (const occurredAt of ['2026-01-05T11:00:00.000Z', '2026-01-05T13:00:00.000Z']) {
      await asAdmin(http().post('/time-punches/manual'))
        .set('Idempotency-Key', randomUUID())
        .send({ employeeId, occurredAt, reason: 'Registro de teste.' })
        .expect(201);
    }
    const medical = await justify({
      kind: 'MEDICAL_CERTIFICATE',
      startDate: '2026-01-05',
      endDate: '2026-01-06',
      reason: 'Atestado de 2 dias',
    }).expect(201);
    expect(medical.body).toMatchObject({
      kind: 'MEDICAL_CERTIFICATE',
      daysCount: 2,
      revokedAt: null,
    });
    // Wednesday: abono.
    await justify({
      kind: 'ALLOWANCE',
      startDate: '2026-01-07',
      endDate: '2026-01-07',
      reason: 'Liberado pela gerência',
    }).expect(201);

    const history = await http()
      .get('/attendance/history')
      .query({ from: '2026-01-05', to: '2026-01-08' })
      .auth(employeeToken, { type: 'bearer' })
      .expect(200);
    const [monday, tuesday, wednesday, thursday] = history.body.days;
    expect(monday).toMatchObject({
      status: 'MEDICAL_LEAVE',
      calendarStatus: 'MEDICAL_LEAVE',
      exceptionName: 'Atestado médico: Atestado de 2 dias',
      expectedMinutes: 120,
      workedMinutes: 120,
      balanceMinutes: 0,
    });
    expect(tuesday).toMatchObject({
      status: 'MEDICAL_LEAVE',
      expectedMinutes: 0,
      balanceMinutes: 0,
    });
    expect(wednesday).toMatchObject({
      status: 'ALLOWANCE',
      exceptionName: 'Abono: Liberado pela gerência',
      balanceMinutes: 0,
    });
    expect(thursday).toMatchObject({ status: 'MISSING_HOURS', balanceMinutes: -480 });
    expect(history.body.totals).toMatchObject({ missingMinutes: 480, balanceMinutes: -480 });

    const report = await asAdmin(http().get('/attendance/reports/timesheets'))
      .query({ from: '2026-01-05', to: '2026-01-08' })
      .expect(200);
    expect(report.body.employees[0].totals).toMatchObject({ missingMinutes: 480 });

    const day = await asAdmin(http().get(`/attendance/employees/${employeeId}/day`))
      .query({ date: '2026-01-06' })
      .expect(200);
    expect(day.body.status).toBe('MEDICAL_LEAVE');
  });

  it('enforces one day per abono, no overlaps and no vacation days', async () => {
    await justify({
      kind: 'ALLOWANCE',
      startDate: '2026-01-05',
      endDate: '2026-01-06',
      reason: 'Dois dias',
    })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('ALLOWANCE_SINGLE_DAY'));
    await justify({
      kind: 'MEDICAL_CERTIFICATE',
      startDate: '2026-01-01',
      endDate: '2026-02-15',
      reason: 'Longo demais',
    })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('JUSTIFICATION_TOO_LONG'));
    await justify({
      kind: 'ALLOWANCE',
      startDate: '2026-01-05',
      endDate: '2026-01-05',
      reason: 'ok',
    }).expect(400);

    await justify({
      kind: 'MEDICAL_CERTIFICATE',
      startDate: '2026-01-05',
      endDate: '2026-01-07',
      reason: 'Atestado',
    }).expect(201);
    await justify({
      kind: 'ALLOWANCE',
      startDate: '2026-01-06',
      endDate: '2026-01-06',
      reason: 'Abono',
    })
      .expect(409)
      .expect(({ body }) => {
        expect(body.code).toBe('JUSTIFICATION_OVERLAP');
        expect(body.message).toContain('de 05/01/2026 a 07/01/2026');
      });

    await asAdmin(http().post('/vacations'))
      .send({ employeeId, startDate: '2026-02-02', endDate: '2026-02-13' })
      .expect(201);
    await justify({
      kind: 'ALLOWANCE',
      startDate: '2026-02-03',
      endDate: '2026-02-03',
      reason: 'Abono',
    })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('JUSTIFICATION_DURING_VACATION'));

    await http()
      .post('/absence-justifications')
      .auth(employeeToken, { type: 'bearer' })
      .send({
        employeeId,
        kind: 'ALLOWANCE',
        startDate: '2026-01-09',
        endDate: '2026-01-09',
        reason: 'Eu mesmo',
      })
      .expect(403);
  });

  it('cancels with a reason, keeps the history and audits both actions', async () => {
    const created = await justify({
      kind: 'ALLOWANCE',
      startDate: '2026-01-05',
      endDate: '2026-01-05',
      reason: 'Abono por engano',
    }).expect(201);
    const id = created.body.id as string;

    await asAdmin(http().post(`/absence-justifications/${id}/revoke`))
      .send({ reason: 'x' })
      .expect(400);
    const revoked = await asAdmin(http().post(`/absence-justifications/${id}/revoke`))
      .send({ reason: 'Lançado no dia errado' })
      .expect(200);
    expect(revoked.body).toMatchObject({ revokeReason: 'Lançado no dia errado' });
    expect(revoked.body.revokedBy.login).toBe('gestora');
    await asAdmin(http().post(`/absence-justifications/${id}/revoke`))
      .send({ reason: 'De novo' })
      .expect(409);

    const day = await asAdmin(http().get(`/attendance/employees/${employeeId}/day`))
      .query({ date: '2026-01-05' })
      .expect(200);
    expect(day.body).toMatchObject({ status: 'MISSING_HOURS', balanceMinutes: -480 });

    // The cancelled record stays listed, and the same day can be justified again.
    const list = await asAdmin(http().get('/absence-justifications'))
      .query({ employeeId })
      .expect(200);
    expect(list.body.items).toHaveLength(1);
    await justify({
      kind: 'ALLOWANCE',
      startDate: '2026-01-05',
      endDate: '2026-01-05',
      reason: 'Correto',
    }).expect(201);

    await expect(prisma.absenceJustification.delete({ where: { id } })).rejects.toThrow();
    const actions = await prisma.auditLog.findMany({
      where: { targetId: id },
      select: { action: true },
      orderBy: { createdAt: 'asc' },
    });
    expect(actions.map((log) => log.action)).toEqual([
      AuditAction.ABSENCE_JUSTIFIED,
      AuditAction.ABSENCE_JUSTIFICATION_REVOKED,
    ]);
  });

  it('stores atestado photos and PDFs encrypted and serves them back unchanged', async () => {
    const certificate = await justify({
      kind: 'MEDICAL_CERTIFICATE',
      startDate: '2026-01-12',
      endDate: '2026-01-13',
      reason: 'Atestado com foto',
    }).expect(201);
    const id = certificate.body.id as string;
    expect(certificate.body.attachments).toEqual([]);

    // A tiny real JPEG and PDF; the type comes from the bytes, not from the name.
    const jpeg = Buffer.from(
      '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
      'base64',
    );
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'latin1');
    const upload = (fileName: string, contents: Buffer, target = id) =>
      asAdmin(http().post(`/absence-justifications/${target}/attachments`)).send({
        fileName,
        dataBase64: `data:application/octet-stream;base64,${contents.toString('base64')}`,
      });

    const withPhoto = await upload('Foto do atestado.HEIC', jpeg).expect(201);
    expect(withPhoto.body.attachments).toHaveLength(1);
    expect(withPhoto.body.attachments[0]).toMatchObject({
      fileName: 'Foto do atestado.jpg',
      mimeType: 'image/jpeg',
      byteSize: jpeg.length,
    });
    const withPdf = await upload('../../etc/passwd.pdf', pdf).expect(201);
    const pdfAttachment = withPdf.body.attachments[1];
    expect(pdfAttachment).toMatchObject({ mimeType: 'application/pdf', fileName: 'passwd.pdf' });

    const served = await asAdmin(
      http().get(`/absence-justifications/${id}/attachments/${pdfAttachment.id}`),
    )
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(served.headers['content-type']).toBe('application/pdf');
    expect(served.headers['cache-control']).toBe('no-store');
    expect(Buffer.compare(served.body as Buffer, pdf)).toBe(0);

    // On disk the file is encrypted (no PDF header, no plaintext content).
    const uploadRoot = resolve(process.env.UPLOAD_DIR ?? '', 'justifications');
    const stored = await prisma.absenceJustificationAttachment.findUniqueOrThrow({
      where: { id: pdfAttachment.id as string },
    });
    const onDisk = await readFile(join(uploadRoot, stored.storagePath));
    expect(onDisk.subarray(0, 6).toString('ascii')).toBe('PHPDF1');
    expect(onDisk.includes(Buffer.from('%PDF'))).toBe(false);
    expect(stored.storagePath).toMatch(/^\d{4}\/\d{2}\/[0-9a-f-]{36}\.enc$/);
    expect((await readdir(join(uploadRoot, stored.storagePath, '..'))).length).toBeGreaterThan(0);

    await upload('virus.pdf', Buffer.from('MZ not really a pdf'))
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('UNSUPPORTED_ATTACHMENT_TYPE'));
    await asAdmin(http().post(`/absence-justifications/${id}/attachments`))
      .send({ fileName: 'x.jpg', dataBase64: 'não é base64!' })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('INVALID_ATTACHMENT'));
    await upload('grande.pdf', Buffer.concat([pdf, Buffer.alloc(7 * 1024 * 1024)]))
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('ATTACHMENT_TOO_LARGE'));

    for (let index = 0; index < 3; index += 1) await upload(`extra-${index}.jpg`, jpeg).expect(201);
    await upload('sexto.jpg', jpeg)
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('TOO_MANY_ATTACHMENTS'));

    await http()
      .get(`/absence-justifications/${id}/attachments/${pdfAttachment.id}`)
      .auth(employeeToken, { type: 'bearer' })
      .expect(403);
    await asAdmin(http().get(`/absence-justifications/${id}/attachments/${randomUUID()}`)).expect(
      404,
    );

    const allowance = await justify({
      kind: 'ALLOWANCE',
      startDate: '2026-01-14',
      endDate: '2026-01-14',
      reason: 'Abono',
    }).expect(201);
    await upload('abono.jpg', jpeg, allowance.body.id as string)
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('ATTACHMENT_ONLY_FOR_CERTIFICATES'));

    await asAdmin(http().post(`/absence-justifications/${id}/revoke`))
      .send({ reason: 'Teste de cancelamento' })
      .expect(200);
    await upload('depois.jpg', jpeg)
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('JUSTIFICATION_ALREADY_REVOKED'));
    // Cancelling keeps the evidence.
    const list = await asAdmin(http().get('/absence-justifications'))
      .query({ employeeId })
      .expect(200);
    const cancelled = list.body.items.find((item: { id: string }) => item.id === id);
    expect(cancelled.attachments).toHaveLength(5);
    await expect(
      prisma.absenceJustificationAttachment.delete({ where: { id: pdfAttachment.id as string } }),
    ).rejects.toThrow();
    expect(
      await prisma.auditLog.count({
        where: { targetId: id, action: AuditAction.ABSENCE_JUSTIFICATION_ATTACHMENT_ADDED },
      }),
    ).toBe(5);
  });
});
