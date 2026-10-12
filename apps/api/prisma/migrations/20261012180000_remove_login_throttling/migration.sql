-- Login lockout ("Muitas tentativas") was removed at the owner's request; its counters
-- are no longer used. Failed logins are still recorded in audit_logs.
DROP TABLE IF EXISTS "login_throttles";
