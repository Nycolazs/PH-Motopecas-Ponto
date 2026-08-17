-- CreateEnum
CREATE TYPE "AdjustmentRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "IdempotencyOperation" ADD VALUE 'CREATE_ADJUSTMENT_REQUEST';
ALTER TYPE "IdempotencyOperation" ADD VALUE 'APPROVE_ADJUSTMENT_REQUEST';
ALTER TYPE "IdempotencyOperation" ADD VALUE 'REJECT_ADJUSTMENT_REQUEST';

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'ADJUSTMENT_REQUEST_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'ADJUSTMENT_REQUEST_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE 'ADJUSTMENT_REQUEST_REJECTED';

-- AlterEnum
ALTER TYPE "AuditTargetType" ADD VALUE 'ADJUSTMENT_REQUEST';

-- CreateTable
CREATE TABLE "time_punch_adjustment_requests" (
    "id" UUID NOT NULL,
    "time_punch_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "status" "AdjustmentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requested_occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "current_occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "current_sequence" INTEGER NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "reviewed_by_id" UUID,
    "review_comment" VARCHAR(500),
    "reviewed_at" TIMESTAMPTZ(6),
    "time_adjustment_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "time_punch_adjustment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "time_punch_adjustment_requests_time_adjustment_id_key" ON "time_punch_adjustment_requests"("time_adjustment_id");

-- CreateIndex
CREATE INDEX "time_punch_adjustment_requests_employee_id_status_created_at_idx" ON "time_punch_adjustment_requests"("employee_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "time_punch_adjustment_requests_status_created_at_idx" ON "time_punch_adjustment_requests"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "time_punch_adjustment_requests_time_punch_id_idx" ON "time_punch_adjustment_requests"("time_punch_id");

-- AddForeignKey
ALTER TABLE "time_punch_adjustment_requests" ADD CONSTRAINT "time_punch_adjustment_requests_time_punch_id_fkey" FOREIGN KEY ("time_punch_id") REFERENCES "time_punches"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "time_punch_adjustment_requests" ADD CONSTRAINT "time_punch_adjustment_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "time_punch_adjustment_requests" ADD CONSTRAINT "time_punch_adjustment_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "time_punch_adjustment_requests" ADD CONSTRAINT "time_punch_adjustment_requests_time_adjustment_id_fkey" FOREIGN KEY ("time_adjustment_id") REFERENCES "time_adjustments"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
