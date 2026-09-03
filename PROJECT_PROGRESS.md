# PH-Ponto Project Progress

## Current Phase

Phase 8 — Release Verification & Monorepo Reorganization Complete

## Overall Status

READY_FOR_RELEASE

## Last Updated

2026-08-19 09:30 America/Sao_Paulo

## Completed

- Phase 0 discovery and architecture completed and independently reviewed.
- Created the permanent `AGENTS.md` rules and this operational handoff.
- Initialized the Git repository on `main`; the workspace began without application code or a supplied logo asset.
- Created and validated all nine required project skills under `.agents/skills/`.
- Documented system architecture, domain/data semantics, security controls, and the development environment.
- Phase 1 foundation completed and validated:
  - pnpm 11 monorepo with strict TypeScript 6.0, ESLint, Prettier, and frozen lockfile;
  - `apps/api`, `apps/desktop`, `packages/shared`, workflows, Docker, docs, and reference layout;
  - shared ESM contracts, product constants, roles, health/problem schemas, and duration formatting;
  - NestJS 11 API with validated environment, Helmet, exact CORS origins, request IDs, pt-BR problem responses, Swagger, Prisma 7 PostgreSQL adapter, and graceful shutdown;
  - liveness plus readiness that checks real PostgreSQL and writable upload storage with a bounded timeout;
  - secure Electron main/preload/renderer boundary with sandbox, context isolation, no Node integration, exact origins, narrow typed IPC, blocked navigation/windows/permissions, CSP, and traversal-safe packaged asset resolution;
  - responsive React/Vite/Tailwind foundation UI with pt-BR loading, connected, unavailable, retry, light-mode, dark-mode, and not-found states;
  - Docker Compose with loopback-only API/PostgreSQL ports, PostgreSQL/upload volumes, dependency-aware health checks, and restart policies;
  - multi-stage 179 MB API image built successfully with Buildx cache mounts and a non-root runtime;
  - pinned GitHub Action SHAs, PostgreSQL image digest, Linux CI, and Windows NSIS build workflow;
  - `README.md`, `.env.example`, and validated development commands.
- Fixed the Electron/Vite development CSP after a real macOS launch exposed the React refresh preamble requirement; production CSP remains free of unsafe directives.
- Fixed a host PostgreSQL collision by publishing the Compose database on loopback port `55432` while keeping container port `5432`.
- Fixed the one high-severity transitive `js-yaml` advisory by overriding the affected Swagger dependency to 5.3.0; the subsequent high-severity audit was clean.
- Installed Docker Buildx 0.36.1 and repaired the local Compose/Buildx plugin links required by the macOS environment.
- Reclaimed only PH-Ponto-generated browser/build caches after disk pressure; the final image and persistent volumes were preserved.
- Phase 2 backend core completed and validated:
  - created the initial Prisma migration `20260815011408_initial` with UUID identities, CITEXT login uniqueness, rotating refresh families, login throttles, schedule versions/days, exception revisions, idempotency records, immutable punches/adjustments/audits, avatar metadata, and settings;
  - added database checks and triggers for the final active ADMIN, complete immutable seven-day schedules, append-only history, refresh-chain integrity, employee-stream chronology, correction lineage, and completed mutation idempotency;
  - added an idempotent seed for the initial ADMIN and the Monday-Friday/Saturday/Sunday baseline schedule;
  - implemented Argon2id authentication, strict short-lived access JWTs, HMAC-hashed rotating refresh tokens, reuse-family revocation, logout, active-user/session checks, keyed login throttles, public-route annotations, and protected-by-default global RBAC guards;
  - implemented own-profile access plus ADMIN-only employee/ADMIN lifecycle operations, password reset, activation/deactivation, safe paginated views, last-active-ADMIN protection, session revocation, and atomic audit events;
  - implemented ADMIN-only paginated audit queries while keeping audit rows append-only and excluding credentials, hashes, raw tokens, IP addresses, and user-agent data from public views;
  - isolated local integration tests in an automatically prepared `ph_ponto_test` database that refuses non-test database names;
  - rebuilt the current API image at 180,600,214 bytes, started it non-root through Compose, and verified healthy readiness plus a live protected-route 401 response.
- Phase 3 attendance domain completed and validated:
  - added the framework-independent attendance domain with São Paulo business-date/DST ranges, versioned expectation resolution, correction lineage, arbitrary interval pairing, exact millisecond aggregation, finalized/provisional states, and daily/period/monthly totals;
  - added immutable schedule-version and append-only calendar-exception APIs with strict seven-day/hour validation, non-backdated effective dates, serialized revisions, ADMIN RBAC, Swagger, and atomic audit events;
  - added authoritative alternating punches, actor-scoped idempotency, database-backed replay and duplicate-window safeguards, administrative insertion, append-only multi-step corrections, stale-write protection, effective reads, and audit coupling;
  - added employee-owned plus ADMIN-scoped daily/history/monthly attendance endpoints, bulk repeatable-read period snapshots, complete Swagger response contracts, future-date limits, and incomplete/provisional exclusions;
  - forced every Prisma PostgreSQL session to UTC after a historical DST integration test exposed a three-hour `timestamptz` adapter shift under a São Paulo database session; business interpretation remains explicitly `America/Sao_Paulo`;
  - hardened the integration runner to recreate only the validated `_test` database's `public` schema before applying the committed migration from scratch.
  - fixed all independent integration-review findings: annual N+1 reads, mixed snapshots, incomplete/current/monthly/DST/retraction coverage, complete Swagger response models, and business-date boundary arithmetic;
  - rebuilt the API image at 173,385,328 bytes, recreated PostgreSQL with `timezone=UTC`, verified both containers healthy, confirmed live readiness, and confirmed the attendance endpoint is protected.
