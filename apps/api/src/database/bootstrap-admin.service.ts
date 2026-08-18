import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { argon2id, hash } from 'argon2';

import { normalizeLogin } from '../auth/login-normalization.js';
import type { EnvironmentVariables } from '../config/environment.js';
import { Prisma, UserRole, Weekday } from '../generated/prisma/client.js';
import { PrismaService } from './prisma.service.js';

const BASELINE_EFFECTIVE_DATE = new Date('1970-01-01T00:00:00.000Z');

const ARGON2ID_POLICY = Object.freeze({
  type: argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
  hashLength: 32,
});

const BASELINE_DAYS = Object.freeze([
  {
    weekday: Weekday.MONDAY,
    isOpen: true,
    openingMinute: 480,
    closingMinute: 1_020,
    lunchEnabled: true,
    lunchStartMinute: 720,
    lunchEndMinute: 780,
  },
  {
    weekday: Weekday.TUESDAY,
    isOpen: true,
    openingMinute: 480,
    closingMinute: 1_020,
    lunchEnabled: true,
    lunchStartMinute: 720,
    lunchEndMinute: 780,
  },
  {
    weekday: Weekday.WEDNESDAY,
    isOpen: true,
    openingMinute: 480,
    closingMinute: 1_020,
    lunchEnabled: true,
    lunchStartMinute: 720,
    lunchEndMinute: 780,
  },
  {
    weekday: Weekday.THURSDAY,
    isOpen: true,
    openingMinute: 480,
    closingMinute: 1_020,
    lunchEnabled: true,
    lunchStartMinute: 720,
    lunchEndMinute: 780,
  },
  {
    weekday: Weekday.FRIDAY,
    isOpen: true,
    openingMinute: 480,
    closingMinute: 1_020,
    lunchEnabled: true,
    lunchStartMinute: 720,
    lunchEndMinute: 780,
  },
  {
    weekday: Weekday.SATURDAY,
    isOpen: true,
    openingMinute: 480,
    closingMinute: 720,
    lunchEnabled: false,
    lunchStartMinute: null,
    lunchEndMinute: null,
  },
  {
    weekday: Weekday.SUNDAY,
    isOpen: false,
    openingMinute: null,
    closingMinute: null,
    lunchEnabled: false,
    lunchStartMinute: null,
    lunchEndMinute: null,
  },
]);

@Injectable()
export class BootstrapAdminService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BootstrapAdminService.name);

  public constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService)
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  public async onApplicationBootstrap(): Promise<void> {
    try {
      await this.ensureBootstrapAdminAndSchedule();
    } catch (error) {
      this.logger.error('Falha ao verificar ou inicializar administrador padrão.', error);
    }
  }

  public async ensureBootstrapAdminAndSchedule(): Promise<{
    adminCreated: boolean;
    scheduleCreated: boolean;
  }> {
    const adminUsername =
      this.configService.get('INITIAL_ADMIN_USERNAME', { infer: true }) || 'admin';
    const adminPassword =
      this.configService.get('INITIAL_ADMIN_PASSWORD', { infer: true }) || 'admin';

    if (typeof this.prisma?.$transaction !== 'function') {
      return { adminCreated: false, scheduleCreated: false };
    }

    const normalized = normalizeLogin(adminUsername);

    return this.prisma.$transaction(
      async (tx) => {
        const activeAdmin = await tx.user.findFirst({
          where: { role: UserRole.ADMIN, isActive: true },
          orderBy: { createdAt: 'asc' },
        });

        let targetAdmin = activeAdmin;
        let adminCreated = false;

        if (!targetAdmin) {
          const existingUser = await tx.user.findUnique({
            where: { normalizedLogin: normalized },
          });

          if (existingUser) {
            targetAdmin = await tx.user.update({
              where: { id: existingUser.id },
              data: {
                role: UserRole.ADMIN,
                isActive: true,
                passwordHash: await hash(adminPassword, ARGON2ID_POLICY),
              },
            });
            this.logger.log(`Usuário "${existingUser.login}" promovido para ADMINISTRADOR ativo.`);
          } else {
            const passwordHash = await hash(adminPassword, ARGON2ID_POLICY);
            targetAdmin = await tx.user.create({
              data: {
                name: 'Administrador',
                login: adminUsername.trim(),
                normalizedLogin: normalized,
                passwordHash,
                role: UserRole.ADMIN,
                isActive: true,
              },
            });
            adminCreated = true;
            this.logger.log(
              `Administrador padrão criado com sucesso (Nome: "Administrador", Login: "${adminUsername.trim()}").`,
            );
          }
        }

        let scheduleCreated = false;
        const baselineSchedule = await tx.businessScheduleVersion.findUnique({
          where: { effectiveDate: BASELINE_EFFECTIVE_DATE },
        });

        if (!baselineSchedule) {
          await tx.businessScheduleVersion.create({
            data: {
              effectiveDate: BASELINE_EFFECTIVE_DATE,
              note: 'Horário padrão inicial',
              createdById: targetAdmin.id,
              days: { create: BASELINE_DAYS.map((day) => ({ ...day })) },
            },
          });
          scheduleCreated = true;
          this.logger.log('Jornada semanal padrão (baseline) criada com sucesso.');
        }

        return { adminCreated, scheduleCreated };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
