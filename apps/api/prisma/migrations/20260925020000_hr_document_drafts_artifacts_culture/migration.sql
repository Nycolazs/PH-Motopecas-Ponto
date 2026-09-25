-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "DocumentType" AS ENUM (
        'CULTURE',
        'REGULATION',
        'ROLE_MAP',
        'INTERVIEW',
        'ACKNOWLEDGMENT_REGULATION',
        'ACKNOWLEDGMENT_ROLE',
        'DISCIPLINE_VERBAL',
        'DISCIPLINE_WRITTEN',
        'DISCIPLINE_SUSPENSION',
        'PERFORMANCE_REVIEW'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "RenderJobStatus" AS ENUM (
        'PENDING',
        'PROCESSING',
        'COMPLETED',
        'FAILED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DOCUMENT_DRAFT_SAVED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DOCUMENT_DRAFT_DISCARDED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DOCUMENT_PREPARED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DOCUMENT_CONFIRMED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DOCUMENT_VOIDED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CULTURE_PROFILE_PUBLISHED';

-- AlterEnum
ALTER TYPE "AuditTargetType" ADD VALUE IF NOT EXISTS 'DOCUMENT_DRAFT';
ALTER TYPE "AuditTargetType" ADD VALUE IF NOT EXISTS 'GENERATED_DOCUMENT';
ALTER TYPE "AuditTargetType" ADD VALUE IF NOT EXISTS 'CULTURE_PROFILE';

-- CreateTable
CREATE TABLE IF NOT EXISTS "document_artifacts" (
    "id" UUID NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" VARCHAR(50) NOT NULL DEFAULT 'application/pdf',
    "checksum_sha256" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "document_drafts" (
    "id" UUID NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "author_id" UUID NOT NULL,
    "employee_id" UUID,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "title" VARCHAR(200) NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "prepared_artifact_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "document_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "document_drafts_author_id_document_type_idx" ON "document_drafts"("author_id", "document_type");
CREATE INDEX IF NOT EXISTS "document_drafts_employee_id_idx" ON "document_drafts"("employee_id");

-- CreateTable
CREATE TABLE IF NOT EXISTS "render_jobs" (
    "id" UUID NOT NULL,
    "draft_id" UUID,
    "document_type" "DocumentType" NOT NULL,
    "status" "RenderJobStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "artifact_id" UUID,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leased_at" TIMESTAMPTZ(6),
    "leased_until" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "render_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "render_jobs_status_leased_until_idx" ON "render_jobs"("status", "leased_until");
CREATE INDEX IF NOT EXISTS "render_jobs_draft_id_idx" ON "render_jobs"("draft_id");

-- CreateTable
CREATE TABLE IF NOT EXISTS "generated_documents" (
    "id" UUID NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "company_id" UUID NOT NULL,
    "employee_id" UUID,
    "author_id" UUID NOT NULL,
    "artifact_id" UUID NOT NULL,
    "document_data" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "superseded_by_id" UUID,
    "is_void" BOOLEAN NOT NULL DEFAULT false,
    "void_reason" VARCHAR(255),
    "voided_by_id" UUID,
    "voided_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generated_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "generated_documents_company_id_document_type_idx" ON "generated_documents"("company_id", "document_type");
CREATE INDEX IF NOT EXISTS "generated_documents_employee_id_idx" ON "generated_documents"("employee_id");
CREATE INDEX IF NOT EXISTS "generated_documents_created_at_idx" ON "generated_documents"("created_at");

-- CreateTable
CREATE TABLE IF NOT EXISTS "culture_profiles" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "culture_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "culture_profiles_company_id_key" ON "culture_profiles"("company_id");

-- CreateTable
CREATE TABLE IF NOT EXISTS "culture_profile_versions" (
    "id" UUID NOT NULL,
    "culture_profile_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "mission" TEXT NOT NULL,
    "vision" TEXT NOT NULL,
    "values" JSONB NOT NULL DEFAULT '[]',
    "motto" VARCHAR(200),
    "generated_document_id" UUID,
    "published_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "culture_profile_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "culture_profile_versions_culture_profile_id_version_number_key" ON "culture_profile_versions"("culture_profile_id", "version_number");
CREATE INDEX IF NOT EXISTS "culture_profile_versions_culture_profile_id_published_at_idx" ON "culture_profile_versions"("culture_profile_id", "published_at");

-- AddForeignKey
ALTER TABLE "document_drafts" DROP CONSTRAINT IF EXISTS "document_drafts_author_id_fkey";
ALTER TABLE "document_drafts" ADD CONSTRAINT "document_drafts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "document_drafts" DROP CONSTRAINT IF EXISTS "document_drafts_employee_id_fkey";
ALTER TABLE "document_drafts" ADD CONSTRAINT "document_drafts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "document_drafts" DROP CONSTRAINT IF EXISTS "document_drafts_prepared_artifact_id_fkey";
ALTER TABLE "document_drafts" ADD CONSTRAINT "document_drafts_prepared_artifact_id_fkey" FOREIGN KEY ("prepared_artifact_id") REFERENCES "document_artifacts"("id") ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "render_jobs" DROP CONSTRAINT IF EXISTS "render_jobs_draft_id_fkey";
ALTER TABLE "render_jobs" ADD CONSTRAINT "render_jobs_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "document_drafts"("id") ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE "render_jobs" DROP CONSTRAINT IF EXISTS "render_jobs_artifact_id_fkey";
ALTER TABLE "render_jobs" ADD CONSTRAINT "render_jobs_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "document_artifacts"("id") ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "generated_documents" DROP CONSTRAINT IF EXISTS "generated_documents_company_id_fkey";
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "generated_documents" DROP CONSTRAINT IF EXISTS "generated_documents_employee_id_fkey";
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "generated_documents" DROP CONSTRAINT IF EXISTS "generated_documents_author_id_fkey";
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "generated_documents" DROP CONSTRAINT IF EXISTS "generated_documents_artifact_id_fkey";
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "document_artifacts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "generated_documents" DROP CONSTRAINT IF EXISTS "generated_documents_voided_by_id_fkey";
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "culture_profiles" DROP CONSTRAINT IF EXISTS "culture_profiles_company_id_fkey";
ALTER TABLE "culture_profiles" ADD CONSTRAINT "culture_profiles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "culture_profile_versions" DROP CONSTRAINT IF EXISTS "culture_profile_versions_culture_profile_id_fkey";
ALTER TABLE "culture_profile_versions" ADD CONSTRAINT "culture_profile_versions_culture_profile_id_fkey" FOREIGN KEY ("culture_profile_id") REFERENCES "culture_profiles"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "culture_profile_versions" DROP CONSTRAINT IF EXISTS "culture_profile_versions_generated_document_id_fkey";
ALTER TABLE "culture_profile_versions" ADD CONSTRAINT "culture_profile_versions_generated_document_id_fkey" FOREIGN KEY ("generated_document_id") REFERENCES "generated_documents"("id") ON DELETE SET NULL ON UPDATE RESTRICT;

ALTER TABLE "culture_profile_versions" DROP CONSTRAINT IF EXISTS "culture_profile_versions_created_by_id_fkey";
ALTER TABLE "culture_profile_versions" ADD CONSTRAINT "culture_profile_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
