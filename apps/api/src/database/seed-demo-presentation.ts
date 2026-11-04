/**
 * Presentation-only demo data, layered on top of `seed.ts` (run that first).
 *
 * Adds a few more fictitious employees and realistic time punches from DEMO_HISTORY_START
 * up to the moment the script runs, so dashboards, reports and pending items have something
 * to show. Every person, CPF and address here is synthetic.
 *
 * Idempotent and incremental: for each employee/day only the planned punches that are
 * already in the past and still missing are added. Run it every few minutes (cron) and the
 * current day fills in live, as if the team were clocking in. A day whose existing punches
 * differ from the plan (someone punched for real during the demo) is left untouched.
 */
import { createHash } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { argon2id, hash } from 'argon2';

import {
  CalendarExceptionKind,
  CalendarExceptionOperation,
  EmploymentEventType,
  IdempotencyOperation,
  IdempotencyStatus,
  PrismaClient,
  TimePunchKind,
  TimePunchOrigin,
  UserRole,
} from '../generated/prisma/client.js';

const TIME_ZONE_OFFSET_HOURS = 3; // America/Sao_Paulo / America/Fortaleza (no DST)
const DEMO_HISTORY_START = '2026-09-01';
const MS_PER_DAY = 86_400_000;

const EXTRA_EMPLOYEES = [
  {
    name: 'Rafael Mendes Oliveira',
    login: 'rafael.mendes',
    roleTitle: 'Mecânico Geral de Motocicletas',
    cpf: '321.654.987-00',
    birthDate: '1991-03-08',
    hireDate: '2025-08-04',
    phone: '(85) 98111-2233',
    neighborhood: 'Messejana',
    profile: 'punctual',
  },
  {
    name: 'Juliana Alves Pereira',
    login: 'juliana.alves',
    roleTitle: 'Atendente de Balcão e Peças',
    cpf: '456.789.123-44',
    birthDate: '2000-07-19',
    hireDate: '2025-11-10',
    phone: '(85) 98222-3344',
    neighborhood: 'Aldeota',
    profile: 'often-late',
  },
  {
    name: 'Bruno Henrique Sousa',
    login: 'bruno.sousa',
    roleTitle: 'Gerente de Oficina e Operações',
    cpf: '654.321.987-55',
    birthDate: '1987-12-02',
    hireDate: '2024-03-01',
    phone: '(85) 98333-4455',
    neighborhood: 'Fátima',
    profile: 'overtime',
  },
  {
    name: 'Ana Beatriz Rocha',
    login: 'ana.rocha',
    roleTitle: 'Atendente de Balcão e Peças',
    cpf: '789.123.456-66',
    birthDate: '1999-04-27',
    hireDate: '2026-03-02',
    phone: '(85) 98444-5566',
    neighborhood: 'Benfica',
    profile: 'punctual',
  },
] as const;

type Profile = 'punctual' | 'often-late' | 'overtime' | 'regular';

const PROFILE_BY_LOGIN: Record<string, Profile> = {
  'carlos.silva': 'regular',
  'mariana.costa': 'regular',
  ...Object.fromEntries(EXTRA_EMPLOYEES.map((e) => [e.login, e.profile])),
};

const HOLIDAYS = [
  { date: '2026-10-12', name: 'Nossa Senhora Aparecida' },
  { date: '2026-11-02', name: 'Finados' },
];

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/** Deterministic pseudo-random number in [0, 1) so reruns produce the same history. */
function noise(seed: string): number {
  return parseInt(sha256(seed).slice(0, 8), 16) / 0x1_0000_0000;
}

function localDateString(date: Date): string {
  const shifted = new Date(date.getTime() - TIME_ZONE_OFFSET_HOURS * 3_600_000);
  return shifted.toISOString().slice(0, 10);
}

/** UTC instant for a local wall-clock time on a local business date. */
function localInstant(businessDate: string, minuteOfDay: number): Date {
  const midnightUtc = new Date(`${businessDate}T00:00:00.000Z`).getTime();
  return new Date(midnightUtc + (minuteOfDay + TIME_ZONE_OFFSET_HOURS * 60) * 60_000);
}

function nextDate(businessDate: string): string {
  const next = new Date(new Date(`${businessDate}T12:00:00.000Z`).getTime() + MS_PER_DAY);
  return next.toISOString().slice(0, 10);
}

