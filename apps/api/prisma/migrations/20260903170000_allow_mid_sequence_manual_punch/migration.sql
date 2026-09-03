-- Update validate_time_punch_insert trigger function to allow mid-sequence manual punch insertions
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
