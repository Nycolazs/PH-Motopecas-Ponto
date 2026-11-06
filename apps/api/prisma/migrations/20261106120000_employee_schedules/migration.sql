-- Escala do colaborador (5x2, EC 141) and one-day schedule overrides (troca de folga).
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'EMPLOYEE_SCHEDULE_PUBLISHED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SCHEDULE_OVERRIDE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SCHEDULE_OVERRIDE_REVOKED';
ALTER TYPE "AuditTargetType" ADD VALUE IF NOT EXISTS 'EMPLOYEE_SCHEDULE';
ALTER TYPE "AuditTargetType" ADD VALUE IF NOT EXISTS 'SCHEDULE_OVERRIDE';

CREATE TYPE "ScheduleOverrideReason" AS ENUM ('SWAP', 'ADJUSTMENT');

CREATE TABLE "employee_schedule_versions" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "effective_date" DATE NOT NULL,
    "uses_company_schedule" BOOLEAN NOT NULL DEFAULT false,
    "cycle_weeks" SMALLINT NOT NULL DEFAULT 1,
    "cycle_anchor_date" DATE NOT NULL,
    "note" VARCHAR(240),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_schedule_versions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "employee_schedule_versions_cycle_weeks" CHECK ("cycle_weeks" BETWEEN 1 AND 4),
    CONSTRAINT "employee_schedule_versions_anchor_monday" CHECK (extract(isodow FROM "cycle_anchor_date") = 1)
);

CREATE UNIQUE INDEX "employee_schedule_versions_employee_id_effective_date_key"
    ON "employee_schedule_versions"("employee_id", "effective_date");

ALTER TABLE "employee_schedule_versions"
    ADD CONSTRAINT "employee_schedule_versions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    ADD CONSTRAINT "employee_schedule_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TABLE "employee_schedule_days" (
    "version_id" UUID NOT NULL,
    "cycle_week" SMALLINT NOT NULL,
    "weekday" "Weekday" NOT NULL,
    "is_workday" BOOLEAN NOT NULL,
    "start_minute" SMALLINT,
    "end_minute" SMALLINT,
    "break_start_minute" SMALLINT,
    "break_end_minute" SMALLINT,

    CONSTRAINT "employee_schedule_days_pkey" PRIMARY KEY ("version_id", "cycle_week", "weekday"),
    CONSTRAINT "employee_schedule_days_cycle_week" CHECK ("cycle_week" BETWEEN 0 AND 3),
    CONSTRAINT "employee_schedule_days_shift" CHECK (
        ("is_workday" = false AND "start_minute" IS NULL AND "end_minute" IS NULL
            AND "break_start_minute" IS NULL AND "break_end_minute" IS NULL)
        OR ("is_workday" = true AND "start_minute" BETWEEN 0 AND 1439 AND "end_minute" BETWEEN 1 AND 1440
            AND "start_minute" < "end_minute"
            AND (("break_start_minute" IS NULL AND "break_end_minute" IS NULL)
                OR ("break_start_minute" > "start_minute" AND "break_end_minute" < "end_minute"
                    AND "break_start_minute" < "break_end_minute")))
    )
);

ALTER TABLE "employee_schedule_days"
    ADD CONSTRAINT "employee_schedule_days_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "employee_schedule_versions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TABLE "schedule_overrides" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "business_date" DATE NOT NULL,
    "is_workday" BOOLEAN NOT NULL,
    "start_minute" SMALLINT,
    "end_minute" SMALLINT,
    "break_start_minute" SMALLINT,
    "break_end_minute" SMALLINT,
    "reason" "ScheduleOverrideReason" NOT NULL,
    "swap_id" UUID,
    "note" VARCHAR(240) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),
    "revoked_by_id" UUID,
    "revoke_reason" VARCHAR(240),

    CONSTRAINT "schedule_overrides_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "schedule_overrides_shift" CHECK (
        ("is_workday" = false AND "start_minute" IS NULL AND "end_minute" IS NULL
            AND "break_start_minute" IS NULL AND "break_end_minute" IS NULL)
        OR ("is_workday" = true AND "start_minute" BETWEEN 0 AND 1439 AND "end_minute" BETWEEN 1 AND 1440
            AND "start_minute" < "end_minute"
            AND (("break_start_minute" IS NULL AND "break_end_minute" IS NULL)
                OR ("break_start_minute" > "start_minute" AND "break_end_minute" < "end_minute"
                    AND "break_start_minute" < "break_end_minute")))
    ),
    CONSTRAINT "schedule_overrides_swap_has_id" CHECK ("reason" <> 'SWAP' OR "swap_id" IS NOT NULL),
    CONSTRAINT "schedule_overrides_note_not_blank" CHECK (length(btrim("note")) >= 3),
    CONSTRAINT "schedule_overrides_revocation_complete" CHECK (
        ("revoked_at" IS NULL AND "revoked_by_id" IS NULL AND "revoke_reason" IS NULL)
        OR ("revoked_at" IS NOT NULL AND "revoked_by_id" IS NOT NULL AND "revoke_reason" IS NOT NULL)
    )
);

CREATE INDEX "schedule_overrides_employee_id_business_date_idx" ON "schedule_overrides"("employee_id", "business_date");
CREATE INDEX "schedule_overrides_swap_id_idx" ON "schedule_overrides"("swap_id");
-- One active override per person and date.
CREATE UNIQUE INDEX "schedule_overrides_one_active_per_day"
    ON "schedule_overrides"("employee_id", "business_date") WHERE "revoked_at" IS NULL;

ALTER TABLE "schedule_overrides"
    ADD CONSTRAINT "schedule_overrides_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    ADD CONSTRAINT "schedule_overrides_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    ADD CONSTRAINT "schedule_overrides_revoked_by_id_fkey" FOREIGN KEY ("revoked_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- History is append-only: a version (and its days) can only be removed while it has not taken
-- effect yet (a future version being replaced); effective versions are never edited or deleted.
CREATE FUNCTION prevent_employee_schedule_version_mutation() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' AND OLD."effective_date" > (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'employee_schedule_versions rows are append-only; publish a new version instead'
        USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER employee_schedule_versions_append_only
    BEFORE UPDATE OR DELETE ON "employee_schedule_versions"
    FOR EACH ROW EXECUTE FUNCTION prevent_employee_schedule_version_mutation();

CREATE FUNCTION prevent_employee_schedule_day_mutation() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' AND EXISTS (
        SELECT 1 FROM "employee_schedule_versions" v
        WHERE v."id" = OLD."version_id"
          AND v."effective_date" > (now() AT TIME ZONE 'America/Sao_Paulo')::date
    ) THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'employee_schedule_days rows are append-only; publish a new version instead'
        USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER employee_schedule_days_append_only
    BEFORE UPDATE OR DELETE ON "employee_schedule_days"
    FOR EACH ROW EXECUTE FUNCTION prevent_employee_schedule_day_mutation();

CREATE FUNCTION prevent_schedule_override_delete() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'schedule_overrides rows are never deleted; revoke them instead'
        USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER schedule_overrides_no_delete
    BEFORE DELETE ON "schedule_overrides"
    FOR EACH ROW EXECUTE FUNCTION prevent_schedule_override_delete();
