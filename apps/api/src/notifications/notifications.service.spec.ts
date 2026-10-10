import { describe, expect, it, vi } from 'vitest';

import { NotificationKind, NotificationStatus } from '../generated/prisma/client.js';
import {
  NotificationsService,
  regulationToleranceMinutes,
  retryDelayMs,
} from './notifications.service.js';
import { WhatsappGatewayError, type WhatsappGateway } from './whatsapp-gateway.js';

const EMPLOYEE_ID = '10000000-0000-4000-8000-000000000001';
const ADMIN_ID = '20000000-0000-4000-8000-000000000002';

function createFixture(
  options: { settings?: unknown; recipients?: unknown[]; regulation?: unknown } = {},
) {
  const prisma = {
    companyRegulationVersion: {
      findFirst: vi.fn().mockResolvedValue(options.regulation ?? null),
    },
    appSetting: {
      findUnique: vi
        .fn()
        .mockResolvedValue(options.settings === undefined ? null : { value: options.settings }),
    },
    user: { findUnique: vi.fn().mockResolvedValue({ name: 'DIEGO PEREIRA DANTAS' }) },
    adminNotificationPreference: {
      findMany: vi
        .fn()
        .mockResolvedValue(
          options.recipients ?? [{ userId: ADMIN_ID, whatsappPhone: '5585999990000' }],
        ),
    },
    notificationOutbox: {
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
  };
  const gateway = {
    isConfigured: true,
    sendText: vi.fn().mockResolvedValue('message-id'),
  };
  const config = { get: vi.fn().mockReturnValue(undefined) };
  const service = new NotificationsService(
    prisma as never,
    { record: vi.fn() } as never,
    gateway as unknown as WhatsappGateway,
    config as never,
  );
  vi.spyOn(service, 'dispatchPending').mockResolvedValue();
  return { service, prisma, gateway };
}

const openAt8 = { isOpen: true, openingMinute: 480 };

describe('NotificationsService.onFirstClockIn', () => {
  it('queues one WhatsApp alert per recipient when the first clock-in is late', async () => {
    const { service, prisma } = createFixture();

    const queued = await service.onFirstClockIn({
      employeeId: EMPLOYEE_ID,
      businessDate: '2026-10-09',
      clockInAt: new Date('2026-10-09T11:12:00.000Z'),
      expectation: openAt8,
    });

    expect(queued).toBe(1);
    const { data, skipDuplicates } = prisma.notificationOutbox.createMany.mock.calls[0]![0];
    expect(skipDuplicates).toBe(true);
    expect(data).toEqual([
      expect.objectContaining({
        kind: NotificationKind.LATE_ARRIVAL,
        dedupeKey: `LATE_ARRIVAL:${EMPLOYEE_ID}:2026-10-09:${ADMIN_ID}`,
        phone: '5585999990000',
        message: expect.stringContaining('*Colaborador:* Diego Pereira Dantas'),
      }),
    ]);
    expect(data[0].message).toContain('*Entrada:* 08:12 (previsto 08:00)');
  });

  it('uses the tolerance of the Regimento Interno in effect and the on/off switch', async () => {
    const onTime = createFixture({
      settings: { enabled: true },
      regulation: { versionNumber: 2, content: { workSchedule: { toleranceMinutes: 15 } } },
    });
    await expect(
      onTime.service.onFirstClockIn({
        employeeId: EMPLOYEE_ID,
        businessDate: '2026-10-09',
        clockInAt: new Date('2026-10-09T11:12:00.000Z'),
        expectation: openAt8,
      }),
    ).resolves.toBe(0);
    expect(onTime.prisma.notificationOutbox.createMany).not.toHaveBeenCalled();
    expect(onTime.prisma.companyRegulationVersion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { effectiveDate: { lte: new Date('2026-10-09T12:00:00.000Z') } },
      }),
    );

    const disabled = createFixture({ settings: { enabled: false } });
    await expect(
      disabled.service.onFirstClockIn({
        employeeId: EMPLOYEE_ID,
        businessDate: '2026-10-09',
        clockInAt: new Date('2026-10-09T12:00:00.000Z'),
        expectation: openAt8,
      }),
    ).resolves.toBe(0);
  });

  it('does nothing when no administrator receives alerts', async () => {
    const { service, prisma } = createFixture({ recipients: [] });
    await expect(
      service.onFirstClockIn({
        employeeId: EMPLOYEE_ID,
        businessDate: '2026-10-09',
        clockInAt: new Date('2026-10-09T12:00:00.000Z'),
        expectation: openAt8,
      }),
    ).resolves.toBe(0);
    expect(prisma.notificationOutbox.createMany).not.toHaveBeenCalled();
  });
});

