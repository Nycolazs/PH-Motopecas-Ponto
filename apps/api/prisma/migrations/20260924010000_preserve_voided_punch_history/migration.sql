-- Preserve originals, adjustments and requests when a punch is removed from calculations.
CREATE TABLE time_punch_voids (
  id uuid PRIMARY KEY,
  time_punch_id uuid NOT NULL UNIQUE REFERENCES time_punches(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  admin_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  reason varchar(500) NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 500),
  idempotency_record_id uuid NOT NULL UNIQUE REFERENCES idempotency_records(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  created_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX time_punch_voids_created_at_idx ON time_punch_voids(created_at);
-- Active uniqueness is enforced under the employee row lock in validate_time_punch_insert.
-- A replacement is allowed at the original instant of a voided punch.
DROP INDEX time_punches_employee_id_occurred_at_key;
ALTER TABLE time_adjustments DROP CONSTRAINT time_adjustments_time_punch_id_fkey;
ALTER TABLE time_adjustments ADD CONSTRAINT time_adjustments_time_punch_id_fkey FOREIGN KEY (time_punch_id) REFERENCES time_punches(id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE time_punch_adjustment_requests DROP CONSTRAINT time_punch_adjustment_requests_time_punch_id_fkey;
ALTER TABLE time_punch_adjustment_requests ADD CONSTRAINT time_punch_adjustment_requests_time_punch_id_fkey FOREIGN KEY (time_punch_id) REFERENCES time_punches(id) ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE TRIGGER time_punches_immutable BEFORE UPDATE OR DELETE ON time_punches FOR EACH ROW EXECUTE FUNCTION prevent_immutable_history_mutation();
CREATE TRIGGER time_adjustments_immutable BEFORE UPDATE OR DELETE ON time_adjustments FOR EACH ROW EXECUTE FUNCTION prevent_immutable_history_mutation();
CREATE TRIGGER time_punch_voids_immutable BEFORE UPDATE OR DELETE ON time_punch_voids FOR EACH ROW EXECUTE FUNCTION prevent_immutable_history_mutation();

CREATE FUNCTION validate_time_punch_void() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE subject_id uuid;
BEGIN
  SELECT employee_id INTO subject_id FROM time_punches WHERE id = NEW.time_punch_id;
  PERFORM 1 FROM users WHERE id = subject_id FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.admin_id AND role = 'ADMIN' AND is_active) THEN
    RAISE EXCEPTION 'punch void requires an active administrator' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM idempotency_records WHERE id = NEW.idempotency_record_id AND actor_id = NEW.admin_id AND operation = 'DELETE_TIME_PUNCH') THEN
    RAISE EXCEPTION 'punch void idempotency actor or operation is invalid' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER time_punch_voids_validate_insert BEFORE INSERT ON time_punch_voids FOR EACH ROW EXECUTE FUNCTION validate_time_punch_void();

CREATE FUNCTION reject_voided_punch_request() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE subject_id uuid;
BEGIN
  SELECT employee_id INTO subject_id FROM time_punches WHERE id = NEW.time_punch_id;
  PERFORM 1 FROM users WHERE id = subject_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM time_punch_voids WHERE time_punch_id = NEW.time_punch_id) THEN
    RAISE EXCEPTION 'voided punches cannot receive adjustment requests' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER adjustment_requests_reject_voided BEFORE INSERT ON time_punch_adjustment_requests FOR EACH ROW EXECUTE FUNCTION reject_voided_punch_request();

CREATE OR REPLACE FUNCTION validate_time_punch_insert() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  employee_role "UserRole";
  employee_active boolean;
  admin_role "UserRole";
  admin_active boolean;
  idempotency_actor uuid;
  idempotency_operation "IdempotencyOperation";
  duplicate_instant boolean;
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
      AND NOT EXISTS (SELECT 1 FROM time_punch_voids v WHERE v.time_punch_id = p.id)
      AND p."occurred_at" >= (
        target_business_date::timestamp AT TIME ZONE 'America/Sao_Paulo'
      )
      AND p."occurred_at" < (
        (target_business_date + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo'
      )
  )
  SELECT EXISTS (
    SELECT 1 FROM effective_punches
    WHERE effective_at = NEW."occurred_at"
  ) INTO duplicate_instant;

  IF duplicate_instant THEN
    RAISE EXCEPTION 'time punch at the same instant already exists'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION validate_time_adjustment_insert() RETURNS trigger
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
  IF EXISTS (SELECT 1 FROM time_punch_voids WHERE time_punch_id = NEW.time_punch_id) THEN
    RAISE EXCEPTION 'voided punches cannot be adjusted' USING ERRCODE = '23514';
  END IF;

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
      AND NOT EXISTS (SELECT 1 FROM time_punch_voids v WHERE v.time_punch_id = p.id)
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


