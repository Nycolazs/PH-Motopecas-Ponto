# Implementation Status

- Phase: HR-5 — Unified employee profile tabs, employment events, and timeline projection.
- State: IN_PROGRESS. HR-0, HR-1, HR-2, HR-3, and HR-4 completed and verified on 2026-09-24.
- Base commit: working tree on feat/hr-evolution contains validated HR-0, HR-1, HR-2, HR-3, and HR-4 code.
- Completed:
  - HR-0 (baseline, tooling, local isolation gates, lint/format scripts).
  - HR-1 (auth/cookies/revocation, bootstrap hardening, America/Sao_Paulo timezone restoration, immutable punch voiding with migration 20260924010000_preserve_voided_punch_history, avatar validation, and sandbox enforcement).
  - HR-2 (Company singleton model/endpoints, User.accessEnabled separation from isActive, EmployeeProfile, JobRole immutable versions & assignments with migration 20260925010000_hr_company_roles_access, responsive navigation shell, SetupDashboardPage, CompanyPage, JobRolesPage).
  - HR-3 (Document drafts, optimistic concurrency, private artifact storage, Playwright PDF generation, render jobs queue, document archive with search/type/void filters, voiding with justification, Culture document wizard on /admin/documentos/cultura, migration 20260925020000_hr_document_drafts_artifacts_culture).
  - HR-4 (Company Internal Regulations 6-step persisted wizard, versioning, acknowledgment terms with exact version linking, hiring interview guide without silent employee creation, role map documents, migration 20260925030000_hr_regulations_role_maps_interviews_acknowledgments).
- Verified gates: `pnpm check` passed 100% (313 unit/tooling tests, 0 lint errors, clean format, all production builds), and `pnpm --filter @ph-ponto/api test:integration` passed 100% (25 PostgreSQL integration tests applying all 9 migrations).
- Next: HR-5 (Unified Employee Profile tabs: Resumo, Histórico, Documentos, Avaliações, Ponto, Acesso; employment events: admission, manual termination, suspension history; paginated timeline projection).
- Migrations: 9 migrations applied successfully from scratch on PostgreSQL `ph_ponto_test`.
- Known failures: none.
- Production: no remote service, push to main, deployment or production data authorized. Local work isolated to feat/hr-evolution branch.

See TASKS and HANDOFF for ownership and exact continuation.