describe('late-arrival tolerance', () => {
  it('falls back to 5 minutes when no Regimento Interno is published', async () => {
    const { service } = createFixture();
    await expect(service.resolveTolerance('2026-10-09')).resolves.toEqual({
      toleranceMinutes: 5,
      source: 'DEFAULT',
      regulationVersion: null,
    });
  });

  it('reports the regulation version that defines the tolerance', async () => {
    const { service } = createFixture({
      regulation: { versionNumber: 3, content: { workSchedule: { toleranceMinutes: 10 } } },
    });
    await expect(service.resolveTolerance('2026-10-09')).resolves.toEqual({
      toleranceMinutes: 10,
      source: 'REGULATION',
      regulationVersion: 3,
    });
  });

  it('ignores malformed regulation content', () => {
    expect(regulationToleranceMinutes({ workSchedule: { toleranceMinutes: '7' } })).toBeNull();
    expect(regulationToleranceMinutes({ workSchedule: { toleranceMinutes: -1 } })).toBeNull();
    expect(regulationToleranceMinutes(null)).toBeNull();
    expect(regulationToleranceMinutes({ workSchedule: { toleranceMinutes: 0 } })).toBe(0);
  });
});

describe('NotificationsService.dispatchPending', () => {
  const now = new Date('2026-10-09T12:00:00.000Z');
  const pendingRow = (overrides: Record<string, unknown> = {}) => ({
    id: '30000000-0000-4000-8000-000000000003',
    phone: '5585999990000',
    message: 'alerta',
    attempts: 0,
    createdAt: new Date('2026-10-09T11:59:00.000Z'),
    ...overrides,
  });

  function dispatcher(rows: unknown[]) {
    const fixture = createFixture();
    vi.mocked(fixture.service.dispatchPending).mockRestore();
    fixture.prisma.notificationOutbox.findMany.mockResolvedValue(rows);
    return fixture;
  }

  it('marks delivered messages as sent', async () => {
    const { service, prisma, gateway } = dispatcher([pendingRow()]);
    await service.dispatchPending(now);
    expect(gateway.sendText).toHaveBeenCalledWith('5585999990000', 'alerta');
    expect(prisma.notificationOutbox.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: NotificationStatus.SENT, attempts: 1 }),
      }),
    );
  });

  it('retries failed deliveries with backoff and gives up after the limit', async () => {
    const { service, prisma, gateway } = dispatcher([pendingRow({ attempts: 2 })]);
    gateway.sendText.mockRejectedValue(
      new WhatsappGatewayError('WhatsApp não está conectado.', true),
    );
    await service.dispatchPending(now);
    expect(prisma.notificationOutbox.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          attempts: 3,
          lastError: 'WhatsApp não está conectado.',
          nextAttemptAt: new Date(now.getTime() + retryDelayMs(3)),
        },
      }),
    );

    const last = dispatcher([pendingRow({ attempts: 11 })]);
    last.gateway.sendText.mockRejectedValue(new WhatsappGatewayError('falhou', true));
    await last.service.dispatchPending(now);
    expect(last.prisma.notificationOutbox.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: NotificationStatus.FAILED, attempts: 12 }),
      }),
    );
  });

  it('expires alerts that could not be delivered for half a day', async () => {
    const { service, prisma, gateway } = dispatcher([
      pendingRow({ createdAt: new Date('2026-10-08T20:00:00.000Z') }),
    ]);
    await service.dispatchPending(now);
    expect(gateway.sendText).not.toHaveBeenCalled();
    expect(prisma.notificationOutbox.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: NotificationStatus.FAILED }),
      }),
    );
  });

  it('caps the retry delay at 30 minutes', () => {
    expect(retryDelayMs(1)).toBe(30_000);
    expect(retryDelayMs(2)).toBe(60_000);
    expect(retryDelayMs(20)).toBe(30 * 60 * 1000);
  });
});
