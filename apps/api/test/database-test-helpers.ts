import type { PrismaService } from '../src/database/prisma.service.js';

export async function clearApplicationData(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "app_settings",
      "audit_logs",
      "time_adjustments",
      "time_punches",
      "idempotency_records",
      "calendar_exception_revisions",
      "calendar_exceptions",
      "business_schedule_days",
      "business_schedule_versions",
      "login_throttles",
      "refresh_sessions",
      "avatars",
      "users"
    CASCADE
  `);
}