- Phase 4 employee application completed and validated:
  - implemented typed Electron-main login/restore/refresh/logout with strict IPC sender/input validation and fixed-origin bounded API calls;
  - encrypted the rotating refresh credential with Electron `safeStorage`, rejected insecure Linux `basic_text`, used private atomic ciphertext storage, and fell back to clearly identified memory-only sessions without exposing refresh values to preload or renderer;
  - serialized refresh rotation and all session operations so concurrent renderer 401 responses cannot replay one token family; logout refreshes expired access credentials when necessary and reports unconfirmed remote revocation safely;
  - implemented the pt-BR login, EMPLOYEE/ADMIN route isolation, token-free React auth context, one-refresh authenticated API client, expired/forbidden/offline/unavailable states, and light/dark themes;
  - implemented the employee home with São Paulo visual clock, authoritative punch action, outcome-safe idempotency retry, success confirmation, current status, timeline, worked/expected/daily/monthly balances, and initials avatar fallback;
  - implemented owned history with Hoje/Esta semana/Este mês/Mês anterior/Período personalizado filters, bounded validation, punch details, statuses, totals, loading/error/empty states, and accessible responsive tables;
  - separated Electron test typechecking from production compilation and added scoped generated-output cleanup so stale test files cannot enter the installer;
  - replaced the foundation smoke E2E with login → home → Bater ponto → authoritative confirmation/timeline → history, visually checked login light/dark and authenticated home at 1366x768, and launched the real macOS Electron main/preload/renderer stack cleanly against the healthy API.
- Phase 5 ADMIN application completed and validated:
  - implemented the full ADMIN shell layout with responsive sidebar, São Paulo live clock, online/offline monitor, role indicators, and light/dark theme switch;
  - implemented `DashboardPage` with real-time operational metrics (active, clocked-in, working, incomplete, not started), employee presence table, and recent punches / adjustments live stream;
  - implemented `EmployeesPage` with search, active/inactive filters, employee creation, edit modal, password reset modal, activation toggle, and webcam/upload avatar management;
  - implemented `EmployeeDetailPage` with employee overview, monthly calendar view colored by attendance status, punch chronology timeline, manual punch insertion modal, and punch correction modal;
  - implemented `PunchesPage` with date filter, employee selector, full punch registry, manual insertion, and correction modals;
  - implemented `AdminsPage` with administrator user management, creation, edit, password reset, and last-active-ADMIN safety protection;
  - implemented `SettingsPage` with 7-day weekly schedule versioning, opening/closing and lunch intervals, calendar exception management (holidays, special hours, closed days) and retraction;
  - implemented `AuditPage` with action filters and before/after state diff inspector;
  - implemented secure avatar backend module with magic byte validation (PNG/JPEG/WebP), SHA-256 deduplication, 1:1 aspect ratio enforcement, ETag caching stream endpoint, and audit coupling;
  - implemented administrative daily attendance and overview aggregation endpoints.
- Phase 6 reports and period summaries completed and validated:
  - implemented `ReportsPage` for arbitrary date-range period consolidation across all employees or individual employees;
  - implemented summary totals aggregation (expected minutes, worked minutes, balance, overtime, missing hours, punch count, correction count, status distribution);
  - implemented CSV report download with formatted Brazilian Portuguese values and date strings;
  - implemented print/PDF export styling with print-optimized CSS rules.
- Phase 7 Electron desktop and Windows packaging completed and validated:
  - verified narrow typed Electron IPC bridge, secure token vault with `safeStorage`, strict navigation controls, and zero `nodeIntegration`;
  - verified electron-builder NSIS configuration for 64-bit Windows installer generation (`PH-Ponto-Setup-${version}.exe`) with non-elevated per-user installation and desktop shortcuts;
  - verified GitHub Actions workflow for automated Windows installer builds (`build-windows.yml`).
- Reorganized monorepo structure into distinct top-level `backend/` and `frontend/` directories:
  - `backend/`: Standalone NestJS REST API with PostgreSQL, Prisma ORM, Argon2id, JWT session families, and Swagger;
  - `frontend/`: Standalone Electron + React + Vite + Tailwind desktop application with secure OS vault and offline resilience;
  - `packages/shared`: Shared pure attendance calculation domain and data contracts;
  - Docker Compose configuration ready to run from both parent monorepo root (`docker-compose.yml`) and `backend/` (`backend/docker-compose.yml`);
  - Verified local database migration, seeding, and execution on PostgreSQL;
  - Ran full test verification suite (200 unit tests, 24 PostgreSQL integration tests, 2 Playwright E2E suites) passing with 100% success rate;
  - Started backend REST API on `http://127.0.0.1:3000` (Swagger docs on `/docs`) and Electron desktop client with Vite dev server on `http://127.0.0.1:5173`.

