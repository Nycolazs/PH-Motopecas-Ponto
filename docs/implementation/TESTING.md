# Testing Strategy and Evidence

## Planning baseline — 2026-09-23, commit 680715f

macOS arm64, Node 24.18.1, pnpm 11.21.0. Commands initially failed because pnpm was absent from non-interactive PATH; reran with the installed NVM bin directory explicitly included.

| Command                                                    | Result                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------ |
| pnpm --filter @ph-ponto/shared exec vitest run             | PASS: 7 files, 64 tests                                            |
| pnpm --filter @ph-ponto/api exec vitest run                | PASS: 22 files, 114 tests                                          |
| pnpm --filter @ph-ponto/desktop exec vitest run            | PASS: 12 files, 72 tests                                           |
| node --test apps/api/scripts/_.test.mjs scripts/_.test.mjs | PASS: 12 tooling tests                                             |
| pnpm lint                                                  | PASS: 0 errors, 0 warnings                                         |
| pnpm format:check                                          | PASS: 100% compliant                                               |
| pnpm typecheck                                             | PASS: strict across all workspaces                                 |
| pnpm build                                                 | PASS: shared, API, desktop electron & renderer                     |
| pnpm test:integration                                      | PASS: 6 files, 25 tests against local PostgreSQL with 6 migrations |
| pnpm test:e2e                                              | PASS: 5 Chromium suites passing                                    |
| pnpm check:full                                            | PASS: complete quality gate passed                                 |

## Required coverage

- Unit: document builders, setup progress, actual disciplinary stages, score mean/bounds, dates, schemas, draft transitions.
- API/database: RBAC/ownership, optimistic concurrency, idempotency, transaction rollback, restrictive FKs, immutable history, fresh and upgrade migrations.
- Jobs/storage: failed writes, lease recovery, retry, checksums, expired previews, cleanup/finalization races.
- Renderer: autosave/refresh, validation, accessible controls/focus, offline/API/expired/forbidden/loading/empty/saving/success states.
- PDF: extracted content, accents, long content, pagination, tables, official logo and signature positions. Never compare only binary equality.
- Real E2E: company/regulation/archive; role/employee/terms/new versions; culture; interview without employee creation; verbal/written/suspension; evaluation; access disable; manual termination.
- Regression: normal/overtime/missing/incomplete attendance, minute precision, schedule history, vacations, insertion/corrections/voids, audit, auth, desktop inactivity logout.
- Visual: 390x844, 768x1024, 1366x768, 1440x900, 1920x1080, 2560x1440, light/dark, keyboard, zoom, reduced motion.
- Security: private document IDOR, revoked sessions, cookie origin/CSRF, template escaping, path traversal, resource fetch denial, upload decoding, bootstrap.

## Gates

Each phase: relevant tests + lint + formatting + strict typecheck + affected builds. Full local readiness also requires real PostgreSQL integration and real-service E2E. Existing intercepted Playwright tests remain useful UI regressions but are not evidence of persistence.

Windows installer cannot be claimed validated from macOS. No CI workflow may be triggered merely to satisfy local-only acceptance. Record platform validation limitations honestly.
