-- Abono (one day) and atestado médico (date range) excusing an employee's absence.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ABSENCE_JUSTIFIED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ABSENCE_JUSTIFICATION_REVOKED';
ALTER TYPE "AuditTargetType" ADD VALUE IF NOT EXISTS 'ABSENCE_JUSTIFICATION';

CREATE TYPE "AbsenceJustificationKind" AS ENUM ('ALLOWANCE', 'MEDICAL_CERTIFICATE');

CREATE TABLE "absence_justifications" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "kind" "AbsenceJustificationKind" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),
    "revoked_by_id" UUID,
    "revoke_reason" VARCHAR(500),

    CONSTRAINT "absence_justifications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "absence_justifications_date_range" CHECK ("start_date" <= "end_date"),
    CONSTRAINT "absence_justifications_max_31_days" CHECK ("end_date" - "start_date" <= 30),
    CONSTRAINT "absence_justifications_allowance_single_day" CHECK ("kind" <> 'ALLOWANCE' OR "start_date" = "end_date"),
    CONSTRAINT "absence_justifications_reason_not_blank" CHECK (length(btrim("reason")) >= 3),
    CONSTRAINT "absence_justifications_revocation_complete" CHECK (
        ("revoked_at" IS NULL AND "revoked_by_id" IS NULL AND "revoke_reason" IS NULL)
        OR ("revoked_at" IS NOT NULL AND "revoked_by_id" IS NOT NULL AND "revoke_reason" IS NOT NULL)
    )
);

CREATE INDEX "absence_justifications_employee_id_start_date_end_date_idx"
    ON "absence_justifications"("employee_id", "start_date", "end_date");

ALTER TABLE "absence_justifications"
    ADD CONSTRAINT "absence_justifications_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    ADD CONSTRAINT "absence_justifications_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    ADD CONSTRAINT "absence_justifications_revoked_by_id_fkey" FOREIGN KEY ("revoked_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Records are cancelled, never deleted.
CREATE FUNCTION prevent_absence_justification_delete() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'absence_justifications rows are never deleted; revoke them instead'
        USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER absence_justifications_no_delete
    BEFORE DELETE ON "absence_justifications"
    FOR EACH ROW EXECUTE FUNCTION prevent_absence_justification_delete();
