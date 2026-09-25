-- AlterEnum
ALTER TYPE "SessionRevocationReason" ADD VALUE IF NOT EXISTS 'ACCESS_DISABLED';

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'COMPANY_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'JOB_ROLE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'JOB_ROLE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'JOB_ROLE_VERSION_PUBLISHED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'EMPLOYEE_ROLE_ASSIGNED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'EMPLOYEE_ACCESS_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'EMPLOYEE_PROFILE_UPDATED';

-- AlterEnum
ALTER TYPE "AuditTargetType" ADD VALUE IF NOT EXISTS 'COMPANY';
ALTER TYPE "AuditTargetType" ADD VALUE IF NOT EXISTS 'JOB_ROLE';
ALTER TYPE "AuditTargetType" ADD VALUE IF NOT EXISTS 'JOB_ROLE_VERSION';
ALTER TYPE "AuditTargetType" ADD VALUE IF NOT EXISTS 'EMPLOYEE_ROLE_ASSIGNMENT';
ALTER TYPE "AuditTargetType" ADD VALUE IF NOT EXISTS 'EMPLOYEE_PROFILE';

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "access_enabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "users_role_access_enabled_idx" ON "users"("role", "access_enabled");

-- CreateTable
CREATE TABLE IF NOT EXISTS "companies" (
    "id" UUID NOT NULL,
    "legal_name" VARCHAR(200) NOT NULL,
    "trade_name" VARCHAR(200) NOT NULL,
    "cnpj" VARCHAR(18) NOT NULL,
    "state_registration" VARCHAR(30),
    "email" VARCHAR(120),
    "phone" VARCHAR(30),
    "address_street" VARCHAR(200),
    "address_number" VARCHAR(30),
    "address_complement" VARCHAR(100),
    "address_neighborhood" VARCHAR(100),
    "address_city" VARCHAR(100),
    "address_state" VARCHAR(2),
    "address_postal_code" VARCHAR(10),
    "primary_contact_name" VARCHAR(120),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "companies_cnpj_key" ON "companies"("cnpj");

-- CreateTable
CREATE TABLE IF NOT EXISTS "employee_profiles" (
    "user_id" UUID NOT NULL,
    "cpf" VARCHAR(14),
    "rg" VARCHAR(30),
    "birth_date" DATE,
    "phone" VARCHAR(30),
    "personal_email" VARCHAR(120),
    "address_street" VARCHAR(200),
    "address_number" VARCHAR(30),
    "address_complement" VARCHAR(100),
    "address_neighborhood" VARCHAR(100),
    "address_city" VARCHAR(100),
    "address_state" VARCHAR(2),
    "address_postal_code" VARCHAR(10),
    "hire_date" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "employee_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "employee_profiles_cpf_key" ON "employee_profiles"("cpf");

-- CreateTable
CREATE TABLE IF NOT EXISTS "job_roles" (
    "id" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "department" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "job_roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "job_roles_is_active_title_idx" ON "job_roles"("is_active", "title");

-- CreateTable
CREATE TABLE IF NOT EXISTS "job_role_versions" (
    "id" UUID NOT NULL,
    "job_role_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "cbo" VARCHAR(20),
    "description" TEXT NOT NULL,
    "responsibilities" JSONB NOT NULL DEFAULT '[]',
    "requirements" JSONB NOT NULL DEFAULT '[]',
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_role_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "job_role_versions_job_role_id_version_number_key" ON "job_role_versions"("job_role_id", "version_number");
CREATE INDEX IF NOT EXISTS "job_role_versions_job_role_id_published_at_idx" ON "job_role_versions"("job_role_id", "published_at");

-- CreateTable
CREATE TABLE IF NOT EXISTS "employee_role_assignments" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "job_role_id" UUID NOT NULL,
    "job_role_version_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "is_principal" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "employee_role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "employee_role_assignments_employee_id_is_principal_start__idx" ON "employee_role_assignments"("employee_id", "is_principal", "start_date");
CREATE INDEX IF NOT EXISTS "employee_role_assignments_job_role_id_idx" ON "employee_role_assignments"("job_role_id");

-- AddForeignKey
ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "job_role_versions" ADD CONSTRAINT "job_role_versions_job_role_id_fkey" FOREIGN KEY ("job_role_id") REFERENCES "job_roles"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "job_role_versions" ADD CONSTRAINT "job_role_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "employee_role_assignments" ADD CONSTRAINT "employee_role_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "employee_role_assignments" ADD CONSTRAINT "employee_role_assignments_job_role_id_fkey" FOREIGN KEY ("job_role_id") REFERENCES "job_roles"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "employee_role_assignments" ADD CONSTRAINT "employee_role_assignments_job_role_version_id_fkey" FOREIGN KEY ("job_role_version_id") REFERENCES "job_role_versions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "employee_role_assignments" ADD CONSTRAINT "employee_role_assignments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
