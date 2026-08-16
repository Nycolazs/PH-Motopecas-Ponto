# PH-Ponto Architecture

## System context

PH-Ponto is an internal attendance system composed of a Windows-first Electron client, a NestJS REST API, PostgreSQL, and persistent avatar storage. The client never connects directly to PostgreSQL or the upload filesystem. The API is authoritative for identity, authorization, timestamps, schedules, attendance calculations, reports, and audit events.

```text
Electron main ── secure preload bridge ── React renderer
                                           │ HTTPS/JSON
                                           ▼
                                      NestJS REST API
                                      │             │
                                      ▼             ▼
                                  PostgreSQL   Avatar storage
```

## Monorepo boundaries

```text
apps/api        NestJS adapters, application services, Prisma access, OpenAPI
apps/desktop    Electron main/preload and React renderer
packages/shared Pure attendance rules, shared contracts, Zod schemas, utilities
docs            Architecture, operations, and decisions
reference       Approved source assets and non-code references
```

`packages/shared` must remain runtime-portable: it cannot import NestJS, Electron, Prisma, React, browser globals, or Node-only storage APIs. The API may import it for calculation and contract validation. The renderer may import safe schemas and presentation utilities but treats API totals as authoritative.

## Backend modules

- `auth`: login, access JWTs, rotating refresh sessions, logout, throttling.
- `users`, `employees`, `admins`: identity and role-specific lifecycle rules.
- `avatars`: validation, image normalization, storage abstraction, protected delivery.
- `schedules`, `business-hours`: schedule versions and weekday definitions.
- `calendar-exceptions`: holiday, closed, and special-hours overrides.
- `time-punches`: server-time punches, alternation, idempotency, employee access.
- `time-adjustments`: append-only corrections and administrative insertions.
- `attendance`: daily/period orchestration over the pure domain package.
- `reports`: authorized queries plus CSV/PDF renderers.
- `audit`: append-only security and administrative events.
- `settings`: bounded application settings.
- `health`: liveness and dependency readiness.

Controllers validate transport data and call focused application services. Application services enforce permissions and transactions. Repositories isolate Prisma queries. Pure rules live in shared functions.

## Authentication and trust boundaries

- Access tokens are short-lived bearer JWTs held in renderer memory.
- Refresh tokens rotate on every use. Only their hashes are stored; reuse revokes the token family.
- Electron main performs login/refresh/logout, encrypts the rotating refresh credential with `safeStorage`, and persists only ciphertext in a private `userData` file. Unsupported/insecure storage falls back to memory-only authentication. Refresh is single-flight so concurrent renderer 401s cannot replay one rotating token, and preload exposes only four purpose-specific auth methods.
- Authorization is enforced in the API with role and ownership predicates. UI gating is usability only.
- Login throttling combines IP and normalized login identifiers without logging credentials.

## Attendance flow

`POST /time-punches` accepts no employee ID, instant, business date, or punch kind. It requires an `Idempotency-Key` UUID. Administrative insertion and correction endpoints require the same header. Every chronology mutation follows one lock order: idempotency advisory lock, active actor row, subject employee row, subject employee-stream advisory lock, then target punch/adjustment rows.

A database transaction:

1. Derives and locks the authenticated employee row and rechecks active status.
2. Acquires a transaction-scoped PostgreSQL advisory lock for `(actorId, operation, key)`, then reads the idempotency record. A mismatched fingerprint returns `IDEMPOTENCY_KEY_REUSED`; a matching committed record replays it.
3. Serializes that employee's punch stream with a row/advisory lock so different keys cannot race.
4. Captures one instant from an injectable server clock, forces the PostgreSQL client session to UTC, persists UTC `timestamptz`, and derives the business date only in `America/Sao_Paulo`.
5. Rejects another employee-origin punch inside the 30-second accidental-duplicate window, then derives the next alternating kind.
6. Inserts the immutable punch and completed bounded idempotent response atomically. A same-key replay returns the stored status/body and creates no second record.

