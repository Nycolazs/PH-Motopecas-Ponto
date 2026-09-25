-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PERFORMANCE_REVIEW_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PERFORMANCE_REVIEW_SUPERSEDED';

-- AlterEnum
ALTER TYPE "AuditTargetType" ADD VALUE IF NOT EXISTS 'PERFORMANCE_REVIEW';

-- CreateEnum
CREATE TYPE "PerformanceClassification" AS ENUM (
    'EXCELLENT',
    'GOOD',
    'REGULAR',
    'NEEDS_IMPROVEMENT'
);

-- CreateTable
CREATE TABLE "performance_evaluation_criteria" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "criteria" JSONB NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_evaluation_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "evaluator_id" UUID NOT NULL,
    "evaluation_period" VARCHAR(50) NOT NULL,
    "evaluation_date" DATE NOT NULL,
    "mean_score" DECIMAL(3,2) NOT NULL,
    "classification" "PerformanceClassification" NOT NULL,
    "scores" JSONB NOT NULL,
    "strengths" TEXT,
    "improvements" TEXT,
    "action_plan" TEXT,
    "evaluator_comments" TEXT,
    "employee_comments" TEXT,
    "generated_document_id" UUID,
    "is_superseded" BOOLEAN NOT NULL DEFAULT false,
    "superseded_by_id" UUID,
    "superseded_at" TIMESTAMPTZ(6),
    "supersession_reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "performance_evaluation_criteria_company_id_version_number_key" ON "performance_evaluation_criteria"("company_id", "version_number");

-- CreateIndex
CREATE INDEX "performance_evaluation_criteria_company_id_is_active_idx" ON "performance_evaluation_criteria"("company_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "performance_reviews_generated_document_id_key" ON "performance_reviews"("generated_document_id");

-- CreateIndex
CREATE UNIQUE INDEX "performance_reviews_superseded_by_id_key" ON "performance_reviews"("superseded_by_id");

-- CreateIndex
CREATE INDEX "performance_reviews_employee_id_evaluation_date_idx" ON "performance_reviews"("employee_id", "evaluation_date" DESC);

-- CreateIndex
CREATE INDEX "performance_reviews_employee_id_evaluation_period_idx" ON "performance_reviews"("employee_id", "evaluation_period");

-- CreateIndex
CREATE INDEX "performance_reviews_company_id_evaluation_period_idx" ON "performance_reviews"("company_id", "evaluation_period");

-- AddForeignKey
ALTER TABLE "performance_evaluation_criteria" ADD CONSTRAINT "performance_evaluation_criteria_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "performance_evaluation_criteria" ADD CONSTRAINT "performance_evaluation_criteria_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_evaluator_id_fkey" FOREIGN KEY ("evaluator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_generated_document_id_fkey" FOREIGN KEY ("generated_document_id") REFERENCES "generated_documents"("id") ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_superseded_by_id_fkey" FOREIGN KEY ("superseded_by_id") REFERENCES "performance_reviews"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
