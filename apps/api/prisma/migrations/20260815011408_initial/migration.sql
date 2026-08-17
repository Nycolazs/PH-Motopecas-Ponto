-- Required for a database-enforced case-insensitive login identifier.
CREATE EXTENSION IF NOT EXISTS citext;

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "SessionRevocationReason" AS ENUM ('LOGOUT', 'REFRESH_REUSE', 'USER_DEACTIVATED', 'PASSWORD_RESET', 'ROLE_CHANGED', 'EXPIRED', 'ADMIN_ACTION');

-- CreateEnum
CREATE TYPE "AvatarMimeType" AS ENUM ('IMAGE_JPEG', 'IMAGE_PNG', 'IMAGE_WEBP');

-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "CalendarExceptionOperation" AS ENUM ('UPSERT', 'RETRACT');

-- CreateEnum
CREATE TYPE "CalendarExceptionKind" AS ENUM ('HOLIDAY', 'CLOSED', 'SPECIAL_HOURS');

-- CreateEnum
CREATE TYPE "TimePunchKind" AS ENUM ('CLOCK_IN', 'CLOCK_OUT');

-- CreateEnum
CREATE TYPE "TimePunchOrigin" AS ENUM ('EMPLOYEE', 'ADMIN_INSERTION');

-- CreateEnum
CREATE TYPE "IdempotencyOperation" AS ENUM ('CREATE_TIME_PUNCH', 'INSERT_TIME_PUNCH', 'ADJUST_TIME_PUNCH', 'CREATE_USER', 'UPDATE_USER', 'RESET_PASSWORD', 'CREATE_SCHEDULE', 'UPSERT_CALENDAR_EXCEPTION', 'RETRACT_CALENDAR_EXCEPTION', 'UPLOAD_AVATAR', 'REMOVE_AVATAR', 'UPDATE_SETTING', 'EXPORT_REPORT');

-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('PROCESSING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN_SUCCEEDED', 'LOGIN_FAILED', 'LOGOUT', 'REFRESH_REUSED', 'USER_CREATED', 'USER_UPDATED', 'USER_ACTIVATED', 'USER_DEACTIVATED', 'USER_PASSWORD_RESET', 'AVATAR_UPLOADED', 'AVATAR_REPLACED', 'AVATAR_REMOVED', 'ADMIN_CREATED', 'ADMIN_UPDATED', 'ADMIN_ACTIVATED', 'ADMIN_DEACTIVATED', 'ADMIN_PASSWORD_RESET', 'SCHEDULE_CREATED', 'CALENDAR_EXCEPTION_CREATED', 'CALENDAR_EXCEPTION_UPDATED', 'CALENDAR_EXCEPTION_RETRACTED', 'TIME_PUNCH_CORRECTED', 'TIME_PUNCH_INSERTED', 'SETTING_UPDATED', 'REPORT_EXPORTED');

-- CreateEnum
CREATE TYPE "AuditOutcome" AS ENUM ('SUCCESS', 'FAILURE');

-- CreateEnum
CREATE TYPE "AuditTargetType" AS ENUM ('AUTH_SESSION', 'USER', 'AVATAR', 'SCHEDULE', 'CALENDAR_EXCEPTION', 'TIME_PUNCH', 'SETTING', 'REPORT');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "login" CITEXT NOT NULL,
    "normalized_login" VARCHAR(64) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avatars" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "object_key" VARCHAR(255) NOT NULL,
    "mime_type" "AvatarMimeType" NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "checksum" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "avatars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "absolute_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "rotated_at" TIMESTAMPTZ(6),
    "replaced_by_session_id" UUID,
    "revoked_at" TIMESTAMPTZ(6),
    "revocation_reason" "SessionRevocationReason",
    "last_used_at" TIMESTAMPTZ(6),
    "device_name" VARCHAR(120),
    "user_agent" VARCHAR(512),
    "ip_hash" CHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_throttles" (
    "key_hash" CHAR(64) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "window_started_at" TIMESTAMPTZ(6) NOT NULL,
    "blocked_until" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "login_throttles_pkey" PRIMARY KEY ("key_hash")
);

