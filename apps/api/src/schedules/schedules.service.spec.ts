import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { AuthenticatedUser, ClientContext } from '../auth/auth.types.js';
import { REQUIRED_ROLES_KEY } from '../auth/auth.constants.js';
import type { AuditService } from '../audit/audit.service.js';
import type { PrismaService } from '../database/prisma.service.js';
import { AuditAction, AuditTargetType, Weekday } from '../generated/prisma/client.js';
import { businessDateToDatabaseDate, isBusinessDate } from './business-date.js';
import { calculateExpectedMinutes } from './business-hours.js';
import { ScheduleResolverService } from './schedule-resolver.service.js';
import type { CreateBusinessScheduleDto } from './schedule.dto.js';
import { assertValidScheduleDays } from './schedule.validation.js';
import { SchedulesController } from './schedules.controller.js';
import { SchedulesService } from './schedules.service.js';

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
const clock = (): Date => new Date('2026-08-15T03:00:00.000Z');

function scheduleDays(): CreateBusinessScheduleDto['days'] {
  return Object.values(Weekday).map((weekday) => ({
    weekday,
    isOpen: weekday !== Weekday.SUNDAY,
    openingMinute: weekday === Weekday.SUNDAY ? null : 480,
    closingMinute: weekday === Weekday.SUNDAY ? null : 1_020,
    lunchEnabled: weekday !== Weekday.SATURDAY && weekday !== Weekday.SUNDAY,
    lunchStartMinute: weekday === Weekday.SATURDAY || weekday === Weekday.SUNDAY ? null : 720,
    lunchEndMinute: weekday === Weekday.SATURDAY || weekday === Weekday.SUNDAY ? null : 780,
  }));
}

function scheduleRecord(effectiveDate = '2026-09-01', note: string | null = 'Novo horário') {
  return {
    id: '30000000-0000-4000-8000-000000000001',
    effectiveDate: businessDateToDatabaseDate(effectiveDate),
    note,
    createdAt: new Date('2026-08-15T01:00:00.000Z'),
    createdBy: { id: actor.id, name: actor.name, login: actor.login },
    days: scheduleDays().map((day) => ({
      ...day,
      openingMinute: day.openingMinute ?? null,
      closingMinute: day.closingMinute ?? null,
      lunchStartMinute: day.lunchStartMinute ?? null,
      lunchEndMinute: day.lunchEndMinute ?? null,
    })),
  };
}

describe('schedule rules', () => {
  it('validates leap days without implicit string date parsing', () => {
    expect(isBusinessDate('2028-02-29')).toBe(true);
    expect(isBusinessDate('2027-02-29')).toBe(false);
    expect(isBusinessDate('2026-09-01T00:00:00Z')).toBe(false);
  });

  it('rejects duplicated weekdays and impossible hours', () => {
    const duplicate = scheduleDays();
    duplicate[6] = { ...duplicate[6]!, weekday: Weekday.MONDAY };
    expect(() => assertValidScheduleDays(duplicate)).toThrow(BadRequestException);

    const impossible = scheduleDays();
    impossible[0] = {
      ...impossible[0]!,
      openingMinute: 1_000,
      closingMinute: 900,
    };
    expect(() => assertValidScheduleDays(impossible)).toThrow(BadRequestException);
  });

  it('calculates expected minutes after subtracting lunch exactly once', () => {
    expect(
      calculateExpectedMinutes({
        isOpen: true,
        openingMinute: 480,
        closingMinute: 1_020,
        lunchEnabled: true,
        lunchStartMinute: 720,
        lunchEndMinute: 780,
      }),
    ).toBe(480);
  });
});

