import { BadRequestException, ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { AuthenticatedUser, ClientContext } from '../auth/auth.types.js';
import { REQUIRED_ROLES_KEY } from '../auth/auth.constants.js';
import type { AuditService } from '../audit/audit.service.js';
import type { PrismaService } from '../database/prisma.service.js';
import {
  AuditAction,
  AuditTargetType,
  CalendarExceptionKind,
  CalendarExceptionOperation,
} from '../generated/prisma/client.js';
import { businessDateToDatabaseDate } from '../schedules/business-date.js';
import { CalendarExceptionResolverService } from './calendar-exception-resolver.service.js';
import { normalizeAndValidateCalendarException } from './calendar-exception.validation.js';
import { CalendarExceptionsController } from './calendar-exceptions.controller.js';
import { CalendarExceptionsService } from './calendar-exceptions.service.js';

const actor: AuthenticatedUser = {
  id: '10000000-0000-4000-8000-000000000001',
  name: 'Administrador',
  login: 'admin',
  role: 'ADMIN',
  sessionId: '20000000-0000-4000-8000-000000000001',
};
const context: ClientContext = {
  ipHash: 'a'.repeat(64),
  requestId: 'request-1',
};

function revision(
  operation = CalendarExceptionOperation.UPSERT,
  kind: CalendarExceptionKind | null = CalendarExceptionKind.SPECIAL_HOURS,
  sequence = 1,
) {
  return {
    id: `40000000-0000-4000-8000-00000000000${sequence}`,
    sequence,
    operation,
    kind,
    name: operation === CalendarExceptionOperation.RETRACT ? null : 'Horário de inventário',
    openingMinute: kind === CalendarExceptionKind.SPECIAL_HOURS ? 540 : null,
    closingMinute: kind === CalendarExceptionKind.SPECIAL_HOURS ? 780 : null,
    lunchEnabled: false,
    lunchStartMinute: null,
    lunchEndMinute: null,
    createdAt: new Date(`2026-08-${String(14 + sequence).padStart(2, '0')}T01:00:00.000Z`),
    createdBy: { id: actor.id, name: actor.name, login: actor.login },
  };
}

function exceptionRecord(revisions = [revision()]) {
  return {
    id: '30000000-0000-4000-8000-000000000001',
    businessDate: businessDateToDatabaseDate('2026-09-07'),
    createdAt: new Date('2026-08-15T01:00:00.000Z'),
    revisions,
    _count: { revisions: revisions.length },
  };
}

describe('calendar exception rules', () => {
  it('rejects hours on holidays and impossible special-hour intervals', () => {
    expect(() =>
      normalizeAndValidateCalendarException({
        businessDate: '2026-09-07',
        kind: CalendarExceptionKind.HOLIDAY,
        name: 'Feriado',
        openingMinute: 480,
        lunchEnabled: false,
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      normalizeAndValidateCalendarException({
        businessDate: '2026-09-07',
        kind: CalendarExceptionKind.SPECIAL_HOURS,
        name: 'Horário especial',
        openingMinute: 900,
        closingMinute: 800,
        lunchEnabled: false,
      }),
    ).toThrow(BadRequestException);
  });
});

describe('CalendarExceptionResolverService', () => {
  it('returns the latest active revision with its expected minutes', async () => {
    const service = new CalendarExceptionResolverService({
      calendarException: {
        findUnique: vi.fn().mockResolvedValue({
          id: '30000000-0000-4000-8000-000000000001',
          revisions: [revision()],
        }),
      },
    } as unknown as PrismaService);

    await expect(service.resolveForDate('2026-09-07')).resolves.toMatchObject({
      kind: CalendarExceptionKind.SPECIAL_HOURS,
      expectedMinutes: 240,
      sequence: 1,
    });
  });

  it('returns null when the latest revision retracts the exception', async () => {
    const service = new CalendarExceptionResolverService({
      calendarException: {
        findUnique: vi.fn().mockResolvedValue({
          id: '30000000-0000-4000-8000-000000000001',
          revisions: [revision(CalendarExceptionOperation.RETRACT, null, 2)],
        }),
      },
    } as unknown as PrismaService);

    await expect(service.resolveForDate('2026-09-07')).resolves.toBeNull();
  });
});

describe('CalendarExceptionsService', () => {
  it('appends an UPSERT revision and its audit in the same serialized transaction', async () => {
    const before = revision(CalendarExceptionOperation.UPSERT, CalendarExceptionKind.HOLIDAY, 1);
    const after = revision(
      CalendarExceptionOperation.UPSERT,
      CalendarExceptionKind.SPECIAL_HOURS,
      2,
    );
    const record = exceptionRecord([after, before]);
    const transaction = {
      $queryRaw: vi.fn().mockResolvedValue([{ acquired: '' }]),
      calendarException: {
        findUnique: vi.fn().mockResolvedValueOnce({ id: record.id }).mockResolvedValueOnce(record),
        create: vi.fn(),
      },
      calendarExceptionRevision: {
        findFirst: vi.fn().mockResolvedValue(before),
        create: vi.fn().mockResolvedValue({ id: after.id }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    const audit = { record: vi.fn().mockResolvedValue('audit-1') };
    const service = new CalendarExceptionsService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
    );

    const result = await service.upsert(
      actor,
      {
        businessDate: '2026-09-07',
        kind: CalendarExceptionKind.SPECIAL_HOURS,
        name: 'Horário de inventário',
        openingMinute: 540,
        closingMinute: 780,
        lunchEnabled: false,
      },
      context,
    );

    expect(transaction.calendarExceptionRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sequence: 2 }) }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CALENDAR_EXCEPTION_UPDATED,
        targetType: AuditTargetType.CALENDAR_EXCEPTION,
        beforeState: expect.objectContaining({ sequence: 1 }),
        afterState: expect.objectContaining({ sequence: 2 }),
      }),
      transaction,
    );
    expect(result.revisions).toHaveLength(2);
  });

  it('appends a RETRACT revision and never updates or deletes history', async () => {
    const before = revision();
    const after = revision(CalendarExceptionOperation.RETRACT, null, 2);
    const record = exceptionRecord([after, before]);
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce({ id: record.id, businessDate: record.businessDate })
      .mockResolvedValueOnce(record);
    const transaction = {
      $queryRaw: vi.fn().mockResolvedValue([{ acquired: '' }]),
      calendarException: { findUnique },
      calendarExceptionRevision: {
        findFirst: vi.fn().mockResolvedValue(before),
        create: vi.fn().mockResolvedValue({ id: after.id }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    const audit = { record: vi.fn().mockResolvedValue('audit-1') };
    const service = new CalendarExceptionsService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
    );

    const result = await service.retract(actor, record.id, context);

    expect(transaction.calendarExceptionRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sequence: 2,
          operation: CalendarExceptionOperation.RETRACT,
        }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.CALENDAR_EXCEPTION_RETRACTED }),
      transaction,
    );
    expect(result.isActive).toBe(false);
    expect(transaction).not.toHaveProperty('update');
    expect(transaction).not.toHaveProperty('delete');
  });

  it('rejects retracting an already retracted exception', async () => {
    const current = revision(CalendarExceptionOperation.RETRACT, null, 2);
    const transaction = {
      $queryRaw: vi.fn().mockResolvedValue([{ acquired: '' }]),
      calendarException: {
        findUnique: vi.fn().mockResolvedValue({
          id: '30000000-0000-4000-8000-000000000001',
          businessDate: businessDateToDatabaseDate('2026-09-07'),
        }),
      },
      calendarExceptionRevision: {
        findFirst: vi.fn().mockResolvedValue(current),
        create: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    const service = new CalendarExceptionsService(
      prisma as unknown as PrismaService,
      { record: vi.fn() } as unknown as AuditService,
    );

    await expect(
      service.retract(actor, '30000000-0000-4000-8000-000000000001', context),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transaction.calendarExceptionRevision.create).not.toHaveBeenCalled();
  });
});

describe('CalendarExceptionsController authorization', () => {
  it('requires the ADMIN role for every route in the controller', () => {
    expect(Reflect.getMetadata(REQUIRED_ROLES_KEY, CalendarExceptionsController)).toEqual([
      'ADMIN',
    ]);
  });
});
