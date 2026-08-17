\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
  admin_id uuid;
  target_family_id constant uuid := '10000000-0000-4000-8000-000000000001';
  first_session_id constant uuid := '10000000-0000-4000-8000-000000000002';
  second_session_id constant uuid := '10000000-0000-4000-8000-000000000003';
  third_session_id constant uuid := '10000000-0000-4000-8000-000000000004';
  employee_id constant uuid := '20000000-0000-4000-8000-000000000001';
  first_punch_id constant uuid := '20000000-0000-4000-8000-000000000002';
  second_punch_id constant uuid := '20000000-0000-4000-8000-000000000003';
  third_punch_id constant uuid := '20000000-0000-4000-8000-000000000004';
  fourth_punch_id constant uuid := '20000000-0000-4000-8000-000000000005';
  revoked_count integer;
BEGIN
  SELECT "id" INTO admin_id
  FROM "users"
  WHERE "role" = 'ADMIN' AND "is_active"
  ORDER BY "created_at"
  LIMIT 1;

  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'run the idempotent seed before constraint verification';
  END IF;

  BEGIN
    UPDATE "users" SET "is_active" = false WHERE "id" = admin_id;
    RAISE EXCEPTION 'last-active-admin constraint did not reject deactivation';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  BEGIN
    UPDATE "business_schedule_versions"
    SET "note" = 'mutation must fail'
    WHERE "effective_date" = DATE '1970-01-01';
    RAISE EXCEPTION 'schedule immutability trigger did not reject mutation';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  INSERT INTO "refresh_sessions" (
    "id", "user_id", "family_id", "token_hash", "expires_at", "absolute_expires_at", "created_at"
  ) VALUES (
    first_session_id,
    admin_id,
    target_family_id,
    repeat('a', 64),
    clock_timestamp() + interval '1 hour',
    clock_timestamp() + interval '24 hours',
    clock_timestamp()
  );

  INSERT INTO "refresh_sessions" (
    "id", "user_id", "family_id", "token_hash", "expires_at", "absolute_expires_at", "created_at"
  )
  SELECT
    second_session_id,
    admin_id,
    target_family_id,
    repeat('b', 64),
    clock_timestamp() + interval '1 hour',
    "absolute_expires_at",
    clock_timestamp()
  FROM "refresh_sessions"
  WHERE "id" = first_session_id;

  UPDATE "refresh_sessions"
  SET "rotated_at" = clock_timestamp(), "replaced_by_session_id" = second_session_id
  WHERE "id" = first_session_id;

  INSERT INTO "refresh_sessions" (
    "id", "user_id", "family_id", "token_hash", "expires_at", "absolute_expires_at", "created_at"
  )
  SELECT
    third_session_id,
    admin_id,
    target_family_id,
    repeat('c', 64),
    clock_timestamp() + interval '1 hour',
    "absolute_expires_at",
    clock_timestamp()
  FROM "refresh_sessions"
  WHERE "id" = second_session_id;

  UPDATE "refresh_sessions"
  SET "rotated_at" = clock_timestamp(), "replaced_by_session_id" = third_session_id
  WHERE "id" = second_session_id;

  BEGIN
    UPDATE "refresh_sessions"
    SET "token_hash" = repeat('d', 64)
    WHERE "id" = first_session_id;
    RAISE EXCEPTION 'refresh issuance immutability did not reject token identity mutation';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  UPDATE "refresh_sessions"
  SET "revoked_at" = clock_timestamp(), "revocation_reason" = 'ADMIN_ACTION'
  WHERE "refresh_sessions"."family_id" = target_family_id;

  SELECT count(*) INTO revoked_count
  FROM "refresh_sessions"
  WHERE "refresh_sessions"."family_id" = target_family_id
    AND "revoked_at" IS NOT NULL
    AND "revocation_reason" = 'ADMIN_ACTION';

  IF revoked_count <> 3 THEN
    RAISE EXCEPTION 'refresh family revocation expected 3 rows, received %', revoked_count;
  END IF;

  INSERT INTO "users" (
    "id", "name", "login", "normalized_login", "password_hash", "role", "is_active", "updated_at"
  )
  SELECT
    employee_id, 'Funcionário de teste', 'constraint-employee', 'constraint-employee',
    "password_hash", 'EMPLOYEE', true, clock_timestamp()
  FROM "users" WHERE "id" = admin_id;

  INSERT INTO "idempotency_records" (
    "id", "actor_id", "operation", "key_hash", "request_fingerprint", "status",
    "response_status", "response_body", "expires_at", "updated_at"
  ) VALUES
    ('30000000-0000-4000-8000-000000000001', employee_id, 'CREATE_TIME_PUNCH', repeat('1', 64), repeat('f', 64), 'COMPLETED', 201, '{}'::jsonb, clock_timestamp() + interval '1 day', clock_timestamp()),
    ('30000000-0000-4000-8000-000000000002', employee_id, 'CREATE_TIME_PUNCH', repeat('2', 64), repeat('f', 64), 'COMPLETED', 201, '{}'::jsonb, clock_timestamp() + interval '1 day', clock_timestamp()),
    ('30000000-0000-4000-8000-000000000003', employee_id, 'CREATE_TIME_PUNCH', repeat('3', 64), repeat('f', 64), 'COMPLETED', 201, '{}'::jsonb, clock_timestamp() + interval '1 day', clock_timestamp()),
    ('30000000-0000-4000-8000-000000000004', employee_id, 'CREATE_TIME_PUNCH', repeat('4', 64), repeat('f', 64), 'COMPLETED', 201, '{}'::jsonb, clock_timestamp() + interval '1 day', clock_timestamp()),
    ('30000000-0000-4000-8000-000000000005', admin_id, 'ADJUST_TIME_PUNCH', repeat('5', 64), repeat('f', 64), 'COMPLETED', 201, '{}'::jsonb, clock_timestamp() + interval '1 day', clock_timestamp()),
    ('30000000-0000-4000-8000-000000000006', admin_id, 'ADJUST_TIME_PUNCH', repeat('6', 64), repeat('f', 64), 'COMPLETED', 201, '{}'::jsonb, clock_timestamp() + interval '1 day', clock_timestamp()),
    ('30000000-0000-4000-8000-000000000007', admin_id, 'ADJUST_TIME_PUNCH', repeat('7', 64), repeat('f', 64), 'COMPLETED', 201, '{}'::jsonb, clock_timestamp() + interval '1 day', clock_timestamp());

  INSERT INTO "time_punches" (
    "id", "employee_id", "occurred_at", "kind", "origin", "idempotency_record_id"
  ) VALUES
    (first_punch_id, employee_id, TIMESTAMPTZ '2026-08-14 08:00:00-03', 'CLOCK_IN', 'EMPLOYEE', '30000000-0000-4000-8000-000000000001'),
    (second_punch_id, employee_id, TIMESTAMPTZ '2026-08-14 12:00:00-03', 'CLOCK_OUT', 'EMPLOYEE', '30000000-0000-4000-8000-000000000002'),
    (third_punch_id, employee_id, TIMESTAMPTZ '2026-08-14 13:00:00-03', 'CLOCK_IN', 'EMPLOYEE', '30000000-0000-4000-8000-000000000003'),
    (fourth_punch_id, employee_id, TIMESTAMPTZ '2026-08-14 17:00:00-03', 'CLOCK_OUT', 'EMPLOYEE', '30000000-0000-4000-8000-000000000004');

  INSERT INTO "time_adjustments" (
    "id", "time_punch_id", "sequence", "previous_occurred_at", "corrected_occurred_at",
    "reason", "admin_id", "idempotency_record_id"
  ) VALUES (
    '40000000-0000-4000-8000-000000000001', third_punch_id, 1,
    TIMESTAMPTZ '2026-08-14 13:00:00-03', TIMESTAMPTZ '2026-08-14 13:15:00-03',
    'Validação de correção', admin_id, '30000000-0000-4000-8000-000000000005'
  );

  INSERT INTO "time_adjustments" (
    "id", "time_punch_id", "sequence", "previous_occurred_at", "corrected_occurred_at",
    "reason", "admin_id", "idempotency_record_id"
  ) VALUES (
    '40000000-0000-4000-8000-000000000002', third_punch_id, 2,
    TIMESTAMPTZ '2026-08-14 13:15:00-03', TIMESTAMPTZ '2026-08-14 13:30:00-03',
    'Validação de segunda correção', admin_id, '30000000-0000-4000-8000-000000000006'
  );

  BEGIN
    INSERT INTO "time_adjustments" (
      "id", "time_punch_id", "sequence", "previous_occurred_at", "corrected_occurred_at",
      "reason", "admin_id", "idempotency_record_id"
    ) VALUES (
      '40000000-0000-4000-8000-000000000003', third_punch_id, 3,
      TIMESTAMPTZ '2026-08-14 13:30:00-03', TIMESTAMPTZ '2026-08-14 18:00:00-03',
      'Correção inválida', admin_id, '30000000-0000-4000-8000-000000000007'
    );
    RAISE EXCEPTION 'adjustment neighbor constraint did not reject crossing';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  BEGIN
    UPDATE "time_punches"
    SET "occurred_at" = TIMESTAMPTZ '2026-08-14 08:01:00-03'
    WHERE "id" = first_punch_id;
    RAISE EXCEPTION 'time punch immutability trigger did not reject mutation';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;
END;
$$;

SET CONSTRAINTS ALL IMMEDIATE;

ROLLBACK;
