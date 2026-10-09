import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LocalWorkHours } from '@ph-ponto/shared';

import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser, ClientContext } from '../auth/auth.types.js';
import type { EnvironmentVariables } from '../config/environment.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  AuditAction,
  AuditTargetType,
  NotificationKind,
  NotificationStatus,
  UserRole,
} from '../generated/prisma/client.js';
import {
  buildLateArrivalMessage,
  DEFAULT_LATE_TOLERANCE_MINUTES,
  evaluateLateArrival,
  MAX_LATE_TOLERANCE_MINUTES,
  MIN_LATE_TOLERANCE_MINUTES,
  normalizeWhatsappPhone,
} from './late-arrival.js';
import { WhatsappGateway, WhatsappGatewayError, type WhatsappStatus } from './whatsapp-gateway.js';

export const WHATSAPP_GATEWAY = Symbol('WHATSAPP_GATEWAY');

const LATE_ARRIVAL_SETTING_KEY = 'notifications.late-arrival';
const DISPATCH_INTERVAL_MS = 15_000;
const DISPATCH_BATCH_SIZE = 20;
const MAX_ATTEMPTS = 12;
/** Alerts older than this are no longer useful and are marked as failed. */
const STALE_AFTER_MS = 12 * 60 * 60 * 1000;

export interface LateArrivalSettings {
  enabled: boolean;
  toleranceMinutes: number;
}

export interface NotificationRecipientView {
  userId: string;
  name: string;
  login: string;
  whatsappPhone: string | null;
  lateArrivalAlerts: boolean;
}

export interface NotificationOutboxView {
  id: string;
  kind: NotificationKind;
  status: NotificationStatus;
  recipientName: string | null;
  subjectName: string | null;
  phone: string;
  message: string;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
}

export interface FirstClockInEvent {
  employeeId: string;
  businessDate: string;
  clockInAt: Date;
  expectation: Pick<LocalWorkHours, 'isOpen' | 'openingMinute'>;
}

const DEFAULT_SETTINGS: LateArrivalSettings = {
  enabled: true,
  toleranceMinutes: DEFAULT_LATE_TOLERANCE_MINUTES,
};

function parseSettings(value: unknown): LateArrivalSettings {
  if (typeof value !== 'object' || value === null) return DEFAULT_SETTINGS;
  const record = value as Record<string, unknown>;
  const tolerance = Number(record.toleranceMinutes);
  return {
    enabled: typeof record.enabled === 'boolean' ? record.enabled : DEFAULT_SETTINGS.enabled,
    toleranceMinutes:
      Number.isInteger(tolerance) &&
      tolerance >= MIN_LATE_TOLERANCE_MINUTES &&
      tolerance <= MAX_LATE_TOLERANCE_MINUTES
        ? tolerance
        : DEFAULT_SETTINGS.toleranceMinutes,
  };
}

export function retryDelayMs(attempts: number): number {
  return Math.min(30_000 * 2 ** Math.max(0, attempts - 1), 30 * 60 * 1000);
}