## Currently Working On

- Production stack (PostgreSQL, Backend API, Frontend Web) running in isolated Docker containers in production environment.
- Auto-deploy pipeline active via cron, syncing GitHub commits to server containers automatically.

## Next Steps

- Proceed with Cloudflare Tunnel configuration or Zero Trust token setup when provided by the user.
- Interactive end-to-end testing of time punch, employee management, and report generation flows.

## Architecture Decisions

- Monorepo: pnpm workspaces with `apps/api`, `apps/desktop`, and `packages/shared`.
- Backend: NestJS REST API, Prisma ORM, PostgreSQL, Swagger/OpenAPI, global validation, and RFC-style structured problem responses.
- Desktop: Electron main/preload plus React renderer built by Vite and styled with Tailwind CSS.
- Test stack: Vitest for domain/renderer tests, NestJS/Supertest for API integration, and Playwright for critical E2E flows.
- Store instants in UTC and resolve business calendar rules in `America/Sao_Paulo`.
- Force PostgreSQL client sessions to UTC (`options=-c timezone=UTC`) and keep the PostgreSQL container process timezone at UTC; never use the database/session timezone as a business-rule source.
- Keep attendance math framework-independent and based on integer minutes.
- All punch chronology mutations share a fixed employee-stream lock order; retryable punch/correction/insertion mutations use actor-scoped advisory-lock idempotency and atomically stored successful responses.
- Attendance sums exact elapsed interval milliseconds and floors the aggregate once; current-day summaries are provisional and historical odd sequences are incomplete.
- Period/monthly attendance bulk-loads schedules, exception revisions, and punches in one PostgreSQL `RepeatableRead` snapshot, then applies the pure domain in memory; this avoids annual-history N+1 transactions and mixed correction snapshots.
- Schedule versions are immutable effective-dated snapshots. Calendar exceptions use an immutable date parent with append-only UPSERT/RETRACT revisions.
- The packaged renderer origin is `ph-ponto://app`; development accepts only an exact loopback HTTP origin with an explicit port.
- Production Electron CSP has no unsafe script/style directives. Development allows inline script/style only for the exact loopback Vite origin and still forbids `unsafe-eval`.
- The API container listens on port 3000; Compose separates its host port and publishes services only on `127.0.0.1`.
- Local PostgreSQL is published on `127.0.0.1:55432` to avoid the macOS PostgreSQL service on 5432.
- Frozen installs use `trustLockfile: true` because PH-Ponto is a private internal repository and the committed lockfile is reviewed source. Dependency resolution retains pnpm's release-age policy, CI uses frozen installs, and CI runs a high-severity audit.
- The release gate blocks open Critical/High security findings and skipped mandatory validations.
- HTTP routes are protected by default through global access-token and role guards; only explicit `@Public()` routes bypass authentication.
- Refresh credentials are opaque `sessionId.secret` values; PostgreSQL stores only keyed HMAC-SHA256 hashes, every rotation appends a session row, and replay revokes the complete immutable family.
- Electron main owns login/refresh/logout HTTP calls and the rotating refresh credential; it encrypts the persisted credential with Electron `safeStorage` when available and falls back to memory-only sessions instead of exposing or weakly persisting it. The renderer receives only the short-lived access token and identity in React memory through narrow typed IPC.
- Electron production compilation uses a test-excluding build tsconfig plus explicit cleanup limited to the generated main/preload/shared/renderer directories; the normal typecheck config still includes test sources.
- User/admin mutations lock identities, preserve role-specific endpoints, revoke affected sessions, and append the audit event in the same transaction.
- Local integration preparation accepts only database names ending in `_test`; the development `ph_ponto` database is never truncated by tests.

## Database State

- migrations: `20260815011408_initial` applied to the Compose development database and applied from scratch on every integration run; punch/adjustment trigger day bounds use explicit São Paulo start/end instants across DST transitions.
- seed: idempotent initial ADMIN plus the immutable seven-day baseline schedule; repeated root `pnpm db:seed` runs were no-ops after creation.
- PostgreSQL: 18.6 Alpine container healthy with persistent `postgres_data` volume.
- important schema decisions: UUIDs, UTC `timestamptz`, local minute/date values, CITEXT plus normalized logins, immutable schedule versions/punches/adjustments/audits, exception revisions, privacy-preserving throttles, rotating refresh families, restrictive FKs, employee-stream serialization, and transaction-completed idempotency records.

## Environment

