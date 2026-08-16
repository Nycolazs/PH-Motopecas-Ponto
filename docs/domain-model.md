# PH-Ponto Domain and Data Model

## Identity

`User` owns a case-insensitive unique login, Argon2id password hash, role (`ADMIN` or `EMPLOYEE`), active flag, display name, timestamps, and optional avatar relation. Employee-only and admin-only lifecycle operations are exposed by separate application modules even though authentication is unified. Disabling the final active admin is forbidden transactionally.

`RefreshSession` stores a token-family identifier, hashed current token, user, expiry, revocation/reuse metadata, and bounded device context. Raw refresh tokens never enter PostgreSQL.

## Schedules

`BusinessScheduleVersion` represents an effective-dated configuration. Each version owns exactly seven `BusinessScheduleDay` rows with open/closed, opening/closing local minutes, lunch enabled, and optional lunch boundaries. Versions do not overwrite one another.

Expected minutes are derived from opening-to-closing time minus lunch duration. Closed days yield zero. Validation rejects inverted bounds, lunch outside business hours, zero/negative lunch, and partially populated intervals.

`CalendarException` is a stable parent unique by business date. It owns append-only `CalendarExceptionRevision` rows with a monotonic sequence and operation `UPSERT` or `RETRACT`. An upsert revision has kind `HOLIDAY`, `CLOSED`, or `SPECIAL_HOURS`; closed kinds yield zero expected minutes and special hours carry validated local opening/closing times and optional lunch bounds. The highest-sequence revision is authoritative: `RETRACT` means no exception and falls back to the weekly schedule, never to an older revision.

Schedule selection is the immutable version with greatest `effectiveDate <= businessDate`; effective dates are unique. Seed must provide the baseline version, so “no prior version” is a configuration error. Versions are never edited/deleted; changes create a new version. Exception revisions record admin/audit identity. The latest revision is current business truth, so a deliberate historical upsert/retraction may recalculate a report while preserving every prior revision and audit event.

## Punches and adjustments

`TimePunch` is immutable and records employee, authoritative UTC instant, alternating kind, origin (`EMPLOYEE` or `ADMIN_INSERTION`), creator when administrative, idempotency reference, and creation timestamp.

`TimeAdjustment` is append-only and targets a punch. It records a monotonic per-punch sequence, prior effective instant, corrected instant, mandatory reason, admin, and creation timestamp. A unique `(punchId, sequence)` plus locked expected-current validation prevents branching. Effective reads use the highest sequence while audit/history shows every value. Corrections cannot equal/cross neighboring punches or change their `America/Sao_Paulo` business date; administrative insertion handles missing events.

An `IdempotencyRecord` is unique by actor, operation, and key. It stores a request fingerprint, lifecycle, bounded response, and expiry. Reusing a key with a different request is a conflict.

## Attendance calculation

For a business date:

1. Resolve its schedule version and override exception.
2. Select punches whose effective local instant belongs to the date. Overnight schedules are unsupported; an accidental cross-midnight pair yields incomplete days and requires admin correction.
3. Sort by effective instant and require alternating IN/OUT chronology.
4. Sum complete-pair elapsed UTC milliseconds and floor the aggregate once to integer worked minutes. Expected duration uses local schedule minutes.
5. Mark an odd count `INCOMPLETE`; do not invent a missing exit or final balance.
6. Otherwise calculate `balanceMinutes = workedMinutes - expectedMinutes`.

The attendance application service supplies an authoritative `evaluationInstant`; the pure calculator receives explicit `isFinalized`. A business date is finalized only when it is earlier than the evaluation instant's `America/Sao_Paulo` date. The current date remains provisional even after scheduled closing because legitimate overtime punches may follow; future dates are not summarized.

For finalized dates, an open day with zero punches has zero worked minutes, a negative expected balance, and `MISSING_HOURS`. Primary finalized status precedence is `INCOMPLETE`, then the calendar label (`HOLIDAY`, `CLOSED`, `DAY_OFF`), then balance (`OVERTIME`, `MISSING_HOURS`, `NORMAL`). Complete punches on a calendar-closed date can therefore show worked/overtime totals while retaining its calendar status. Special hours uses its balance status.

Provisional summaries return `isFinalized: false` and a work state: `NOT_STARTED`, `WORKING` (odd punch count), or `OFF_DUTY` (nonzero even count). Zero punches never show a provisional missing-hours status. An odd provisional sequence is active work rather than `INCOMPLETE`. Even provisional sequences may expose worked, expected, and a clearly provisional balance/status. Calendar labels remain visible while their worked totals are provisional.

Malformed stored chronology (wrong first kind, repeated kind, equal/reordered instants) is an integrity error, not silently repaired. Creation and correction commands prevent it; reads expose `INCOMPLETE` with an integrity flag until administrative resolution. Historical ambiguous/nonexistent local correction times are rejected unless the request provides an explicit ISO offset that maps to the selected business zone/date.

Incomplete days may display worked minutes from completed pairs and their expected minutes, but have `balanceMinutes = null`. Period balance/expected/worked totals include complete finalized days only and expose `incompleteDayCount` plus `knownPartialWorkedMinutes` separately so partial days cannot produce a misleading balance.

Statuses are derived, not persisted as mutable truth: `NORMAL`, `OVERTIME`, `MISSING_HOURS`, `INCOMPLETE`, `HOLIDAY`, `DAY_OFF`, or `CLOSED`.

## Audit and settings

`AuditLog` is append-only and stores actor, action, target type/id, request metadata, safe allowlisted before/after context, and server timestamp. Security-sensitive administrative mutations must roll back if their audit event cannot persist. Authentication events use a dedicated best-effort path that cannot block safe rejection but never contains credential/token material.

`AppSetting` stores only bounded non-secret configuration. Secrets remain environment-managed.

## Storage and indexes

Use UUID primary keys and `timestamptz` for instants. Store local schedule clock values as integer minutes from midnight and business dates as PostgreSQL `date`. Add indexes for user normalized login, punches by employee/instant, adjustments by punch/creation, exceptions by date, schedule effective date, refresh token family/user, audit time/actor/target, and idempotency expiry.

Avatar metadata stores generated object keys, canonical MIME, byte size, pixel dimensions, and checksum. The storage adapter owns bytes under a fixed root or future object store; database paths never come from user input.
