-- AlterEnum
ALTER TYPE "IdempotencyOperation" ADD VALUE 'DELETE_TIME_PUNCH';

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'TIME_PUNCH_DELETED';

-- DropForeignKey
ALTER TABLE "time_adjustments" DROP CONSTRAINT "time_adjustments_time_punch_id_fkey";

-- DropForeignKey
ALTER TABLE "time_punch_adjustment_requests" DROP CONSTRAINT "time_punch_adjustment_requests_time_punch_id_fkey";

-- AddForeignKey
ALTER TABLE "time_adjustments" ADD CONSTRAINT "time_adjustments_time_punch_id_fkey" FOREIGN KEY ("time_punch_id") REFERENCES "time_punches"("id") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "time_punch_adjustment_requests" ADD CONSTRAINT "time_punch_adjustment_requests_time_punch_id_fkey" FOREIGN KEY ("time_punch_id") REFERENCES "time_punches"("id") ON DELETE CASCADE ON UPDATE RESTRICT;

-- Drop immutable triggers on time_punches and time_adjustments to allow deletions and adjustments
DROP TRIGGER IF EXISTS "time_punches_immutable" ON "time_punches";
DROP TRIGGER IF EXISTS "time_adjustments_immutable" ON "time_adjustments";