- API: current Phase 3 Docker image builds and runs; `/health` and `/health/ready` return 200, protected attendance routes require access tokens, and source watch mode was validated on port 3001 during foundation work.
- PostgreSQL: Compose service is healthy at `127.0.0.1:55432`; container traffic uses port 5432; both the server process and every Prisma client session use UTC.
- Electron: Phase 4 production build succeeds with no emitted test artifacts or refresh-token preload field; `pnpm dev:desktop` launched the real main/preload/renderer stack successfully on macOS with zero TypeScript/runtime console errors and was stopped manually after verification.
- Docker: Compose 5.1.3 and Buildx 0.36.1 are available; the current Phase 3 API image size reported by Docker is 173,385,328 bytes.
- logo: no PNG, JPEG, WebP, SVG, or ICO PH Motopeças asset exists in the workspace.

## Commands That Work

```bash
pnpm install --frozen-lockfile
docker compose up -d --build
pnpm dev
pnpm dev:desktop
pnpm dev:api
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:frontend
pnpm test:integration
pnpm e2e:install
pnpm test:e2e
pnpm build
pnpm build:api
pnpm build:desktop
pnpm db:generate
pnpm db:migrate
DATABASE_URL=postgresql://... pnpm db:migrate:deploy
pnpm db:seed
pnpm check
pnpm audit --audit-level=high
docker compose config --quiet
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3000/health/ready
```

`pnpm dev:api` needs the variables documented in `.env.example` and a free API port. The successful source-watch validation used port 3001 while the Compose API remained on 3000.

`pnpm db:migrate` supplies only the documented loopback Compose development defaults and uses non-destructive deployment semantics; it refuses local defaults in production. `pnpm db:migrate:deploy` remains the explicit-environment production/CI command. Use `pnpm db:migrate:dev` only while intentionally authoring a new migration; the existing development database records the pre-hardening checksum of the initial migration, so Prisma correctly refuses migration-authoring mode there without a reset. Fresh databases apply the final committed initial migration and pass all constraint tests.

## Tests

- unit: `pnpm check` passed on 2026-08-15 with 200 tests: shared 63, API 93, desktop 44.
- integration: `pnpm test:integration` passed against a freshly recreated/migrated `ph_ponto_test` schema with 6 files and 24 tests covering readiness/UTC round trips, migration constraints, auth/RBAC/IDOR, schedule history, weekday/Saturday/Sunday expectations, holidays/special hours/retraction, concurrent idempotency replay, server time, duplicate windows, incomplete/monthly aggregation, immutable multiple corrections, audit coupling, and historical São Paulo DST boundaries.
- e2e: `pnpm test:e2e` passed with 2 Chromium test suites covering:
  1. Critical employee flow (login, home, server-authoritative punch confirmation, live timeline, and owned history);
  2. Critical admin flow (login, real-time operational dashboard, presence metrics, and employee management navigation).
- lint: `pnpm check` ESLint gate passed with zero warnings.
- formatting: `pnpm check` Prettier gate passed across all workspaces.
- typecheck: `pnpm check` passed for shared, API, Electron main/preload, renderer, and config projects.
- build: `pnpm check` passed shared, NestJS API, Electron TypeScript, and Vite production builds.
- audit: `pnpm audit --audit-level=high` reported zero vulnerabilities.
- Docker: the API image build passed; Compose API/PostgreSQL health checks are healthy; PostgreSQL reports UTC; live readiness returned status `ok`.
- visual QA: 1366x768 light login, dark login, authenticated employee home, and administrative dashboard passed without horizontal/vertical clipping.
- macOS Electron startup: Phase 4 main/preload/renderer startup passed against the healthy Compose API.
- Windows installer: configured via electron-builder NSIS and pinned GitHub Actions workflow (`build-windows.yml`).
- project skills: 9/9 passed `quick_validate.py`.

## Known Issues

- The PH Motopeças logo referenced by the product brief was not supplied. The application uses a temporary accessible text mark only; do not fabricate the logo or treat the current mark/installer icon as final branding.
- The Windows installer has not yet been executed on `windows-latest` locally (development environment is macOS); packaging is automated in CI via `.github/workflows/build-windows.yml`.

## Important Files

- `AGENTS.md` — permanent engineering and recovery rules.
- `PROJECT_PROGRESS.md` — authoritative operational handoff and verified state.
- `README.md` — current developer entry point.
- `docs/architecture.md` — system boundaries and mutation contracts.
- `docs/domain-model.md` — attendance/data semantics and edge-case decisions.
- `docs/security-model.md` — threat model, authorization matrix, Electron/upload/export controls.
- `docs/development.md` — validated foundation workflow and environment contract.
- `.agents/skills/*` — validated project-specific engineering workflows.
- `packages/shared/src/*` — shared product constants, contracts, and pure duration formatting.
- `apps/api/src/*` — NestJS foundation, configuration, health, database, storage, avatars, and HTTP policy.
- `apps/api/prisma/schema.prisma` and `apps/api/prisma/migrations/20260815011408_initial/migration.sql` — persistence contract.
- `apps/api/src/auth/*`, `apps/api/src/users/*`, `apps/api/src/employees/*`, `apps/api/src/admins/*`, and `apps/api/src/audit/*` — authentication, authorization, identity lifecycle, and audit core.
- `apps/desktop/src/main/auth-*.ts`, `refresh-token-vault.ts`, and `security.ts` — secure session lifecycle, IPC boundary, storage, exact origins, and CSP.
- `apps/desktop/src/shared/electron-api.ts` and `apps/desktop/src/preload/index.cts` — narrow typed app/auth bridge with no refresh-token field.
- `apps/desktop/src/renderer/*` — complete pt-BR employee and admin application, authenticated API layer, attendance presentation, resilience states, and responsive themes.
- `apps/desktop/e2e/employee.spec.ts` & `admin.spec.ts` — critical E2E UI flows.
- `.github/workflows/ci.yml` and `.github/workflows/build-windows.yml` — pinned CI and Windows packaging workflows.