describe('SchedulesService', () => {
  it('creates all seven days and the audit event in one serialized transaction', async () => {
    const record = scheduleRecord('2026-09-01', null);
    const transaction = {
      $queryRaw: vi.fn().mockResolvedValue([{ acquired: '' }]),
      businessScheduleVersion: {
        findFirst: vi.fn().mockResolvedValue({
          effectiveDate: businessDateToDatabaseDate('2026-08-01'),
        }),
        create: vi.fn().mockResolvedValue(record),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    const audit = { record: vi.fn().mockResolvedValue('audit-1') };
    const service = new SchedulesService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      clock,
    );

    const result = await service.create(
      actor,
      {
        effectiveDate: '2026-09-01',
        note: null as unknown as string,
        days: scheduleDays(),
      },
      context,
    );

    expect(transaction.$queryRaw).toHaveBeenCalledOnce();
    expect(transaction.businessScheduleVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          effectiveDate: businessDateToDatabaseDate('2026-09-01'),
          note: null,
          days: { create: expect.arrayContaining(scheduleDays()) },
        }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.SCHEDULE_CREATED,
        targetType: AuditTargetType.SCHEDULE,
        targetId: record.id,
      }),
      transaction,
    );
    expect(result.days).toHaveLength(7);
  });

  it('rejects a version that is not strictly later than the latest one', async () => {
    const transaction = {
      $queryRaw: vi.fn().mockResolvedValue([{ acquired: '' }]),
      businessScheduleVersion: {
        findFirst: vi.fn().mockResolvedValue({
          effectiveDate: businessDateToDatabaseDate('2026-09-01'),
        }),
        create: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    const service = new SchedulesService(
      prisma as unknown as PrismaService,
      { record: vi.fn() } as unknown as AuditService,
      clock,
    );

    await expect(
      service.create(
        actor,
        { effectiveDate: '2026-08-31', note: null as unknown as string, days: scheduleDays() },
        context,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transaction.businessScheduleVersion.create).not.toHaveBeenCalled();
  });

  it('allows today but rejects an effective date before today in São Paulo', async () => {
    const transaction = {
      $queryRaw: vi.fn().mockResolvedValue([{ acquired: '' }]),
      businessScheduleVersion: {
        findFirst: vi.fn().mockResolvedValue({
          effectiveDate: businessDateToDatabaseDate('2026-08-01'),
        }),
        create: vi.fn().mockResolvedValue(scheduleRecord('2026-08-15')),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    const service = new SchedulesService(
      prisma as unknown as PrismaService,
      { record: vi.fn().mockResolvedValue('audit-1') } as unknown as AuditService,
      clock,
    );

    await expect(
      service.create(actor, { effectiveDate: '2026-08-14', days: scheduleDays() }, context),
    ).rejects.toMatchObject({ response: { code: 'SCHEDULE_EFFECTIVE_DATE_IN_PAST' } });
    expect(prisma.$transaction).not.toHaveBeenCalled();

    await expect(
      service.create(actor, { effectiveDate: '2026-08-15', days: scheduleDays() }, context),
    ).resolves.toMatchObject({ effectiveDate: '2026-08-15' });
  });
});

describe('ScheduleResolverService', () => {
  it('resolves the effective version and weekday with base expected minutes', async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: '30000000-0000-4000-8000-000000000001',
      effectiveDate: businessDateToDatabaseDate('2026-08-01'),
      days: [
        {
          weekday: Weekday.TUESDAY,
          isOpen: true,
          openingMinute: 480,
          closingMinute: 1_020,
          lunchEnabled: true,
          lunchStartMinute: 720,
          lunchEndMinute: 780,
        },
      ],
    });
    const service = new ScheduleResolverService({
      businessScheduleVersion: { findFirst },
    } as unknown as PrismaService);

    const result = await service.resolveForDate('2026-09-01');

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { effectiveDate: { lte: businessDateToDatabaseDate('2026-09-01') } },
      }),
    );
    expect(result.day).toMatchObject({ weekday: Weekday.TUESDAY, expectedMinutes: 480 });
  });

  it('fails safely when no complete schedule covers the date', async () => {
    const service = new ScheduleResolverService({
      businessScheduleVersion: { findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService);

    await expect(service.resolveForDate('1969-12-31')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});

describe('SchedulesController authorization', () => {
  it('requires the ADMIN role for every route in the controller', () => {
    expect(Reflect.getMetadata(REQUIRED_ROLES_KEY, SchedulesController)).toEqual(['ADMIN']);
  });
});
