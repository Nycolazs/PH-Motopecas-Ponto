-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'EMPLOYMENT_EVENT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'EMPLOYEE_TERMINATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'EMPLOYEE_REACTIVATED';

-- AlterEnum
ALTER TYPE "AuditTargetType" ADD VALUE IF NOT EXISTS 'EMPLOYMENT_EVENT';

-- CreateEnum
CREATE TYPE "EmploymentEventType" AS ENUM (
    'ADMISSION',
    'ROLE_CHANGE',
    'SUSPENSION',
    'TERMINATION',
    'REACTIVATION',
    'NOTE'
);

-- CreateEnum
CREATE TYPE "TerminationReason" AS ENUM (
    'WITHOUT_CAUSE',
    'WITH_CAUSE',
    'EMPLOYEE_RESIGNATION',
    'MUTUAL_AGREEMENT',
    'CONTRACT_EXPIRATION',
    'OTHER'
);

-- CreateTable
CREATE TABLE "employment_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "event_type" "EmploymentEventType" NOT NULL,
    "effective_date" DATE NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employment_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employment_events_employee_id_effective_date_idx" ON "employment_events"("employee_id", "effective_date" DESC);

-- CreateIndex
CREATE INDEX "employment_events_employee_id_event_type_idx" ON "employment_events"("employee_id", "event_type");

-- AddForeignKey
ALTER TABLE "employment_events" ADD CONSTRAINT "employment_events_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "employment_events" ADD CONSTRAINT "employment_events_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