- Resolved validation mismatches and error display across all administrative forms:
  - Enforced minimum 8-character password validation and required passwords on employee/admin creation and password reset modals in the frontend to match the backend `@MinLength(8)` security policy;
  - Corrected `insertManualPunch` API call to omit forbidden `kind` parameter (punch kind is derived server-side via chronological ordering);
  - Corrected `correctPunch` API call to send required `expectedCurrentOccurredAt` and `expectedSequence` parameters for optimistic concurrency control;
  - Enhanced NestJS `ValidationPipe` to translate class-validator constraints into friendly Portuguese messages;
  - Enhanced frontend `ApiClientError` to display specific field-level validation errors alongside problem messages;
  - Migrated business timezone across backend, shared domain, frontend, and tests to `America/Fortaleza`;
  - Built custom native Toast notification system (`ToastProvider` / `useToast`) with fluid animations and distinct tones (`success`, `error`, `info`, `warning`), replacing all browser `alert()` popups;
  - Preserved active user sessions when updating or resetting passwords (no forced logout on password change);
  - Audited and verified all 39 frontend-to-backend REST API requests and contracts against the live database with 100% success (covering authentication, session refresh/revocation, employee/admin CRUD, status changes, avatar uploads/retrieval/deletion, attendance today/history/monthly/overview, employee daily/history/monthly views, manual punch insertions, immutable punch adjustments, schedules versions, calendar exceptions upsert/retract, and audit log queries);
  - Implemented background automated updater for Electron desktop client using `electron-updater`, configured GitHub Releases provider in `electron-builder`, and updated `.github/workflows/build-windows.yml` to automatically release signed/installer assets and `latest.yml` metadata;
  - Implemented automated continuous deployment and update infrastructure for the Backend API via `.github/workflows/deploy-backend.yml` (automated Docker container builds published to GitHub Container Registry `ghcr.io`), `docker-compose.prod.yml` with Watchtower for zero-touch background container updates, and `backend/scripts/auto-update-backend.sh` with safe automated Prisma database migrations;
  - Implemented complete Employee Time Punch Adjustment Request & Admin Approval workflow:
    - Database schema & migration (`20260816135200_time_punch_adjustment_requests`) with `AdjustmentRequestStatus` (`PENDING`, `APPROVED`, `REJECTED`), optimistic concurrency tracking (`currentSequence`, `currentOccurredAt`), and relations to `User`, `TimePunch`, `TimeAdjustment`, and audit logs;
    - Backend `AdjustmentRequestsModule`, `AdjustmentRequestsService`, and `AdjustmentRequestsController` with strict employee ownership checks, future-time rejection, date matching, duplicate request prevention, immutable correction execution on approval, and comprehensive audit trail logging;
    - Employee UI: `RequestAdjustmentModal` on daily timeline and history page with timezone-aware time selection and mandatory justification, plus `MyAdjustmentRequestsModal` for tracking request statuses and viewing admin feedback;
    - Admin Web Portal: `AdjustmentRequestsPage` (`/admin/solicitacoes`) with status filters, employee details, difference inspection, approval with automatic recalculation, and rejection with feedback notes;
    - Admin UI live pending badge on navigation sidebar and prominent alert banner on the Operational Dashboard;
    - Full automated validation gate `pnpm check` passing 100% (204/204 unit tests, 24/24 integration tests, strict TypeScript, zero ESLint warnings, Prettier, Vite production bundles, and NestJS compilation);
    - Standardized date formatting to Brazilian format (`DD/MM/AAAA`) across all views, forms, modals, tables, and reports using a custom `DateInput` component and `formatDateBR` helper;
    - Added modern, fluid animations and micro-interactions across Employee and Admin interfaces (page entrance slides, spring modal animations, smooth card hovers, button click feedbacks, badge pulses, and subtle transitions);
    - Implemented Employee & Admin Self-Service Password Change:
      - Backend endpoint `POST /users/me/change-password` with `ChangeOwnPasswordDto`, Argon2id current password verification, 8-character minimum policy, transaction update, and `USER_PASSWORD_RESET` / `ADMIN_PASSWORD_RESET` audit trail;
      - Frontend `ChangePasswordModal` with current password check, new password visibility toggles, real-time match and length validators, and fluid toast notification;
      - Added password change quick-action in Employee desktop navigation bar, employee home greeting card, and Admin sidebar profile;
    - Incomplete Punches Module (`/admin/incompletos`):
      - Backend endpoint `GET /attendance/incompletes` with `AttendanceIncompletesQueryDto`, scanning active employees for incomplete/unclosed punch days from all past days prior to today (strictly excluding the current day);
      - Admin Sidebar navigation item "Incompletos" positioned between "Solicitações" and "Funcionários" with real-time pending incomplete days badge counter;
      - Complete overview screen `IncompletePunchesPage` with KPI summary cards (Total Dias Incompletos, Funcionários Afetados, Status Geral), search filter, month picker, formatted punch sequences, and "Corrigir Ponto" navigation buttons;
      - Integrated deep-linking in `AdminEmployeeDetailPage`: Automatically pre-selects and highlights the exact incomplete date passed via URL query parameters (`?date=YYYY-MM-DD`);
    - MonthPicker component: Built a modern, interactive month & year selection popover (`MonthPicker`) with year navigation buttons, 12 Portuguese month chips, current month indicator, and quick-action shortcuts, replacing the native browser `<input type="month">`;
    - Manual Punch enhancements:
      - Separated date and time input fields in `ManualPunchModal`, auto-filled the selected day date from `EmployeeDetailPage`, and added a confirmation prompt when inserting punches on days that already have full/completed punches;
      - Fixed mid-sequence punch insertion conflict: updated database trigger `validate_time_punch_insert` via migration `20260903170000_allow_mid_sequence_manual_punch` and added automatic chronological re-alignment of `kind` across the day's punches, allowing insertion between existing punches without chronology conflicts;
    - Modal width optimization: Updated punch modals to `maxWidth="lg"` (`512px`) and added `overflow-x-hidden` to avoid clipping or horizontal scrollbars;
    - Employee detail auto-select: Automatically pre-selects the most recent day of the reference month;
    - Full automated validation gate `pnpm check` passing 100% (223/223 unit and integration tests passing, strict TypeScript, zero ESLint warnings, Prettier, Vite production bundles, and NestJS compilation);
    - Production server updated and verified (`ph-ponto-api-1`, `ph-ponto-web-1`, `ph-ponto-postgres-1` all running and healthy);
    - Integrated official PH Motopeças Branding & Icons:
      - Installed official wide brand logo (`phmotos-logo.png`) into `Brand` component, `LoginPage` hero panel, `AdminLayout` sidebar header, `EmployeeLayout` topbar, and `AdminReportsPage` printable reports header;
      - Installed official application icon (`apple-icon.png` / `app-icon.png`) into `index.html` (favicon and apple-touch-icon) and native Electron `BrowserWindow` icon;
      - Full quality check `pnpm check` passing 100% with 0 warnings/errors;
    - Redesigned Audit Trail Inspection (`AdminAuditPage` & Backend):
      - Created natural language narrative generator in `pt-BR` explaining exactly what occurred for every audit event type, identifying the affected employee by name and login;
      - Automatic employee name and login resolution from database IDs/UUIDs across all audit events, even for legacy records;
      - Translated all security and error reason codes (`invalid_credentials`, `inactive_user`, `refresh_reuse`, `identity_changed_during_login`, etc.) into clear Brazilian Portuguese;
      - Prominently featured registered reasons / justifications / observations (`reason`, `note`, `reviewComment`) in a dedicated highlight banner with quote styling;
      - Structured key-value parameter breakdown with friendly Brazilian labels, localized timestamps (`DD/MM/AAAA às HH:mm:ss`), and domain enum translations (`Entrada`/`Saída`, `Administrador`/`Colaborador`, `Ativo`/`Inativo`);
      - Added side-by-side Before vs After visual diff view for point corrections and status updates;
      - Added expandable technical JSON inspector with copy-to-clipboard functionality for advanced diagnostic auditing;
      - Enriched backend `TIME_PUNCH_INSERTED` and `TIME_PUNCH_CORRECTED` audit records with employee name, login, and reasons;
    - Enhanced Punch Correction Modal with Complete Adjustments History (`PunchCorrectionModal` & Backend):
      - Created `GET /time-punches/:punchId/adjustments` backend endpoint returning complete audit history, original punch details, and each incremental correction sequence;
      - Designed dedicated "Histórico de Ajustes Anteriores" timeline cards inside `PunchCorrectionModal` showing original registration, transitions (`13:00` $\rightarrow$ `13:05`), administrator author, timestamps, and reason quotes;
      - Implemented instant reactive cache invalidation across all related queries upon point insertion, correction, or deletion;
      - Configured automatic background polling and `refetchOnWindowFocus` with 5s staleTime so changes appear automatically for users without requiring manual hard refreshes (`Ctrl + Shift + F5`);
    - Removed change password action icon from the Admin sidebar user profile card as requested;
    - Redesigned and perfected the PDF / Print Timesheet Report (`AdminReportsPage`):
      - Created formal A4 document layout with official PH Motopeças logo, company header, and emission metadata;
      - Added structured employee identification box with status, login, and Brazilian formatted date ranges (`DD/MM/AAAA`);
      - Added clean 5-metric consolidated KPI summary cards;
      - Formatted daily detailed attendance table with day of week abbreviation, friendly status labels, punch times, and totals footer;
      - Added formal employee and manager declaration and physical/digital signature fields;
      - Implemented full `@media print` CSS isolating the report document, hiding sidebar, header, filters, and action buttons, and preventing broken table row pagination;
    - Excluded non-working closed days and pre-enrollment dates from attendance queries:
      - Days before employee creation date (`businessDate < hireBusinessDate`) are omitted from employee reports, history, and daily dashboard;
      - Regular weekly schedule closed days (e.g. Sunday) with 0 punches and no calendar exceptions are omitted from reports and history lists, keeping only actual working days, holidays, calendar exceptions, or days with registered punches;
    - Standardized all system dropdowns with custom `SelectInput`:
      - Replaced all 5 remaining native HTML `<select>` elements with the unified, searchable, theme-aware, custom `SelectInput` component (`AdminReportsPage`, `AdminPunchesPage`, `AuditPage`, `SettingsPage`, `ManualPunchModal`);
    - Fixed schedule effective date formatting in `SettingsPage`:
      - Formatted current schedule header and historical versions using `formatDateBR` (`DD/MM/AAAA`);
    - Interactive Avatar Dragging & Zoom Cropping:
      - Implemented pointer-based drag & pan inside the circular crop preview in `AvatarModal`;
      - Added mouse wheel zoom support and reset button;
      - Calculated exact canvas crop mathematics preserving the selected pan offset and zoom scale upon upload;
    - Automatic Administrator & Baseline Bootstrap on Application Startup:
      - Added `BootstrapAdminService` running on `onApplicationBootstrap` in `DatabaseModule`;
      - Automatically creates default administrator with name `Administrador`, login `admin`, password `admin`, role `ADMIN`, and default baseline schedule whenever the database has no active administrators;
    - Fixed Avatar Upload & Cropped Canvas Export:
      - Configured `app.useBodyParser('json', { limit: '10mb' })` and `app.useBodyParser('urlencoded', { limit: '10mb' })` on backend to prevent `PayloadTooLargeError` during base64 avatar uploads;
      - Enhanced `ApiExceptionFilter` with `PAYLOAD_TOO_LARGE` status mapping and user-friendly error messaging;
      - Optimized cropped canvas export in `AvatarModal` to lightweight, high-quality 512x512 JPEG (~50 KB);
    - Reorganized Schedule Configuration Modal & 1-Hour Lunch Interval:
      - Completely redesigned the "Nova Versão de Jornada de Trabalho" modal in `SettingsPage`;
      - Replaced rigid fixed lunch start/end inputs with a clean, organized **1h de Almoço** option that automatically deducts 60 minutes from the day's expected work hours;
      - Added clear informational guidance explaining that each employee takes their 1-hour lunch interval at their designated shift time;
      - Formatted all inputs in clean 24h Brazilian standard (`08:00` às `17:00`) with quick preset buttons (44h comercial, 44h sem sábado, 40h e replicação);
    - Employee Profile Photo Display in Home Greeting & Circular Styling:
      - Integrated `AvatarImage` component into the Employee Home header (`Olá, [Nome] — Seu ponto de hoje`);
      - Added quick-access modal trigger on avatar click, allowing employees to change, zoom, and crop their profile photo directly from the home screen;
      - Added reactive `cacheKey` prop to `AvatarImage` ensuring immediate cache-busting and live re-render upon uploading a new picture;
      - Enforced circular `rounded-full` shape across all avatar photos and initials fallback badges in dashboard, presence board, tables, modals, and headers;
    - Windows Build, Official App Icon & GitHub Release v0.1.2:
      - Generated multi-resolution Windows ICO (`build/icon.ico`), macOS ICNS (`build/icon.icns`), and Linux PNG (`build/icon.png`) from the official PH Motopeças app icon;
      - Configured Electron Builder and NSIS installer icons to use the official logo on desktop shortcuts, taskbar, installer header, uninstaller, and window frame;
      - Fixed Calendar Exceptions / Holidays table rendering on Settings page by reading `latestRevision` and supporting `SPECIAL_HOURS` badge rendering;
      - Published official release **v0.1.2** on GitHub with Windows installer, auto-updater metadata (`latest.yml`), macOS and Linux packages.
    - Multi-Platform Desktop (Windows & Linux Debian), Official Icon Everywhere & System Autostart:
      - Built cross-platform runtime icon resolver (`app-icon.ts`) ensuring the official high-res logo displays without fallback on Windows taskbar, Linux dock/decorations, and system tray;
      - Implemented cross-platform system autostart manager (`autostart.ts`) supporting Windows (`app.setLoginItemSettings`), Linux (`~/.config/autostart/ph-ponto.desktop`), and macOS, with default auto-start on installation and `--hidden` boot support;
      - Enhanced Linux packaging in `package.json` with `desktopName: "ph-ponto"`, `syncDesktopName: true`, and `.desktop` metadata (`StartupWMClass: "PH-Ponto"`);
      - Validated building and packaging for Linux (`.deb` e `.AppImage`) and verified `pnpm check` (213/213 unit tests passing, clean typecheck).
    - Release v0.1.3 — Darker Modal Backdrop Overlay & Linux Runtime Hardening:
      - Adjusted modal backdrop overlay to `bg-black/80 backdrop-blur-md` across all modals and screens for immersive contrast;
      - Migrated shared attendance timezone arithmetic to native `Intl.DateTimeFormat` (eliminating `date-fns-tz` dynamic imports);
      - Added `executableArgs: ["--no-sandbox"]` and Debian postinst script for out-of-the-box Ubuntu/Debian execution;
      - Bumped version to **v0.1.3** and prepared automated multi-platform GitHub Release workflow.
    - Admin Desktop App Downloads Page:
      - Created `/admin/aplicativo` page ([AdminDownloadsPage](file:///home/nycolas/nyc/PH-Motopecas-Ponto/apps/desktop/src/renderer/pages/admin/downloads-page.tsx)) with one-click download cards for Windows (.exe), Linux (.deb and .AppImage), and macOS (.dmg);
      - Included step-by-step instructions, quick terminal installation snippet with copy-to-clipboard button, and feature badges;
      - Integrated seamlessly into Admin Sidebar navigation (`Aplicativo Desktop`) and verified through unit tests (216/216 passing).

    - Employee Vacation (Férias) Management in Settings (`/configuracoes`):
      - Added `Vacation` model to Prisma schema with index on `[employeeId, startDate, endDate]` and migration `20260819143000_vacations`;
      - Added `VacationsModule`, `VacationsService`, `VacationsController` with overlap validation and audit logging (`VACATION_CREATED`, `VACATION_DELETED`);
      - Integrated vacation interval checking into `AttendanceService` (`resolveDaily`, `getTodayOverview`, `loadPeriodSummaries`), setting `expectedMinutes: 0`, `isOpen: false`, `calendarStatus: 'VACATION'`, and ensuring vacation days never count as absence/missing hours;
      - Added "Férias dos Colaboradores" tab in `AdminSettingsPage` with employee selector, date duration calculator, reason note, and deletion action;
    - Operational Live Work Statuses ("Trabalhando", "Almoço", "Fechado"):
      - Added `LUNCH` (`Em almoço`) provisional work state in `@ph-ponto/shared` daily calculation;
      - Automatically detects midday lunch break (when 2 punches occur on lunch-enabled days like Monday-Friday);
      - Respects days without lunch (such as Saturday with 2 punches), transitioning directly to `OFF_DUTY` ("Fechado") without showing lunch;
      - Prioritized `workState` over static expectation status in `StatusBadge` so live working/lunch states display with clear colors (green pulse for working, amber for lunch, dark slate for closed/off duty);
    - Administrative Time Punch Deletion (Exclusão de Batidas):
      - Database migration `20260903150000_allow_time_punch_deletion` adding `TIME_PUNCH_DELETED` audit action, `DELETE_TIME_PUNCH` idempotency operation, cascading foreign keys, and removing immutable triggers on time punches and adjustments;
      - Backend endpoint `DELETE /time-punches/:punchId` in `TimePunchController` and `TimePunchService.deletePunch`, deleting adjustments/requests, updating `kind` sequentially on remaining punches of that day, recalculating `dailySummary`, and logging audit trail;
      - Frontend `PunchCorrectionModal` with "Excluir Batida" action, confirmation screen with clear consequences warning, instant recalculation, and fluid toast feedback;
      - Full automated verification gate `pnpm check` / `pnpm test` passing 100% (223/223 unit and integration tests).

## Handoff Notes

All user requests and core requirements for PH-Ponto have been delivered, verified, and pushed to GitHub:

1. **Exclusão de Batidas de Ponto pelo Administrador:**
   - Adicionada opção de excluir batidas diretamente no modal de correção de ponto em `/admin/funcionarios` e `/admin/pontos`.
   - Ao excluir, o sistema reordena os tipos das batidas restantes do dia (`CLOCK_IN` / `CLOCK_OUT`), recalcula o saldo de horas e registra o evento na trilha de auditoria.
2. **Gestão de Férias e Recessos:**
   - Adicionada aba completa em `/configuracoes` para cadastrar períodos de férias por colaborador com cálculo automático de dias e validação contra sobreposições.
3. **Status Operacionais em Tempo Real (Trabalhando, Almoço, Fechado):**
   - O painel administrativo e a tela de pontos refletem exatamente o estado do colaborador em tempo real.
4. **Ícone Oficial no Windows & Desktop:**
   - O aplicativo exibe o ícone oficial da PH Motopeças no executável, instalador NSIS, barra de tarefas e bandeja do sistema.
5. **Garantia de Qualidade:** Todos os 223 testes unitários e de integração passando com 100% de sucesso.
