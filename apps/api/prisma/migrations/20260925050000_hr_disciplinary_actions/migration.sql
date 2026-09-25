-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DISCIPLINARY_ACTION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DISCIPLINARY_ACTION_VOIDED';

-- AlterEnum
ALTER TYPE "AuditTargetType" ADD VALUE IF NOT EXISTS 'DISCIPLINARY_ACTION';

-- CreateEnum
CREATE TYPE "DisciplinaryActionType" AS ENUM (
    'VERBAL_WARNING',
    'WRITTEN_WARNING',
    'SUSPENSION'
);

-- CreateTable
CREATE TABLE "disciplinary_actions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "issuer_id" UUID NOT NULL,
    "action_type" "DisciplinaryActionType" NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "incident_date" DATE NOT NULL,
    "reason" VARCHAR(200) NOT NULL,
    "details" TEXT NOT NULL,
    "internal_clause_ref" VARCHAR(200),
    "suspension_days" INTEGER,
    "suspension_start_date" DATE,
    "suspension_end_date" DATE,
    "prior_action_id" UUID,
    "generated_document_id" UUID,
    "is_void" BOOLEAN NOT NULL DEFAULT false,
    "void_reason" VARCHAR(255),
    "voided_by_id" UUID,
    "voided_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disciplinary_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "disciplinary_actions_generated_document_id_key" ON "disciplinary_actions"("generated_document_id");

-- CreateIndex
CREATE INDEX "disciplinary_actions_employee_id_incident_date_idx" ON "disciplinary_actions"("employee_id", "incident_date" DESC);

-- CreateIndex
CREATE INDEX "disciplinary_actions_employee_id_action_type_idx" ON "disciplinary_actions"("employee_id", "action_type");

-- CreateIndex
CREATE INDEX "disciplinary_actions_company_id_action_type_idx" ON "disciplinary_actions"("company_id", "action_type");

-- AddForeignKey
ALTER TABLE "disciplinary_actions" ADD CONSTRAINT "disciplinary_actions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "disciplinary_actions" ADD CONSTRAINT "disciplinary_actions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "disciplinary_actions" ADD CONSTRAINT "disciplinary_actions_issuer_id_fkey" FOREIGN KEY ("issuer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "disciplinary_actions" ADD CONSTRAINT "disciplinary_actions_prior_action_id_fkey" FOREIGN KEY ("prior_action_id") REFERENCES "disciplinary_actions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "disciplinary_actions" ADD CONSTRAINT "disciplinary_actions_generated_document_id_fkey" FOREIGN KEY ("generated_document_id") REFERENCES "generated_documents"("id") ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "disciplinary_actions" ADD CONSTRAINT "disciplinary_actions_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
