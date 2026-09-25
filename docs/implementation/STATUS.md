# Implementation Status

- Phase: HR-4 — Company internal regulations wizard, role maps, hiring interviews, and acknowledgment terms.
- State: IN_PROGRESS. HR-0, HR-1, HR-2, and HR-3 completed and verified on 2026-09-24.
- Base commit: working tree on feat/hr-evolution contains validated HR-0, HR-1, HR-2, and HR-3 code.
- Completed:
  - HR-0 (baseline, tooling, local isolation gates, lint/format scripts).
  - HR-1 (auth/cookies/revocation, bootstrap hardening, America/Sao_Paulo timezone restoration, immutable punch voiding with migration 20260924010000_preserve_voided_punch_history, avatar validation, and sandbox enforcement).
  - HR-2 (Company singleton model/endpoints, User.accessEnabled separation from isActive, EmployeeProfile, JobRole immutable versions & assignments with migration 20260925010000_hr_company_roles_access, responsive navigation shell, SetupDashboardPage, CompanyPage, JobRolesPage).
  - HR-3 (Document drafts, optimistic concurrency, private artifact storage, Playwright PDF generation, render jobs queue, document archive with search/type/void filters, voiding with justification, Culture document wizard on /admin/documentos/cultura, migration 20260925020000_hr_document_drafts_artifacts_culture).
- Verified gates: `pnpm check` passed 100% (297 unit/tooling tests, 0 lint warnings, clean format, all production builds), and `pnpm --filter @ph-ponto/api test:integration` passed 100% (25 PostgreSQL integration tests applying all 8 migrations).
- Next: HR-4 (Company Internal Regulations 6-step wizard, versioning, acknowledgment terms, hiring interview guide, and role map documents).
- Migrations: 8 migrations applied successfully from scratch on PostgreSQL `ph_ponto_test`.
- Known failures: none.
- Production: no remote service, push to main, deployment or production data authorized. Local work isolated to feat/hr-evolution branch.

See TASKS and HANDOFF for ownership and exact continuation.

