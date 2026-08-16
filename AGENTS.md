# PH-Ponto Engineering Rules

These rules apply to the entire repository.

## Mandatory startup

Before inspecting or changing project code, read this file and `PROJECT_PROGRESS.md`. Then inspect `git status`, `git diff`, and the relevant files. The repository state is authoritative; correct the progress file if it is stale.

## Product and language

- The official product name is **PH-Ponto** and the company is **PH Motopeças**.
- Keep source code, filenames, symbols, tests, technical comments, and developer documentation in English.
- Keep every user-facing string in Brazilian Portuguese (`pt-BR`).
- Interpret business dates in `America/Sao_Paulo`; store instants safely in UTC.
- Use the supplied PH Motopeças logo without distortion or redesign. If the asset is absent, record the blocker and do not invent a replacement logo.

## Delivery process

- Work through Phases 0–8 in the order recorded in `PROJECT_PROGRESS.md`.
- A feature is complete only when implemented, integrated, persisted where applicable, tested, and recorded in `PROJECT_PROGRESS.md`.
- Update `PROJECT_PROGRESS.md` after phases, architectural decisions, migrations, major features, test runs, blockers, and before stopping.
- Never claim that a command or test passed unless it was actually run successfully.
- Do not leave TODO implementations, fake production data, disconnected screens, disabled tests, or silent error paths.
- Preserve unrelated user changes. Agents must coordinate file ownership and must not revert work from other agents.

## Architecture guardrails

- Use the pnpm monorepo layout: `apps/api`, `apps/desktop`, and `packages/shared`.
- Backend: NestJS REST API, Prisma, PostgreSQL, DTO validation, Swagger, modular services, authoritative RBAC.
- Desktop: Electron + React + Vite + Tailwind, with `main`, `preload`, and `renderer` separation.
- Electron must keep `nodeIntegration: false`, `contextIsolation: true`, and `sandbox: true`; expose only narrow typed preload APIs.
- Keep attendance calculation as an isolated, framework-independent domain using integer minutes.
- Backend time is authoritative for punches. Require idempotency and database-backed duplicate protection.
- Original punches are immutable; corrections append adjustment history and reports use the latest effective value.
- Version schedules by effective date. Date-specific exceptions override weekly schedules.
- Use migrations in every environment; never enable automatic production schema synchronization.
- Never store renderer authentication secrets in `localStorage`.

## Security and data

- Hash passwords with Argon2id. Never log credentials, tokens, hashes, or secret configuration.
- Enforce inactive-user checks, rate limiting, rotating refresh sessions, logout revocation, RBAC, ownership checks, and last-active-admin protection in the API.
- Validate avatar content, MIME type, dimensions, size, generated filenames, and storage paths.
- Audit important admin and authentication actions without exposing audit mutation through normal application operations.
- Do not claim regulatory certification or REP-P compliance.

## Quality gates

- Use strict TypeScript, ESLint, Prettier, unit tests, API integration tests, renderer tests, and Playwright E2E tests.
- Add or update tests with every business rule and regression fix.
- Run the smallest relevant checks during development and `pnpm check` before release.
- Validate important UI states: loading, empty, error, offline, unavailable API, expired session, forbidden, saving, and success.
- Review keyboard access, visible focus, semantic labels, contrast, and 1366x768 usability.

## Local project skills

Use the relevant instructions under `.agents/skills/` when working in that area. Skill instructions supplement this file; this file wins if they conflict.
