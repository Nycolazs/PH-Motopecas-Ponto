# Implementation Handoff

## Startup

Read AGENTS.md, PROJECT_PROGRESS.md, MASTER_PLAN.md, STATUS.md, TASKS.md, DECISIONS.md and TESTING.md before inspecting current git status/diff/log and relevant code. Verify actual implementation; never infer completion from task names.

## Current checkpoint — 2026-09-25

- **HR Evolution Full Delivery**: All phases HR-0 through HR-9 are 100% complete, fully tested, integrated, and verified on branch `feat/hr-evolution`.
- **Database**: 12 committed Prisma migrations applied cleanly on PostgreSQL 16.13 (`ph_ponto`).
- **Synthetic HR Dataset**: Seeded via `apps/api/src/database/seed-hr-demo.ts` providing realistic company data, culture profile, company regulations, 3 job roles, canonical performance criteria, 2 synthetic employees with role assignments, acknowledgments, admission events, interview guides, disciplinary actions, homologated performance reviews, and time punches with idempotency records.
- **Verification Gates**:
  - `pnpm check:full` passed 100%:
    - 377 unit & tooling tests (shared 91, api 183, desktop 91, tooling 12).
    - 25 PostgreSQL integration tests applying all 12 migrations.
    - 5 Playwright Chromium E2E suites.
    - Strict ESLint (0 errors, 0 warnings), Prettier formatted, and strict TypeScript across all workspaces.
    - Production builds passing for shared, API (NestJS + Prisma), and Desktop (Electron main/preload + Vite renderer + web-dist).
- **Security & Integrity**:
  - Argon2id password hashing, rotating refresh token families with HMAC SHA-256 in DB, HttpOnly web session bridge, last-active-admin safeguard.
  - Separate app access (`accessEnabled`) from employment (`isActive`).
  - Immutable punches and append-only void records (`TimePunchVoid`), preserve audit integrity.
  - Safe HTML-to-PDF rendering using Playwright Chromium with zero external network access.
  - Strict pt-BR copy and `America/Sao_Paulo` timezone throughout.
- **Local Isolation**: All development remains strictly on local branch `feat/hr-evolution`. No remote git pushes, tags, or production deployments have been made.

## Tooling

Prefix shell commands with `export PATH=/Users/nycolazs/.nvm/versions/node/v24.18.1/bin:/opt/homebrew/bin:/usr/bin:/bin:$PATH` on this workstation.

Commands: `pnpm check:full`, `pnpm check`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm db:migrate`, `pnpm db:seed`.

## Ownership

Orchestrator owns implementation docs, PROJECT_PROGRESS, schema and migration order. All changes are verified and committed locally.
