-- AlterEnum
ALTER TYPE "IdempotencyOperation" ADD VALUE 'CREATE_VACATION';
ALTER TYPE "IdempotencyOperation" ADD VALUE 'DELETE_VACATION';

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'VACATION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'VACATION_DELETED';

-- AlterEnum
ALTER TYPE "AuditTargetType" ADD VALUE 'VACATION';

-- CreateTable
CREATE TABLE "vacations" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "note" VARCHAR(255),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "vacations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vacations_employee_id_start_date_end_date_idx" ON "vacations"("employee_id", "start_date", "end_date");

-- AddForeignKey
ALTER TABLE "vacations" ADD CONSTRAINT "vacations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "vacations" ADD CONSTRAINT "vacations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
