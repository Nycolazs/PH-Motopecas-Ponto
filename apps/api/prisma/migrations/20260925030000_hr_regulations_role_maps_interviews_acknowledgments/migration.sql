-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "InterviewRecommendation" AS ENUM (
        'RECOMMENDED',
        'NOT_RECOMMENDED',
        'TALENT_POOL'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "AcknowledgmentType" AS ENUM (
        'REGULATION',
        'ROLE'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'REGULATION_PUBLISHED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INTERVIEW_RECORDED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ACKNOWLEDGMENT_GENERATED';

-- AlterEnum
ALTER TYPE "AuditTargetType" ADD VALUE IF NOT EXISTS 'REGULATION';
ALTER TYPE "AuditTargetType" ADD VALUE IF NOT EXISTS 'INTERVIEW';
ALTER TYPE "AuditTargetType" ADD VALUE IF NOT EXISTS 'ACKNOWLEDGMENT';

-- CreateTable
CREATE TABLE IF NOT EXISTS "company_regulations" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "company_regulations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "company_regulation_versions" (
    "id" UUID NOT NULL,
    "company_regulation_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "effective_date" DATE NOT NULL,
    "content" JSONB NOT NULL DEFAULT '{}',
    "generated_document_id" UUID,
    "published_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_regulation_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "hiring_interviews" (
    "id" UUID NOT NULL,
    "candidate_name" VARCHAR(120) NOT NULL,
    "candidate_email" VARCHAR(120),
    "candidate_phone" VARCHAR(30),
    "job_role_id" UUID,
    "role_title" VARCHAR(120) NOT NULL,
    "interview_date" DATE NOT NULL,
    "interviewer_name" VARCHAR(120) NOT NULL,
    "evaluator_id" UUID NOT NULL,
    "recommendation" "InterviewRecommendation" NOT NULL,
    "notes" TEXT,
    "scores" JSONB NOT NULL DEFAULT '{}',
    "generated_document_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "hiring_interviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "employee_document_acknowledgments" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "acknowledgment_type" "AcknowledgmentType" NOT NULL,
    "regulation_version_id" UUID,
    "job_role_version_id" UUID,
    "generated_document_id" UUID NOT NULL,
    "acknowledged_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_document_acknowledgments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "company_regulations_company_id_key" ON "company_regulations"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "company_regulation_versions_company_regulation_id_version_number_key" ON "company_regulation_versions"("company_regulation_id", "version_number");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "company_regulation_versions_company_regulation_id_published_at_idx" ON "company_regulation_versions"("company_regulation_id", "published_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "hiring_interviews_interview_date_idx" ON "hiring_interviews"("interview_date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "hiring_interviews_candidate_name_idx" ON "hiring_interviews"("candidate_name");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "employee_document_acknowledgments_generated_document_id_key" ON "employee_document_acknowledgments"("generated_document_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "employee_document_acknowledgments_employee_id_acknowledgment_type_idx" ON "employee_document_acknowledgments"("employee_id", "acknowledgment_type");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "company_regulations" ADD CONSTRAINT "company_regulations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "company_regulation_versions" ADD CONSTRAINT "company_regulation_versions_company_regulation_id_fkey" FOREIGN KEY ("company_regulation_id") REFERENCES "company_regulations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "company_regulation_versions" ADD CONSTRAINT "company_regulation_versions_generated_document_id_fkey" FOREIGN KEY ("generated_document_id") REFERENCES "generated_documents"("id") ON DELETE SET NULL ON UPDATE RESTRICT;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "company_regulation_versions" ADD CONSTRAINT "company_regulation_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "hiring_interviews" ADD CONSTRAINT "hiring_interviews_evaluator_id_fkey" FOREIGN KEY ("evaluator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "hiring_interviews" ADD CONSTRAINT "hiring_interviews_job_role_id_fkey" FOREIGN KEY ("job_role_id") REFERENCES "job_roles"("id") ON DELETE SET NULL ON UPDATE RESTRICT;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "hiring_interviews" ADD CONSTRAINT "hiring_interviews_generated_document_id_fkey" FOREIGN KEY ("generated_document_id") REFERENCES "generated_documents"("id") ON DELETE SET NULL ON UPDATE RESTRICT;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "employee_document_acknowledgments" ADD CONSTRAINT "employee_document_acknowledgments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "employee_document_acknowledgments" ADD CONSTRAINT "employee_document_acknowledgments_regulation_version_id_fkey" FOREIGN KEY ("regulation_version_id") REFERENCES "company_regulation_versions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "employee_document_acknowledgments" ADD CONSTRAINT "employee_document_acknowledgments_job_role_version_id_fkey" FOREIGN KEY ("job_role_version_id") REFERENCES "job_role_versions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "employee_document_acknowledgments" ADD CONSTRAINT "employee_document_acknowledgments_generated_document_id_fkey" FOREIGN KEY ("generated_document_id") REFERENCES "generated_documents"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "employee_document_acknowledgments" ADD CONSTRAINT "employee_document_acknowledgments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