The idempotency state machine has one committed terminal state, `COMPLETED`. The transient claim exists only inside the database transaction: a rollback removes it, so stale claim recovery is unnecessary. A concurrent caller waits on the advisory lock up to a bounded database timeout, then either observes `COMPLETED` or receives `IDEMPOTENCY_BUSY`. Only successful mutation responses are stored; deterministic validation failures may be retried after state changes. Records expire through a separate cleanup job after the documented replay window, never during an active transaction.

Normal employee punches carry immutable provenance but do not create a separate `AuditLog` row. Administrative insertion is owned by `time-punches` and must atomically create the inserted punch, completed idempotent response, and audit event while holding the same employee-stream lock. Corrections are owned by `time-adjustments` and atomically append an adjustment, completed idempotent response, and audit event under that same stream lock.

The desktop creates one key per deliberate action and reuses it after an unknown network outcome. It never displays success without an acknowledged API response. Replay still requires valid authentication and a currently active actor; a user deactivated after an unknown outcome receives `USER_INACTIVE` and an admin can verify the stored punch.

Successful create/replay responses use HTTP 201 and `Idempotency-Replayed: true` on replay. Employee punching returns `{ punch, dailySummary, idempotencyKey }`; correction/insertion returns `{ punch, dailySummary, auditEventId, idempotencyKey }`. Stable errors include `VALIDATION_ERROR` (400), `USER_INACTIVE`/`FORBIDDEN` (403), ownership-safe `RESOURCE_NOT_FOUND` (404), and `IDEMPOTENCY_KEY_REUSED`, `IDEMPOTENCY_BUSY`, `DUPLICATE_PUNCH_WINDOW`, `PUNCH_CHRONOLOGY_CONFLICT`, or `STALE_ADJUSTMENT_VERSION` (409).

The database prevents update/delete of punches, adjustments, and audit rows through the application role. A correction locks the punch and adjustment chain, supplies the expected current version/value, receives the next monotonic sequence, and is rejected if it equals/crosses a neighboring punch or moves to another `America/Sao_Paulo` business date. This preserves stored kind order. Reports resolve daily summaries from committed authoritative data.

Required integration coverage includes simultaneous same/different-key punches, same-key mismatch, duplicate-window attempts, unknown-outcome replay, rollback, inactive/ownership cases, audit deduplication, correction concurrency/reordering, immutability, and midnight/time-zone boundaries.

Corrections never update a punch. A correction appends an adjustment linked to the original punch or prior effective value. An administrative insertion is a punch with explicit origin and audit provenance.

## Errors and observability

The API returns a stable problem shape with `status`, `code`, safe `message`, optional field `details`, `requestId`, and `timestamp`. User-safe messages are `pt-BR`; internal logs remain technical English and redact secrets. Health readiness checks PostgreSQL and required storage access without exposing connection details.

## Deployment environments

- Local macOS: PostgreSQL and API may run through Docker Compose; Electron/Vite runs on the host for fast reload.
- CI Linux: lint, typecheck, units, integration with PostgreSQL, renderer tests, and builds.
- Windows CI: package the x64 per-user NSIS installer and upload `PH-Ponto-Setup-x.y.z.exe`.
- Production: API and PostgreSQL use explicit migrations, persistent database/uploads volumes, health checks, and validated secrets.

Production places the API behind TLS, uses an explicit CORS allowlist and trusted-proxy count, disables or protects Swagger, applies security headers, and keeps PostgreSQL off public networks under a least-privilege application role. Authentication uses bearer headers rather than ambient cookies, so CSRF is not the primary control; origin restrictions and XSS/Electron isolation remain mandatory.

The packaged renderer uses the registered privileged standard/secure scheme and exact origin `ph-ponto://app`. Development permits only the configured Vite origin, normally `http://localhost:5173`. The API CORS allowlist contains those explicit origins per environment and always rejects missing/`null` origins for browser-style renderer requests; non-browser health and operational clients authenticate through their separate intended path.

See `docs/security-model.md` for the actor/resource authorization matrix, token lifecycle, Electron contract, uploads, exports, and release security gates.
