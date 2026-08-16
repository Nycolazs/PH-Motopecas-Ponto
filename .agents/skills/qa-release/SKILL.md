---
name: qa-release
description: Plan and execute PH-Ponto validation, regression testing, release review, build verification, and evidence-based handoff. Use for test strategy, bug verification, CI failures, pre-release checks, and final readiness assessment.
---

# PH-Ponto QA and Release

1. Read `/AGENTS.md`, `/PROJECT_PROGRESS.md`, the changed files, and existing test configuration.
2. Build a risk-based matrix covering domain rules, authentication, authorization/IDOR, persistence, API contracts, renderer states, Electron boundaries, exports, and packaging.
3. Run targeted tests while developing, then the repository `pnpm check` gate. Run real-PostgreSQL race/rollback integration and Playwright E2E flows in their documented environment.
4. Verify the mandatory attendance cases: weekday normal/overtime/missing, Saturday, closed Sunday, holiday, special hours, incomplete punches, correction chains, and schedule history.
5. Verify critical employee, admin employee/photo, correction/audit, schedule, holiday, CSV/PDF injection and bounds, auth revocation/concurrency, IDOR, upload abuse, and offline flows.
6. Inspect light/dark themes and 1366x768, 1440x900, 1920x1080, and 2560x1440 layouts. Check keyboard, focus, contrast, errors, offline behavior, and Brazilian copy.
7. Test blank-database and upgrade migrations, backup/restore, frozen-lockfile install, dependency/secret scanning, and packaged Windows install/login/offline/uninstall behavior. Record installer checksum/signing status.
8. Record commit, OS, PostgreSQL version, exact commands, counts, skips, failures, and artifact hashes. Never report a skipped or unexecuted check as passing.
9. Block release for any open Critical/High finding or skipped required gate. Accepted lower risks require an owner, rationale, and expiry. Update `PROJECT_PROGRESS.md` before handoff.

Never disable or weaken a test to obtain a green build.
