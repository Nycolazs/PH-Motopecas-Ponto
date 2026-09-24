# Implementation Handoff

## Startup

Read AGENTS.md, PROJECT_PROGRESS.md, MASTER_PLAN.md, STATUS.md, TASKS.md, DECISIONS.md and TESTING.md before inspecting current git status/diff/log and relevant code. Verify actual implementation; never infer completion from task names.

## Current checkpoint

- User approved full local implementation on 2026-09-23.
- Base commit 680715f; no unrelated changes on entry.
- Plan documents are being created. No feature code/migration changed yet.
- Planning inspection ran 243 successful unit/renderer tests: shared 64, API 110, desktop 69. Full execution baseline still pending.
- Exact next action: finish HR-0 local environment/gates/baseline; only then integrate HR-1 changes.
- Credentials: use ignored local configuration only after verifying targets without printing secrets. Never copy private values into docs/logs.
- No production, Git push, deployment or publishing authorized.

## Tooling

Prefix shell commands with `env PATH=/Users/nycolazs/.nvm/versions/node/v24.18.1/bin:/opt/homebrew/bin:/usr/bin:/bin` on this workstation, or initialize a supported Node environment.

Commands: `pnpm check`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm build:api`, `pnpm --filter @ph-ponto/desktop build:electron`. Inspect scripts before executing database cleanup. Full results belong in TESTING.md.

## Ownership

Orchestrator owns implementation docs, PROJECT_PROGRESS, schema and migration order unless explicitly delegated. Workers must not revert others' edits. Task ownership and exact changed files are recorded as work proceeds.