-- CreateTable
CREATE TABLE "business_schedule_versions" (
    "id" UUID NOT NULL,
    "effective_date" DATE NOT NULL,
    "note" VARCHAR(240),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_schedule_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_schedule_days" (
    "id" UUID NOT NULL,
    "schedule_version_id" UUID NOT NULL,
    "weekday" "Weekday" NOT NULL,
    "is_open" BOOLEAN NOT NULL,
    "opening_minute" SMALLINT,
    "closing_minute" SMALLINT,
    "lunch_enabled" BOOLEAN NOT NULL DEFAULT false,
    "lunch_start_minute" SMALLINT,
    "lunch_end_minute" SMALLINT,

    CONSTRAINT "business_schedule_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_exceptions" (
    "id" UUID NOT NULL,
    "business_date" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_exception_revisions" (
    "id" UUID NOT NULL,
    "calendar_exception_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "operation" "CalendarExceptionOperation" NOT NULL,
    "kind" "CalendarExceptionKind",
    "name" VARCHAR(120),
    "opening_minute" SMALLINT,
    "closing_minute" SMALLINT,
    "lunch_enabled" BOOLEAN NOT NULL DEFAULT false,
    "lunch_start_minute" SMALLINT,
    "lunch_end_minute" SMALLINT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_exception_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "operation" "IdempotencyOperation" NOT NULL,
    "key_hash" CHAR(64) NOT NULL,
    "request_fingerprint" CHAR(64) NOT NULL,
    "status" "IdempotencyStatus" NOT NULL DEFAULT 'PROCESSING',
    "response_status" SMALLINT,
    "response_body" JSONB,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_punches" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "kind" "TimePunchKind" NOT NULL,
    "origin" "TimePunchOrigin" NOT NULL,
    "created_by_admin_id" UUID,
    "insertion_reason" VARCHAR(500),
    "idempotency_record_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_punches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_adjustments" (
    "id" UUID NOT NULL,
    "time_punch_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "previous_occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "corrected_occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "admin_id" UUID NOT NULL,
    "idempotency_record_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" "AuditAction" NOT NULL,
    "outcome" "AuditOutcome" NOT NULL DEFAULT 'SUCCESS',
    "target_type" "AuditTargetType" NOT NULL,
    "target_id" VARCHAR(120),
    "request_id" VARCHAR(64),
    "ip_hash" CHAR(64),
    "user_agent" VARCHAR(512),
    "before_state" JSONB,
    "after_state" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "key" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_login_key" ON "users"("login");

-- CreateIndex
CREATE UNIQUE INDEX "users_normalized_login_key" ON "users"("normalized_login");

-- CreateIndex
CREATE INDEX "users_role_is_active_idx" ON "users"("role", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "avatars_user_id_key" ON "avatars"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "avatars_object_key_key" ON "avatars"("object_key");

-- CreateIndex
CREATE INDEX "avatars_checksum_idx" ON "avatars"("checksum");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_sessions_token_hash_key" ON "refresh_sessions"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_sessions_replaced_by_session_id_key" ON "refresh_sessions"("replaced_by_session_id");

-- CreateIndex
CREATE INDEX "refresh_sessions_user_id_idx" ON "refresh_sessions"("user_id");

-- CreateIndex
CREATE INDEX "refresh_sessions_family_id_idx" ON "refresh_sessions"("family_id");

-- CreateIndex
CREATE INDEX "refresh_sessions_family_id_revoked_at_idx" ON "refresh_sessions"("family_id", "revoked_at");

-- CreateIndex
CREATE INDEX "refresh_sessions_expires_at_idx" ON "refresh_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "login_throttles_updated_at_idx" ON "login_throttles"("updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "business_schedule_versions_effective_date_key" ON "business_schedule_versions"("effective_date");

-- CreateIndex
CREATE INDEX "business_schedule_versions_effective_date_idx" ON "business_schedule_versions"("effective_date" DESC);

-- CreateIndex
CREATE INDEX "business_schedule_days_schedule_version_id_idx" ON "business_schedule_days"("schedule_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "business_schedule_days_schedule_version_id_weekday_key" ON "business_schedule_days"("schedule_version_id", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_exceptions_business_date_key" ON "calendar_exceptions"("business_date");

-- CreateIndex
CREATE INDEX "calendar_exceptions_business_date_idx" ON "calendar_exceptions"("business_date" DESC);

-- CreateIndex
CREATE INDEX "calendar_exception_revisions_calendar_exception_id_sequence_idx" ON "calendar_exception_revisions"("calendar_exception_id", "sequence" DESC);

-- CreateIndex
CREATE INDEX "calendar_exception_revisions_created_by_id_created_at_idx" ON "calendar_exception_revisions"("created_by_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "calendar_exception_revisions_calendar_exception_id_sequence_key" ON "calendar_exception_revisions"("calendar_exception_id", "sequence");

-- CreateIndex
CREATE INDEX "idempotency_records_expires_at_idx" ON "idempotency_records"("expires_at");

-- CreateIndex
CREATE INDEX "idempotency_records_status_updated_at_idx" ON "idempotency_records"("status", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_actor_id_operation_key_hash_key" ON "idempotency_records"("actor_id", "operation", "key_hash");

-- CreateIndex
CREATE UNIQUE INDEX "time_punches_idempotency_record_id_key" ON "time_punches"("idempotency_record_id");

-- CreateIndex
CREATE INDEX "time_punches_employee_id_occurred_at_id_idx" ON "time_punches"("employee_id", "occurred_at", "id");

-- CreateIndex
CREATE INDEX "time_punches_occurred_at_idx" ON "time_punches"("occurred_at");

-- CreateIndex
CREATE INDEX "time_punches_created_by_admin_id_created_at_idx" ON "time_punches"("created_by_admin_id", "created_at");

-- Database safeguard against two original punches at the same instant for one employee.
CREATE UNIQUE INDEX "time_punches_employee_id_occurred_at_key" ON "time_punches"("employee_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "time_adjustments_idempotency_record_id_key" ON "time_adjustments"("idempotency_record_id");

-- CreateIndex
CREATE INDEX "time_adjustments_time_punch_id_created_at_idx" ON "time_adjustments"("time_punch_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "time_adjustments_admin_id_created_at_idx" ON "time_adjustments"("admin_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "time_adjustments_time_punch_id_sequence_key" ON "time_adjustments"("time_punch_id", "sequence");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_target_type_target_id_created_at_idx" ON "audit_logs"("target_type", "target_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "avatars" ADD CONSTRAINT "avatars_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_replaced_by_session_id_fkey" FOREIGN KEY ("replaced_by_session_id") REFERENCES "refresh_sessions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "business_schedule_versions" ADD CONSTRAINT "business_schedule_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "business_schedule_days" ADD CONSTRAINT "business_schedule_days_schedule_version_id_fkey" FOREIGN KEY ("schedule_version_id") REFERENCES "business_schedule_versions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "calendar_exception_revisions" ADD CONSTRAINT "calendar_exception_revisions_calendar_exception_id_fkey" FOREIGN KEY ("calendar_exception_id") REFERENCES "calendar_exceptions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "calendar_exception_revisions" ADD CONSTRAINT "calendar_exception_revisions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "time_punches" ADD CONSTRAINT "time_punches_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "time_punches" ADD CONSTRAINT "time_punches_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "time_punches" ADD CONSTRAINT "time_punches_idempotency_record_id_fkey" FOREIGN KEY ("idempotency_record_id") REFERENCES "idempotency_records"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "time_adjustments" ADD CONSTRAINT "time_adjustments_time_punch_id_fkey" FOREIGN KEY ("time_punch_id") REFERENCES "time_punches"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "time_adjustments" ADD CONSTRAINT "time_adjustments_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "time_adjustments" ADD CONSTRAINT "time_adjustments_idempotency_record_id_fkey" FOREIGN KEY ("idempotency_record_id") REFERENCES "idempotency_records"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Scalar and state constraints that Prisma cannot fully express.
ALTER TABLE "users"
  ADD CONSTRAINT "users_name_not_blank" CHECK (char_length(btrim("name")) BETWEEN 1 AND 120),
  ADD CONSTRAINT "users_login_length" CHECK (char_length(btrim("login"::text)) BETWEEN 3 AND 64),
  ADD CONSTRAINT "users_normalized_login_format" CHECK (
    char_length("normalized_login") BETWEEN 3 AND 64
    AND "normalized_login" = btrim("normalized_login")
    AND "normalized_login" = lower("normalized_login")
  ),
  ADD CONSTRAINT "users_password_hash_not_blank" CHECK (char_length(btrim("password_hash")) >= 20);

ALTER TABLE "avatars"
  ADD CONSTRAINT "avatars_object_key_safe" CHECK (
    char_length("object_key") BETWEEN 1 AND 255
    AND "object_key" !~ '(^|/)\.\.(/|$)'
    AND "object_key" !~ '[\\\\\x00]'
  ),
  ADD CONSTRAINT "avatars_byte_size_positive" CHECK ("byte_size" > 0),
  ADD CONSTRAINT "avatars_dimensions_positive" CHECK ("width" > 0 AND "height" > 0),
  ADD CONSTRAINT "avatars_checksum_sha256" CHECK ("checksum" ~ '^[0-9a-f]{64}$');

ALTER TABLE "refresh_sessions"
  ADD CONSTRAINT "refresh_sessions_token_hash_sha256" CHECK ("token_hash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "refresh_sessions_ip_hash_sha256" CHECK ("ip_hash" IS NULL OR "ip_hash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "refresh_sessions_expiry_order" CHECK (
    "expires_at" > "created_at" AND "absolute_expires_at" >= "expires_at"
  ),
  ADD CONSTRAINT "refresh_sessions_rotation_pair" CHECK (
    ("rotated_at" IS NULL AND "replaced_by_session_id" IS NULL)
    OR ("rotated_at" IS NOT NULL AND "replaced_by_session_id" IS NOT NULL)
  ),
  ADD CONSTRAINT "refresh_sessions_revocation_pair" CHECK (
    ("revoked_at" IS NULL AND "revocation_reason" IS NULL)
    OR ("revoked_at" IS NOT NULL AND "revocation_reason" IS NOT NULL)
  ),
  ADD CONSTRAINT "refresh_sessions_event_order" CHECK (
    ("rotated_at" IS NULL OR "rotated_at" >= "created_at")
    AND ("revoked_at" IS NULL OR "revoked_at" >= "created_at")
    AND ("last_used_at" IS NULL OR "last_used_at" >= "created_at")
  );

ALTER TABLE "login_throttles"
  ADD CONSTRAINT "login_throttles_key_hash_sha256" CHECK ("key_hash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "login_throttles_attempts_nonnegative" CHECK ("attempts" >= 0),
  ADD CONSTRAINT "login_throttles_block_order" CHECK (
    "blocked_until" IS NULL OR "blocked_until" >= "window_started_at"
  );

ALTER TABLE "business_schedule_days"
  ADD CONSTRAINT "business_schedule_days_valid_hours" CHECK (
    (
      NOT "is_open"
      AND "opening_minute" IS NULL
      AND "closing_minute" IS NULL
      AND NOT "lunch_enabled"
      AND "lunch_start_minute" IS NULL
      AND "lunch_end_minute" IS NULL
    )
    OR
    (
      "is_open"
      AND "opening_minute" IS NOT NULL
      AND "closing_minute" IS NOT NULL
      AND "opening_minute" BETWEEN 0 AND 1439
      AND "closing_minute" BETWEEN 1 AND 1440
      AND "opening_minute" < "closing_minute"
      AND (
        (
          NOT "lunch_enabled"
          AND "lunch_start_minute" IS NULL
          AND "lunch_end_minute" IS NULL
        )
        OR
        (
          "lunch_enabled"
          AND "lunch_start_minute" IS NOT NULL
          AND "lunch_end_minute" IS NOT NULL
          AND "lunch_start_minute" >= "opening_minute"
          AND "lunch_start_minute" < "lunch_end_minute"
          AND "lunch_end_minute" <= "closing_minute"
        )
      )
    )
  );

ALTER TABLE "calendar_exception_revisions"
  ADD CONSTRAINT "calendar_exception_revisions_sequence_positive" CHECK ("sequence" > 0),
  ADD CONSTRAINT "calendar_exception_revisions_valid_payload" CHECK (
    (
      "operation" = 'RETRACT'
      AND "kind" IS NULL
      AND "name" IS NULL
      AND "opening_minute" IS NULL
      AND "closing_minute" IS NULL
      AND NOT "lunch_enabled"
      AND "lunch_start_minute" IS NULL
      AND "lunch_end_minute" IS NULL
    )
    OR
    (
      "operation" = 'UPSERT'
      AND "kind" IN ('HOLIDAY', 'CLOSED')
      AND "name" IS NOT NULL
      AND char_length(btrim("name")) BETWEEN 1 AND 120
      AND "opening_minute" IS NULL
      AND "closing_minute" IS NULL
      AND NOT "lunch_enabled"
      AND "lunch_start_minute" IS NULL
      AND "lunch_end_minute" IS NULL
    )
    OR
    (
      "operation" = 'UPSERT'
      AND "kind" = 'SPECIAL_HOURS'
      AND "name" IS NOT NULL
      AND char_length(btrim("name")) BETWEEN 1 AND 120
      AND "opening_minute" IS NOT NULL
      AND "closing_minute" IS NOT NULL
      AND "opening_minute" BETWEEN 0 AND 1439
      AND "closing_minute" BETWEEN 1 AND 1440
      AND "opening_minute" < "closing_minute"
      AND (
        (
          NOT "lunch_enabled"
          AND "lunch_start_minute" IS NULL
          AND "lunch_end_minute" IS NULL
        )
        OR
        (
          "lunch_enabled"
          AND "lunch_start_minute" IS NOT NULL
          AND "lunch_end_minute" IS NOT NULL
          AND "lunch_start_minute" >= "opening_minute"
          AND "lunch_start_minute" < "lunch_end_minute"
          AND "lunch_end_minute" <= "closing_minute"
        )
      )
    )
  );

ALTER TABLE "idempotency_records"
  ADD CONSTRAINT "idempotency_records_key_hash_sha256" CHECK ("key_hash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "idempotency_records_fingerprint_sha256" CHECK ("request_fingerprint" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "idempotency_records_expiry_order" CHECK ("expires_at" > "created_at"),
  ADD CONSTRAINT "idempotency_records_response_size" CHECK (
    "response_body" IS NULL OR octet_length("response_body"::text) <= 65536
  ),
  ADD CONSTRAINT "idempotency_records_completion_state" CHECK (
    ("status" = 'PROCESSING' AND "response_status" IS NULL AND "response_body" IS NULL)
    OR
    (
      "status" = 'COMPLETED'
      AND "response_status" BETWEEN 200 AND 299
      AND "response_body" IS NOT NULL
    )
  );

ALTER TABLE "time_punches"
  ADD CONSTRAINT "time_punches_origin_provenance" CHECK (
    (
      "origin" = 'EMPLOYEE'
      AND "created_by_admin_id" IS NULL
      AND "insertion_reason" IS NULL
    )
    OR
    (
      "origin" = 'ADMIN_INSERTION'
      AND "created_by_admin_id" IS NOT NULL
      AND "insertion_reason" IS NOT NULL
      AND char_length(btrim("insertion_reason")) BETWEEN 1 AND 500
    )
  );

ALTER TABLE "time_adjustments"
  ADD CONSTRAINT "time_adjustments_sequence_positive" CHECK ("sequence" > 0),
  ADD CONSTRAINT "time_adjustments_changed_instant" CHECK ("previous_occurred_at" <> "corrected_occurred_at"),
  ADD CONSTRAINT "time_adjustments_reason_not_blank" CHECK (char_length(btrim("reason")) BETWEEN 1 AND 500);

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_ip_hash_sha256" CHECK ("ip_hash" IS NULL OR "ip_hash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "audit_logs_request_id_bounded" CHECK (
    "request_id" IS NULL OR char_length(btrim("request_id")) BETWEEN 1 AND 64
  ),
  ADD CONSTRAINT "audit_logs_state_size" CHECK (
    ("before_state" IS NULL OR octet_length("before_state"::text) <= 65536)
    AND ("after_state" IS NULL OR octet_length("after_state"::text) <= 65536)
    AND ("metadata" IS NULL OR octet_length("metadata"::text) <= 32768)
  );

ALTER TABLE "app_settings"
  ADD CONSTRAINT "app_settings_key_format" CHECK ("key" ~ '^[a-z][a-z0-9_.-]{0,99}$'),
  ADD CONSTRAINT "app_settings_value_size" CHECK (octet_length("value"::text) <= 65536);

-- Preserve display casing while trimming identity fields. Unicode NFKC login normalization
-- is deliberately performed in the application because PostgreSQL has no equivalent built-in.
CREATE FUNCTION trim_user_identity() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."name" := btrim(NEW."name");
  NEW."login" := btrim(NEW."login"::text)::citext;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "users_normalize_identity"
BEFORE INSERT OR UPDATE OF "name", "login", "normalized_login" ON "users"
FOR EACH ROW EXECUTE FUNCTION trim_user_identity();

-- Users are retained for attendance/audit history; application operations deactivate them.
CREATE FUNCTION prevent_user_delete() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'users are retained and cannot be deleted'
    USING ERRCODE = '23503';
END;
$$;

CREATE TRIGGER "users_prevent_delete"
BEFORE DELETE ON "users"
FOR EACH ROW EXECUTE FUNCTION prevent_user_delete();

-- Serializes every active-admin demotion/deactivation and protects the final administrator.
CREATE FUNCTION protect_last_active_admin() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  remaining_admins integer;
BEGIN
  IF OLD."role" = 'ADMIN' AND OLD."is_active"
    AND (NEW."role" <> 'ADMIN' OR NOT NEW."is_active") THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('ph-ponto:last-active-admin', 0));

    SELECT count(*) INTO remaining_admins
    FROM "users"
    WHERE "role" = 'ADMIN'
      AND "is_active"
      AND "id" <> OLD."id";

    IF remaining_admins = 0 THEN
      RAISE EXCEPTION 'the last active administrator cannot be disabled or demoted'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "users_protect_last_active_admin"
BEFORE UPDATE OF "role", "is_active" ON "users"
FOR EACH ROW EXECUTE FUNCTION protect_last_active_admin();

-- Refresh families retain each rotated token for reuse detection.
CREATE FUNCTION validate_refresh_session() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  family_user_id uuid;
  family_absolute_expiry timestamptz;
  replacement_user_id uuid;
  replacement_family_id uuid;
  replacement_absolute_expiry timestamptz;
  replacement_has_successor boolean;
BEGIN
  IF TG_OP = 'UPDATE' AND (
    OLD."id" <> NEW."id"
    OR OLD."user_id" <> NEW."user_id"
    OR OLD."family_id" <> NEW."family_id"
    OR OLD."token_hash" <> NEW."token_hash"
    OR OLD."expires_at" <> NEW."expires_at"
    OR OLD."absolute_expires_at" <> NEW."absolute_expires_at"
    OR OLD."device_name" IS DISTINCT FROM NEW."device_name"
    OR OLD."user_agent" IS DISTINCT FROM NEW."user_agent"
    OR OLD."ip_hash" IS DISTINCT FROM NEW."ip_hash"
    OR OLD."created_at" <> NEW."created_at"
  ) THEN
    RAISE EXCEPTION 'refresh session issuance identity is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD."rotated_at" IS NOT NULL
    AND (
      OLD."rotated_at" IS DISTINCT FROM NEW."rotated_at"
      OR OLD."replaced_by_session_id" IS DISTINCT FROM NEW."replaced_by_session_id"
    ) THEN
    RAISE EXCEPTION 'refresh session rotation is immutable once recorded'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD."revoked_at" IS NOT NULL
    AND (
      OLD."revoked_at" IS DISTINCT FROM NEW."revoked_at"
      OR OLD."revocation_reason" IS DISTINCT FROM NEW."revocation_reason"
    ) THEN
    RAISE EXCEPTION 'refresh session revocation is immutable once recorded'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD."revoked_at" IS NOT NULL
    AND OLD."rotated_at" IS NULL
    AND NEW."rotated_at" IS NOT NULL THEN
    RAISE EXCEPTION 'a revoked refresh session cannot rotate'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD."last_used_at" IS NOT NULL
    AND (NEW."last_used_at" IS NULL OR NEW."last_used_at" < OLD."last_used_at") THEN
    RAISE EXCEPTION 'refresh session last-used time cannot move backwards'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."replaced_by_session_id" = NEW."id" THEN
    RAISE EXCEPTION 'a refresh session cannot replace itself' USING ERRCODE = '23514';
  END IF;

  SELECT "user_id", "absolute_expires_at"
    INTO family_user_id, family_absolute_expiry
  FROM "refresh_sessions"
  WHERE "family_id" = NEW."family_id" AND "id" <> NEW."id"
  ORDER BY "created_at"
  LIMIT 1;

  IF FOUND AND (
    family_user_id <> NEW."user_id"
    OR family_absolute_expiry <> NEW."absolute_expires_at"
  ) THEN
    RAISE EXCEPTION 'refresh family user and absolute expiry must remain stable'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."replaced_by_session_id" IS NOT NULL
    AND (
      TG_OP = 'INSERT'
      OR (TG_OP = 'UPDATE' AND OLD."replaced_by_session_id" IS DISTINCT FROM NEW."replaced_by_session_id")
    ) THEN
    SELECT "user_id", "family_id", "absolute_expires_at", "replaced_by_session_id" IS NOT NULL
      INTO replacement_user_id, replacement_family_id, replacement_absolute_expiry, replacement_has_successor
    FROM "refresh_sessions"
    WHERE "id" = NEW."replaced_by_session_id";

    IF NOT FOUND
      OR replacement_user_id <> NEW."user_id"
      OR replacement_family_id <> NEW."family_id"
      OR replacement_absolute_expiry <> NEW."absolute_expires_at"
      OR replacement_has_successor THEN
      RAISE EXCEPTION 'replacement refresh session must belong to the same family'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "refresh_sessions_validate_family"
BEFORE INSERT OR UPDATE ON "refresh_sessions"
FOR EACH ROW EXECUTE FUNCTION validate_refresh_session();

-- Schedule snapshots are complete immutable seven-day configurations.
CREATE FUNCTION validate_schedule_creator() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  actor_role "UserRole";
  actor_active boolean;
BEGIN
  SELECT "role", "is_active" INTO actor_role, actor_active
  FROM "users" WHERE "id" = NEW."created_by_id";

  IF NOT FOUND OR actor_role <> 'ADMIN' OR NOT actor_active THEN
    RAISE EXCEPTION 'schedule creator must be an active administrator'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "business_schedule_versions_validate_creator"
BEFORE INSERT ON "business_schedule_versions"
FOR EACH ROW EXECUTE FUNCTION validate_schedule_creator();

CREATE FUNCTION verify_schedule_has_seven_days() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  version_id uuid;
  day_count integer;
BEGIN
  version_id := (
    to_jsonb(NEW) ->> CASE
      WHEN TG_TABLE_NAME = 'business_schedule_versions' THEN 'id'
      ELSE 'schedule_version_id'
    END
  )::uuid;

  SELECT count(*) INTO day_count
  FROM "business_schedule_days"
  WHERE "schedule_version_id" = version_id;

  IF day_count <> 7 THEN
    RAISE EXCEPTION 'a business schedule version must contain exactly seven weekdays'
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "business_schedule_versions_require_seven_days"
AFTER INSERT ON "business_schedule_versions"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION verify_schedule_has_seven_days();

CREATE CONSTRAINT TRIGGER "business_schedule_days_require_seven_days"
AFTER INSERT ON "business_schedule_days"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION verify_schedule_has_seven_days();

-- Exception parents and revisions are immutable; revisions append monotonically.
CREATE FUNCTION validate_exception_revision() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  expected_sequence integer;
  actor_role "UserRole";
  actor_active boolean;
BEGIN
  PERFORM 1 FROM "calendar_exceptions"
  WHERE "id" = NEW."calendar_exception_id"
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'calendar exception does not exist' USING ERRCODE = '23503';
  END IF;

  SELECT COALESCE(max("sequence"), 0) + 1 INTO expected_sequence
  FROM "calendar_exception_revisions"
  WHERE "calendar_exception_id" = NEW."calendar_exception_id";

  IF NEW."sequence" <> expected_sequence THEN
    RAISE EXCEPTION 'calendar exception revision sequence must be monotonic'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."sequence" = 1 AND NEW."operation" = 'RETRACT' THEN
    RAISE EXCEPTION 'the first calendar exception revision cannot retract'
      USING ERRCODE = '23514';
  END IF;

  SELECT "role", "is_active" INTO actor_role, actor_active
  FROM "users" WHERE "id" = NEW."created_by_id";

  IF NOT FOUND OR actor_role <> 'ADMIN' OR NOT actor_active THEN
    RAISE EXCEPTION 'calendar exception author must be an active administrator'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "calendar_exception_revisions_validate_insert"
BEFORE INSERT ON "calendar_exception_revisions"
FOR EACH ROW EXECUTE FUNCTION validate_exception_revision();

CREATE FUNCTION verify_exception_has_revision() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "calendar_exception_revisions"
    WHERE "calendar_exception_id" = NEW."id"
  ) THEN
    RAISE EXCEPTION 'a calendar exception must contain an initial revision'
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "calendar_exceptions_require_revision"
AFTER INSERT ON "calendar_exceptions"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION verify_exception_has_revision();

-- Idempotency identity is permanent and a completed response cannot be rewritten.
CREATE FUNCTION protect_idempotency_record() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."actor_id" <> NEW."actor_id"
    OR OLD."operation" <> NEW."operation"
    OR OLD."key_hash" <> NEW."key_hash"
    OR OLD."request_fingerprint" <> NEW."request_fingerprint"
    OR OLD."expires_at" <> NEW."expires_at"
    OR OLD."created_at" <> NEW."created_at" THEN
    RAISE EXCEPTION 'idempotency request identity is immutable' USING ERRCODE = '23514';
  END IF;

  IF OLD."status" = 'COMPLETED' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'a completed idempotency response is immutable' USING ERRCODE = '23514';
  END IF;

  IF OLD."status" = 'PROCESSING' AND NEW."status" NOT IN ('PROCESSING', 'COMPLETED') THEN
    RAISE EXCEPTION 'invalid idempotency lifecycle transition' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "idempotency_records_protect_lifecycle"
BEFORE UPDATE ON "idempotency_records"
FOR EACH ROW EXECUTE FUNCTION protect_idempotency_record();

CREATE FUNCTION verify_idempotency_completed() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "idempotency_records"
    WHERE "id" = NEW."id" AND "status" <> 'COMPLETED'
  ) THEN
    RAISE EXCEPTION 'idempotency records must complete in their mutation transaction'
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "idempotency_records_require_completion"
AFTER INSERT OR UPDATE ON "idempotency_records"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION verify_idempotency_completed();

-- Punch insertion locks the employee stream and validates the entire local-day chronology.
CREATE FUNCTION validate_time_punch_insert() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  employee_role "UserRole";
  employee_active boolean;
  admin_role "UserRole";
  admin_active boolean;
  idempotency_actor uuid;
  idempotency_operation "IdempotencyOperation";
  invalid_chronology boolean;
  target_business_date date;
BEGIN
  SELECT "role", "is_active" INTO employee_role, employee_active
  FROM "users" WHERE "id" = NEW."employee_id"
  FOR UPDATE;

  IF NOT FOUND OR employee_role <> 'EMPLOYEE' THEN
    RAISE EXCEPTION 'time punches require an employee user' USING ERRCODE = '23514';
  END IF;

  IF NEW."origin" = 'EMPLOYEE' AND NOT employee_active THEN
    RAISE EXCEPTION 'inactive employees cannot create time punches' USING ERRCODE = '23514';
  END IF;

  SELECT "actor_id", "operation" INTO idempotency_actor, idempotency_operation
  FROM "idempotency_records" WHERE "id" = NEW."idempotency_record_id";

  IF NOT FOUND THEN
    RAISE EXCEPTION 'time punch idempotency record does not exist' USING ERRCODE = '23503';
  END IF;

  IF NEW."origin" = 'EMPLOYEE' THEN
    IF idempotency_actor <> NEW."employee_id" OR idempotency_operation <> 'CREATE_TIME_PUNCH' THEN
      RAISE EXCEPTION 'employee punch idempotency actor or operation is invalid'
        USING ERRCODE = '23514';
    END IF;
  ELSE
    SELECT "role", "is_active" INTO admin_role, admin_active
    FROM "users" WHERE "id" = NEW."created_by_admin_id";

    IF NOT FOUND OR admin_role <> 'ADMIN' OR NOT admin_active THEN
      RAISE EXCEPTION 'administrative punch insertion requires an active administrator'
        USING ERRCODE = '23514';
    END IF;

    IF idempotency_actor <> NEW."created_by_admin_id" OR idempotency_operation <> 'INSERT_TIME_PUNCH' THEN
      RAISE EXCEPTION 'administrative punch idempotency actor or operation is invalid'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  target_business_date := (NEW."occurred_at" AT TIME ZONE 'America/Sao_Paulo')::date;

  WITH effective_punches AS (
    SELECT
      p."id",
      p."kind",
      COALESCE(
        (
          SELECT a."corrected_occurred_at"
          FROM "time_adjustments" a
          WHERE a."time_punch_id" = p."id"
          ORDER BY a."sequence" DESC
          LIMIT 1
        ),
        p."occurred_at"
      ) AS effective_at
    FROM "time_punches" p
    WHERE p."employee_id" = NEW."employee_id"
      AND p."occurred_at" >= (
        target_business_date::timestamp AT TIME ZONE 'America/Sao_Paulo'
      )
      AND p."occurred_at" < (
        (target_business_date + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo'
      )

    UNION ALL

    SELECT NEW."id", NEW."kind", NEW."occurred_at"
  ), ordered AS (
    SELECT
      "kind",
      effective_at,
      row_number() OVER (ORDER BY effective_at, "id") AS position,
      lag(effective_at) OVER (ORDER BY effective_at, "id") AS previous_at
    FROM effective_punches
  )
  SELECT EXISTS (
    SELECT 1 FROM ordered
    WHERE effective_at = previous_at
      OR (position % 2 = 1 AND "kind" <> 'CLOCK_IN')
      OR (position % 2 = 0 AND "kind" <> 'CLOCK_OUT')
  ) INTO invalid_chronology;

  IF invalid_chronology THEN
    RAISE EXCEPTION 'time punch chronology must start with CLOCK_IN and alternate'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "time_punches_validate_insert"
BEFORE INSERT ON "time_punches"
FOR EACH ROW EXECUTE FUNCTION validate_time_punch_insert();

-- Adjustments append the exact prior effective value and cannot branch or cross neighbors/dates.
CREATE FUNCTION validate_time_adjustment_insert() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_employee_id uuid;
  original_occurred_at timestamptz;
  expected_sequence integer;
  expected_previous timestamptz;
  previous_neighbor timestamptz;
  next_neighbor timestamptz;
  admin_role "UserRole";
  admin_active boolean;
  idempotency_actor uuid;
  idempotency_operation "IdempotencyOperation";
  target_business_date date;
BEGIN
  SELECT "employee_id", "occurred_at" INTO target_employee_id, original_occurred_at
  FROM "time_punches" WHERE "id" = NEW."time_punch_id";

  IF NOT FOUND THEN
    RAISE EXCEPTION 'time punch does not exist' USING ERRCODE = '23503';
  END IF;

  PERFORM 1 FROM "users" WHERE "id" = target_employee_id FOR UPDATE;

  SELECT "role", "is_active" INTO admin_role, admin_active
  FROM "users" WHERE "id" = NEW."admin_id";

  IF NOT FOUND OR admin_role <> 'ADMIN' OR NOT admin_active THEN
    RAISE EXCEPTION 'time adjustment requires an active administrator'
      USING ERRCODE = '23514';
  END IF;

  SELECT "actor_id", "operation" INTO idempotency_actor, idempotency_operation
  FROM "idempotency_records" WHERE "id" = NEW."idempotency_record_id";

  IF NOT FOUND
    OR idempotency_actor <> NEW."admin_id"
    OR idempotency_operation <> 'ADJUST_TIME_PUNCH' THEN
    RAISE EXCEPTION 'time adjustment idempotency actor or operation is invalid'
      USING ERRCODE = '23514';
  END IF;

  SELECT
    COALESCE(max("sequence"), 0) + 1,
    COALESCE(
      (array_agg("corrected_occurred_at" ORDER BY "sequence" DESC))[1],
      original_occurred_at
    )
  INTO expected_sequence, expected_previous
  FROM "time_adjustments"
  WHERE "time_punch_id" = NEW."time_punch_id";

  IF NEW."sequence" <> expected_sequence OR NEW."previous_occurred_at" <> expected_previous THEN
    RAISE EXCEPTION 'time adjustment must append from the latest effective value'
      USING ERRCODE = '23514';
  END IF;

  IF (NEW."corrected_occurred_at" AT TIME ZONE 'America/Sao_Paulo')::date
    <> (original_occurred_at AT TIME ZONE 'America/Sao_Paulo')::date THEN
    RAISE EXCEPTION 'time adjustment cannot change the business date'
      USING ERRCODE = '23514';
  END IF;

  target_business_date := (original_occurred_at AT TIME ZONE 'America/Sao_Paulo')::date;

  WITH effective_punches AS (
    SELECT
      p."id",
      COALESCE(
        (
          SELECT a."corrected_occurred_at"
          FROM "time_adjustments" a
          WHERE a."time_punch_id" = p."id"
          ORDER BY a."sequence" DESC
          LIMIT 1
        ),
        p."occurred_at"
      ) AS effective_at
    FROM "time_punches" p
    WHERE p."employee_id" = target_employee_id
      AND p."occurred_at" >= (
        target_business_date::timestamp AT TIME ZONE 'America/Sao_Paulo'
      )
      AND p."occurred_at" < (
        (target_business_date + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo'
      )
  ), ordered AS (
    SELECT
      "id",
      lag(effective_at) OVER (ORDER BY effective_at, "id") AS previous_at,
      lead(effective_at) OVER (ORDER BY effective_at, "id") AS next_at
    FROM effective_punches
  )
  SELECT previous_at, next_at INTO previous_neighbor, next_neighbor
  FROM ordered WHERE "id" = NEW."time_punch_id";

  IF (previous_neighbor IS NOT NULL AND NEW."corrected_occurred_at" <= previous_neighbor)
    OR (next_neighbor IS NOT NULL AND NEW."corrected_occurred_at" >= next_neighbor) THEN
    RAISE EXCEPTION 'time adjustment cannot equal or cross a neighboring punch'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "time_adjustments_validate_insert"
BEFORE INSERT ON "time_adjustments"
FOR EACH ROW EXECUTE FUNCTION validate_time_adjustment_insert();

-- The following history tables are append-only after their validated insert transaction.
CREATE FUNCTION prevent_immutable_history_mutation() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER "business_schedule_versions_immutable"
BEFORE UPDATE OR DELETE ON "business_schedule_versions"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_history_mutation();

CREATE TRIGGER "business_schedule_days_immutable"
BEFORE UPDATE OR DELETE ON "business_schedule_days"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_history_mutation();

CREATE TRIGGER "calendar_exceptions_immutable"
BEFORE UPDATE OR DELETE ON "calendar_exceptions"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_history_mutation();

CREATE TRIGGER "calendar_exception_revisions_immutable"
BEFORE UPDATE OR DELETE ON "calendar_exception_revisions"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_history_mutation();

CREATE TRIGGER "time_punches_immutable"
BEFORE UPDATE OR DELETE ON "time_punches"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_history_mutation();

CREATE TRIGGER "time_adjustments_immutable"
BEFORE UPDATE OR DELETE ON "time_adjustments"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_history_mutation();

CREATE TRIGGER "audit_logs_immutable"
BEFORE UPDATE OR DELETE ON "audit_logs"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_history_mutation();