@Injectable()
export class NotificationsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private dispatching = false;

  public constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(WHATSAPP_GATEWAY) private readonly gateway: WhatsappGateway,
    @Inject(ConfigService) private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  public onApplicationBootstrap(): void {
    const enabled = this.config.get('NOTIFICATIONS_DISPATCH_ENABLED', { infer: true }) ?? true;
    if (!enabled || !this.gateway.isConfigured) return;
    this.timer = setInterval(() => void this.dispatchPending(), DISPATCH_INTERVAL_MS);
    this.timer.unref?.();
  }

  public onModuleDestroy(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  // ---------------------------------------------------------------- settings

  public async getLateArrivalSettings(): Promise<LateArrivalSettings> {
    const row = await this.prisma.appSetting.findUnique({
      where: { key: LATE_ARRIVAL_SETTING_KEY },
    });
    return parseSettings(row?.value);
  }

  public async updateLateArrivalSettings(
    actor: AuthenticatedUser,
    input: LateArrivalSettings,
    context: ClientContext,
  ): Promise<LateArrivalSettings> {
    const next = parseSettings(input);
    if (next.toleranceMinutes !== input.toleranceMinutes) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `A tolerância deve ser um número inteiro entre ${MIN_LATE_TOLERANCE_MINUTES} e ${MAX_LATE_TOLERANCE_MINUTES} minutos.`,
      });
    }
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.appSetting.findUnique({ where: { key: LATE_ARRIVAL_SETTING_KEY } });
      await tx.appSetting.upsert({
        where: { key: LATE_ARRIVAL_SETTING_KEY },
        create: { key: LATE_ARRIVAL_SETTING_KEY, value: { ...next }, updatedById: actor.id },
        update: { value: { ...next }, updatedById: actor.id },
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.SETTING_UPDATED,
          targetType: AuditTargetType.SETTING,
          targetId: LATE_ARRIVAL_SETTING_KEY,
          ...context,
          beforeState: { ...parseSettings(before?.value) },
          afterState: { ...next },
        },
        tx,
      );
      return next;
    });
  }

  public async listRecipients(): Promise<NotificationRecipientView[]> {
    const admins = await this.prisma.user.findMany({
      where: { role: UserRole.ADMIN, isActive: true },
      orderBy: [{ name: 'asc' }, { login: 'asc' }],
      select: { id: true, name: true, login: true, notificationPreference: true },
    });
    return admins.map((admin) => ({
      userId: admin.id,
      name: admin.name,
      login: admin.login,
      whatsappPhone: admin.notificationPreference?.whatsappPhone ?? null,
      lateArrivalAlerts: admin.notificationPreference?.lateArrivalAlerts ?? false,
    }));
  }

  public async updateRecipient(
    actor: AuthenticatedUser,
    userId: string,
    input: { whatsappPhone: string | null; lateArrivalAlerts: boolean },
    context: ClientContext,
  ): Promise<NotificationRecipientView> {
    const phone =
      input.whatsappPhone === null || input.whatsappPhone.trim() === ''
        ? null
        : normalizeWhatsappPhone(input.whatsappPhone);
    if (input.whatsappPhone !== null && input.whatsappPhone.trim() !== '' && phone === null) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Informe um WhatsApp válido com DDD, por exemplo (85) 99999-0000.',
      });
    }
    if (phone === null && input.lateArrivalAlerts) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Informe o WhatsApp do administrador para ativar os alertas.',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const admin = await tx.user.findFirst({
        where: { id: userId, role: UserRole.ADMIN, isActive: true },
        select: { id: true, name: true, login: true, notificationPreference: true },
      });
      if (admin === null) {
        throw new NotFoundException({
          code: 'RESOURCE_NOT_FOUND',
          message: 'Administrador não encontrado.',
        });
      }
      const before = admin.notificationPreference;
      if (phone === null) {
        await tx.adminNotificationPreference.deleteMany({ where: { userId } });
      } else {
        await tx.adminNotificationPreference.upsert({
          where: { userId },
          create: { userId, whatsappPhone: phone, lateArrivalAlerts: input.lateArrivalAlerts },
          update: { whatsappPhone: phone, lateArrivalAlerts: input.lateArrivalAlerts },
        });
      }
      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.SETTING_UPDATED,
          targetType: AuditTargetType.SETTING,
          targetId: `notifications.recipient:${userId}`,
          ...context,
          beforeState: {
            adminName: admin.name,
            whatsappPhone: before?.whatsappPhone ?? null,
            lateArrivalAlerts: before?.lateArrivalAlerts ?? false,
          },
          afterState: {
            adminName: admin.name,
            whatsappPhone: phone,
            lateArrivalAlerts: phone === null ? false : input.lateArrivalAlerts,
          },
        },
        tx,
      );
      return {
        userId: admin.id,
        name: admin.name,
        login: admin.login,
        whatsappPhone: phone,
        lateArrivalAlerts: phone === null ? false : input.lateArrivalAlerts,
      };
    });
  }

  // ---------------------------------------------------------------- WhatsApp connection

  public whatsappStatus(): Promise<WhatsappStatus> {
    return this.gateway.status();
  }

  public async connectWhatsapp(
    actor: AuthenticatedUser,
    context: ClientContext,
  ): Promise<WhatsappStatus> {
    await this.callGateway(() => this.gateway.connect());
    await this.audit.record({
      actorId: actor.id,
      action: AuditAction.SETTING_UPDATED,
      targetType: AuditTargetType.SETTING,
      targetId: 'notifications.whatsapp',
      ...context,
      afterState: { action: 'connect' },
    });
    return this.gateway.status();
  }

  public async whatsappQrCode(): Promise<{ qrCode: string | null; status: WhatsappStatus }> {
    const qrCode = await this.callGateway(() => this.gateway.qrCode());
    return { qrCode, status: await this.gateway.status() };
  }

  public async disconnectWhatsapp(
    actor: AuthenticatedUser,
    context: ClientContext,
  ): Promise<WhatsappStatus> {
    await this.callGateway(() => this.gateway.disconnect());
    await this.audit.record({
      actorId: actor.id,
      action: AuditAction.SETTING_UPDATED,
      targetType: AuditTargetType.SETTING,
      targetId: 'notifications.whatsapp',
      ...context,
      afterState: { action: 'disconnect' },
    });
    return this.gateway.status();
  }

  // ---------------------------------------------------------------- alerts

  /**
   * Called after an employee's first clock-in of the day is committed. Persists one
   * outbox row per configured administrator; delivery happens asynchronously so a
   * WhatsApp outage never blocks or fails a punch.
   */
  public async onFirstClockIn(event: FirstClockInEvent): Promise<number> {
    const settings = await this.getLateArrivalSettings();
    if (!settings.enabled) return 0;
    const lateArrival = evaluateLateArrival({
      expectation: event.expectation,
      clockInAt: event.clockInAt,
      toleranceMinutes: settings.toleranceMinutes,
    });
    if (lateArrival === null) return 0;

    const [employee, recipients] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: event.employeeId }, select: { name: true } }),
      this.prisma.adminNotificationPreference.findMany({
        where: { lateArrivalAlerts: true, user: { role: UserRole.ADMIN, isActive: true } },
        select: { userId: true, whatsappPhone: true },
      }),
    ]);
    if (employee === null || recipients.length === 0) return 0;

    const message = buildLateArrivalMessage({
      employeeName: employee.name,
      businessDate: event.businessDate,
      lateArrival,
    });
    const result = await this.prisma.notificationOutbox.createMany({
      data: recipients.map((recipient) => ({
        id: randomUUID(),
        kind: NotificationKind.LATE_ARRIVAL,
        dedupeKey: `LATE_ARRIVAL:${event.employeeId}:${event.businessDate}:${recipient.userId}`,
        recipientUserId: recipient.userId,
        subjectUserId: event.employeeId,
        phone: recipient.whatsappPhone,
        message,
      })),
      skipDuplicates: true,
    });
    if (result.count > 0) void this.dispatchPending();
    return result.count;
  }

  public async sendTestMessage(actor: AuthenticatedUser, userId: string): Promise<void> {
    const preference = await this.prisma.adminNotificationPreference.findUnique({
      where: { userId },
      select: { whatsappPhone: true },
    });
    if (preference === null) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Cadastre o WhatsApp deste administrador antes de enviar o teste.',
      });
    }
    await this.prisma.notificationOutbox.create({
      data: {
        id: randomUUID(),
        kind: NotificationKind.TEST,
        dedupeKey: `TEST:${randomUUID()}`,
        recipientUserId: userId,
        subjectUserId: actor.id,
        phone: preference.whatsappPhone,
        message:
          '✅ *PH-Ponto* — Mensagem de teste.\nOs alertas de atraso chegarão por este número.',
      },
    });
    void this.dispatchPending();
  }

  public async listRecentNotifications(limit = 30): Promise<NotificationOutboxView[]> {
    const rows = await this.prisma.notificationOutbox.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
      include: { recipient: { select: { name: true } }, subject: { select: { name: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      status: row.status,
      recipientName: row.recipient?.name ?? null,
      subjectName: row.subject?.name ?? null,
      phone: row.phone,
      message: row.message,
      attempts: row.attempts,
      lastError: row.lastError,
      createdAt: row.createdAt.toISOString(),
      sentAt: row.sentAt?.toISOString() ?? null,
    }));
  }

  /** Delivers due outbox rows. Safe to call concurrently; one batch runs at a time. */
  public async dispatchPending(now = new Date()): Promise<void> {
    if (this.dispatching || !this.gateway.isConfigured) return;
    this.dispatching = true;
    try {
      const due = await this.prisma.notificationOutbox.findMany({
        where: { status: NotificationStatus.PENDING, nextAttemptAt: { lte: now } },
        orderBy: { createdAt: 'asc' },
        take: DISPATCH_BATCH_SIZE,
      });
      for (const row of due) {
        if (now.getTime() - row.createdAt.getTime() > STALE_AFTER_MS) {
          await this.markFailed(
            row.id,
            row.attempts,
            'Alerta expirado sem conexão com o WhatsApp.',
          );
          continue;
        }
        try {
          await this.gateway.sendText(row.phone, row.message);
          await this.prisma.notificationOutbox.update({
            where: { id: row.id },
            data: {
              status: NotificationStatus.SENT,
              sentAt: new Date(),
              attempts: row.attempts + 1,
              lastError: null,
            },
          });
        } catch (error) {
          const message =
            error instanceof WhatsappGatewayError ? error.message : 'Falha inesperada no envio.';
          const attempts = row.attempts + 1;
          if (attempts >= MAX_ATTEMPTS) {
            await this.markFailed(row.id, attempts, message);
          } else {
            await this.prisma.notificationOutbox.update({
              where: { id: row.id },
              data: {
                attempts,
                lastError: message.slice(0, 500),
                nextAttemptAt: new Date(now.getTime() + retryDelayMs(attempts)),
              },
            });
          }
          this.logger.warn(`Falha ao enviar notificação ${row.id}: ${message}`);
        }
      }
    } catch (error) {
      this.logger.error('Falha ao processar a fila de notificações.', error as Error);
    } finally {
      this.dispatching = false;
    }
  }

  private async markFailed(id: string, attempts: number, message: string): Promise<void> {
    await this.prisma.notificationOutbox.update({
      where: { id },
      data: { status: NotificationStatus.FAILED, attempts, lastError: message.slice(0, 500) },
    });
  }

  private async callGateway<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof WhatsappGatewayError) {
        throw new BadRequestException({ code: 'WHATSAPP_UNAVAILABLE', message: error.message });
      }
      throw error;
    }
  }
}