function weekday(businessDate: string): number {
  return new Date(`${businessDate}T12:00:00.000Z`).getUTCDay(); // 0 = Sunday
}

function plannedPunches(login: string, businessDate: string): number[] {
  const day = weekday(businessDate);
  if (day === 0) return [];
  const profile = PROFILE_BY_LOGIN[login] ?? 'regular';
  const r = (tag: string) => noise(`${login}|${businessDate}|${tag}`);

  // A single unjustified absence and one forgotten clock-out make the pending lists useful.
  if (login === 'juliana.alves' && r('absence') < 0.08) return [];

  let arrival = 480 - 6 + Math.floor(r('in') * 10); // ~07:54–08:03
  if (profile === 'often-late' && r('late') < 0.35) arrival = 480 + 8 + Math.floor(r('lm') * 25);
  if (profile === 'regular' && r('late') < 0.1) arrival = 480 + 6 + Math.floor(r('lm') * 12);
  if (profile === 'punctual') arrival = 480 - 8 + Math.floor(r('in') * 6);

  if (day === 6) {
    const leave = 720 + Math.floor(r('sat') * 8);
    return [arrival, leave];
  }

  const lunchOut = 720 + Math.floor(r('lo') * 6) - 2;
  const lunchIn = 780 + Math.floor(r('li') * 6) - 2;
  let leave = 1_020 + Math.floor(r('out') * 9);
  if (profile === 'overtime' && r('ot') < 0.5) leave = 1_020 + 30 + Math.floor(r('otm') * 75);

  if (login === 'carlos.silva' && r('forgot') < 0.07) return [arrival, lunchOut, lunchIn];
  return [arrival, lunchOut, lunchIn, leave];
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required.');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString, options: '-c timezone=UTC' }),
  });

  try {
    const admin = await prisma.user.findFirst({
      where: { role: UserRole.ADMIN, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!admin) throw new Error('Run the base seed first: no active administrator exists.');

    // Holidays inside the window, so they show as non-working days instead of absences.
    for (const holiday of HOLIDAYS) {
      const businessDate = new Date(`${holiday.date}T00:00:00.000Z`);
      const existing = await prisma.calendarException.findUnique({ where: { businessDate } });
      if (existing) continue;
      await prisma.calendarException.create({
        data: {
          businessDate,
          revisions: {
            create: {
              sequence: 1,
              operation: CalendarExceptionOperation.UPSERT,
              kind: CalendarExceptionKind.HOLIDAY,
              name: holiday.name,
              createdById: admin.id,
            },
          },
        },
      });
    }

    // Extra employees.
    let passwordHash: string | undefined;
    for (const employee of EXTRA_EMPLOYEES) {
      const normalizedLogin = employee.login.toLowerCase();
      let user = await prisma.user.findUnique({ where: { normalizedLogin } });
      if (!user) {
        passwordHash ??= await hash('funcionario123', {
          type: argon2id,
          memoryCost: 65_536,
          timeCost: 3,
          parallelism: 1,
          hashLength: 32,
        });
        user = await prisma.user.create({
          data: {
            name: employee.name,
            login: employee.login,
            normalizedLogin,
            passwordHash,
            role: UserRole.EMPLOYEE,
            isActive: true,
            accessEnabled: true,
          },
        });
      }
      const hireDate = new Date(`${employee.hireDate}T00:00:00.000Z`);
      await prisma.employeeProfile.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          cpf: employee.cpf,
          birthDate: new Date(`${employee.birthDate}T00:00:00.000Z`),
          hireDate,
          phone: employee.phone,
          personalEmail: `${employee.login}@exemplo.com.br`,
          addressStreet: 'Rua Exemplo',
          addressNumber: String(100 + Math.floor(noise(employee.login) * 900)),
          addressNeighborhood: employee.neighborhood,
          addressCity: 'Fortaleza',
          addressState: 'CE',
          addressPostalCode: '60000-000',
        },
      });

      const role = await prisma.jobRole.findFirst({
        where: { title: employee.roleTitle },
        include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
      });
      const roleVersion = role?.versions[0];
      if (role && roleVersion) {
        const assigned = await prisma.employeeRoleAssignment.findFirst({
          where: { employeeId: user.id, isPrincipal: true },
        });
        if (!assigned) {
          await prisma.employeeRoleAssignment.create({
            data: {
              employeeId: user.id,
              jobRoleId: role.id,
              jobRoleVersionId: roleVersion.id,
              startDate: hireDate,
              isPrincipal: true,
              createdById: admin.id,
              notes: 'Atribuição inicial de cargo (dados de demonstração).',
            },
          });
        }
      }

      const admission = await prisma.employmentEvent.findFirst({
        where: { employeeId: user.id, eventType: EmploymentEventType.ADMISSION },
      });
      if (!admission) {
        await prisma.employmentEvent.create({
          data: {
            employeeId: user.id,
            eventType: EmploymentEventType.ADMISSION,
            effectiveDate: hireDate,
            title: 'Admissão Formal na Empresa',
            description: `Colaborador contratado sob regime CLT para o cargo de ${employee.roleTitle}.`,
            createdById: admin.id,
          },
        });
      }
    }

    // Attendance is counted from users.created_at, so backdate every demo account to the
    // start of its punch history (otherwise reports ignore every day before the seed ran).
    const employees = await prisma.user.findMany({
      where: { role: UserRole.EMPLOYEE, isActive: true },
      include: { employeeProfile: true },
    });
    for (const employee of employees) {
      const hired = employee.employeeProfile?.hireDate?.toISOString().slice(0, 10);
      const start = hired && hired > DEMO_HISTORY_START ? hired : DEMO_HISTORY_START;
      const target = localInstant(start, 0);
      if (employee.createdAt > target) {
        await prisma.user.update({ where: { id: employee.id }, data: { createdAt: target } });
        employee.createdAt = target;
      }
    }
    if (admin.createdAt > localInstant(DEMO_HISTORY_START, 0)) {
      await prisma.user.update({
        where: { id: admin.id },
        data: { createdAt: localInstant(DEMO_HISTORY_START, 0) },
      });
    }

    // Punch history, filled incrementally up to now.
    const holidayDates = new Set(HOLIDAYS.map((h) => h.date));
    const now = new Date();
    const today = localDateString(now);
    let created = 0;
    let untouchedDays = 0;

    for (const employee of employees) {
      const firstDay = localDateString(employee.createdAt);
      for (
        let businessDate = firstDay;
        businessDate <= today;
        businessDate = nextDate(businessDate)
      ) {
        if (holidayDates.has(businessDate)) continue;

        const planned = plannedPunches(employee.normalizedLogin, businessDate)
          .map((minute) => localInstant(businessDate, minute))
          .filter((instant) => instant <= now);
        if (planned.length === 0) continue;

        const existing = await prisma.timePunch.findMany({
          where: {
            employeeId: employee.id,
            occurredAt: {
              gte: localInstant(businessDate, 0),
              lt: localInstant(businessDate, 24 * 60),
            },
          },
          orderBy: { occurredAt: 'asc' },
          select: { occurredAt: true },
        });
        if (existing.length >= planned.length) continue;
        const matchesPlan = existing.every(
          (punch, index) => punch.occurredAt.getTime() === planned[index]?.getTime(),
        );
        if (!matchesPlan) {
          untouchedDays += 1;
          continue;
        }

        for (let index = existing.length; index < planned.length; index += 1) {
          const occurredAt = planned[index]!;
          const key = `demo-punch-${employee.id}-${occurredAt.toISOString()}`;
          const record = await prisma.idempotencyRecord.create({
            data: {
              actorId: employee.id,
              operation: IdempotencyOperation.CREATE_TIME_PUNCH,
              keyHash: sha256(key),
              requestFingerprint: sha256(`fingerprint-${key}`),
              status: IdempotencyStatus.COMPLETED,
              responseStatus: 201,
              responseBody: { success: true },
              expiresAt: new Date(Date.now() + MS_PER_DAY),
            },
          });
          await prisma.timePunch.create({
            data: {
              employeeId: employee.id,
              occurredAt,
              kind: index % 2 === 0 ? TimePunchKind.CLOCK_IN : TimePunchKind.CLOCK_OUT,
              origin: TimePunchOrigin.EMPLOYEE,
              idempotencyRecordId: record.id,
            },
          });
          created += 1;
        }
      }
    }

    console.info(
      `PH-Ponto presentation seed complete: ${employees.length} employees, ${created} punches added, ${untouchedDays} days left as edited.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('PH-Ponto presentation seed failed.', error);
  process.exitCode = 1;
});
