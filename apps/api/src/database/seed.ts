import { PrismaPg } from '@prisma/adapter-pg';
import { argon2id, hash } from 'argon2';

import { normalizeLogin } from '../auth/login-normalization.js';
import { validateEnvironment } from '../config/environment.js';
import { Prisma, PrismaClient, UserRole, Weekday } from '../generated/prisma/client.js';

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

class SeedConflictError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'SeedConflictError';
  }
}

function assertCompatibleBootstrapAdmin(user: { role: UserRole; isActive: boolean }): void {
  if (user.role !== UserRole.ADMIN) {
    throw new SeedConflictError('The configured bootstrap login already belongs to an employee.');
  }

  if (!user.isActive) {
    throw new SeedConflictError('The configured bootstrap administrator exists but is inactive.');
  }
}

function isBaselineDayCompatible(
  actual: {
    weekday: Weekday;
    isOpen: boolean;
    openingMinute: number | null;
    closingMinute: number | null;
    lunchEnabled: boolean;
    lunchStartMinute: number | null;
    lunchEndMinute: number | null;
  },
  expected: (typeof BASELINE_DAYS)[number],
): boolean {
  return (
    actual.weekday === expected.weekday &&
    actual.isOpen === expected.isOpen &&
    actual.openingMinute === expected.openingMinute &&
    actual.closingMinute === expected.closingMinute &&
    actual.lunchEnabled === expected.lunchEnabled &&
    actual.lunchStartMinute === expected.lunchStartMinute &&
    actual.lunchEndMinute === expected.lunchEndMinute
  );
}

async function ensureBaselineSchedule(
  transaction: Prisma.TransactionClient,
  creatorId: string,
): Promise<boolean> {
  const existingBaseline = await transaction.businessScheduleVersion.findUnique({
    where: { effectiveDate: BASELINE_EFFECTIVE_DATE },
    include: { days: { orderBy: { weekday: 'asc' } } },
  });

  if (existingBaseline !== null) {
    const daysByWeekday = new Map(existingBaseline.days.map((day) => [day.weekday, day]));
    const compatible =
      existingBaseline.days.length === BASELINE_DAYS.length &&
      BASELINE_DAYS.every((expected) => {
        const actual = daysByWeekday.get(expected.weekday);
        return actual !== undefined && isBaselineDayCompatible(actual, expected);
      });

    if (!compatible) {
      throw new SeedConflictError(
        'The baseline schedule already exists with a different configuration.',
      );
    }

    return false;
  }

  const scheduleCount = await transaction.businessScheduleVersion.count();
  if (scheduleCount > 0) {
    throw new SeedConflictError(
      'Schedule versions exist without the required baseline; refusing to rewrite history.',
    );
  }

  await transaction.businessScheduleVersion.create({
    data: {
      effectiveDate: BASELINE_EFFECTIVE_DATE,
      note: 'Horário padrão inicial',
      createdById: creatorId,
      days: { create: BASELINE_DAYS.map((day) => ({ ...day })) },
    },
  });

  return true;
}

interface SeedResult {
  adminCreated: boolean;
  scheduleCreated: boolean;
}

async function seedDatabase(): Promise<SeedResult> {
  const environment = validateEnvironment(process.env);
  const normalizedLogin = normalizeLogin(environment.INITIAL_ADMIN_USERNAME);
  const adapter = new PrismaPg({
    connectionString: environment.DATABASE_URL,
    connectionTimeoutMillis: environment.DATABASE_CONNECTION_TIMEOUT_MS,
    max: environment.DATABASE_POOL_MAX,
    options: '-c timezone=UTC',
  });
  const prisma = new PrismaClient({ adapter });

  try {
    const [observedBootstrapUser, observedActiveAdmin] = await Promise.all([
      prisma.user.findUnique({ where: { normalizedLogin } }),
      prisma.user.findFirst({
        where: { role: UserRole.ADMIN, isActive: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    if (observedBootstrapUser !== null) {
      assertCompatibleBootstrapAdmin(observedBootstrapUser);
    }

    const needsBootstrapAdmin = observedBootstrapUser === null && observedActiveAdmin === null;
    const passwordHash = needsBootstrapAdmin
      ? await hash(environment.INITIAL_ADMIN_PASSWORD, ARGON2ID_POLICY)
      : null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await prisma.$transaction(
          async (transaction) => {
            const configuredUser = await transaction.user.findUnique({
              where: { normalizedLogin },
            });
            let bootstrapAdmin = configuredUser;
            let adminCreated = false;

            if (bootstrapAdmin !== null) {
              assertCompatibleBootstrapAdmin(bootstrapAdmin);
            } else {
              const existingActiveAdmin = await transaction.user.findFirst({
                where: { role: UserRole.ADMIN, isActive: true },
                orderBy: { createdAt: 'asc' },
              });

              if (existingActiveAdmin !== null) {
                bootstrapAdmin = existingActiveAdmin;
              } else {
                const bootstrapPasswordHash =
                  passwordHash ?? (await hash(environment.INITIAL_ADMIN_PASSWORD, ARGON2ID_POLICY));
                bootstrapAdmin = await transaction.user.create({
                  data: {
                    name: 'Administrador',
                    login: environment.INITIAL_ADMIN_USERNAME.trim(),
                    normalizedLogin,
                    passwordHash: bootstrapPasswordHash,
                    role: UserRole.ADMIN,
                    isActive: true,
                  },
                });
                adminCreated = true;
              }
            }

            const scheduleCreated = await ensureBaselineSchedule(transaction, bootstrapAdmin.id);
            return { adminCreated, scheduleCreated };
          },
          { isolationLevel: 'Serializable' },
        );
      } catch (error) {
        const retryableConflict =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2002' || error.code === 'P2034');

        if (retryableConflict && attempt === 0) {
          continue;
        }

        throw error;
      }
    }

    throw new Error('The database seed retry budget was exhausted.');
  } finally {
    await prisma.$disconnect();
  }
}

void seedDatabase()
  .then(({ adminCreated, scheduleCreated }) => {
    const adminState = adminCreated ? 'created' : 'already available';
    const scheduleState = scheduleCreated ? 'created' : 'already available';
    console.info(
      `PH-Ponto seed complete: administrator ${adminState}; baseline schedule ${scheduleState}.`,
    );
  })
  .catch((error: unknown) => {
    if (error instanceof SeedConflictError) {
      console.error(`PH-Ponto seed refused a conflicting state: ${error.message}`);
    } else {
      console.error(
        'PH-Ponto seed failed. Review database connectivity and validated configuration.',
      );
    }

    process.exitCode = 1;
  });
