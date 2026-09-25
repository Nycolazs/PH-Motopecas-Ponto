# Implementation Status

- Phase: HR-8 — Setup progress, archive filtering, cross-feature polish, and local seed.
- State: IN_PROGRESS. HR-0, HR-1, HR-2, HR-3, HR-4, HR-5, HR-6, and HR-7 completed and verified on 2026-09-25.
- Base commit: working tree on feat/hr-evolution contains validated HR-0 through HR-7 code.
- Completed:
  - HR-0 (baseline, tooling, local isolation gates, lint/format scripts).
  - HR-1 (auth/cookies/revocation, bootstrap hardening, America/Sao_Paulo timezone restoration, immutable punch voiding with migration 20260924010000_preserve_voided_punch_history, avatar validation, and sandbox enforcement).
  - HR-2 (Company singleton model/endpoints, User.accessEnabled separation from isActive, EmployeeProfile, JobRole immutable versions & assignments with migration 20260925010000_hr_company_roles_access, responsive navigation shell, SetupDashboardPage, CompanyPage, JobRolesPage).
  - HR-3 (Document drafts, optimistic concurrency, private artifact storage, Playwright PDF generation, render jobs queue, document archive with search/type/void filters, voiding with justification, Culture document wizard on /admin/documentos/cultura, migration 20260925020000_hr_document_drafts_artifacts_culture).
  - HR-4 (Company Internal Regulations 6-step persisted wizard, versioning, acknowledgment terms with exact version linking, hiring interview guide without silent employee creation, role map documents, migration 20260925030000_hr_regulations_role_maps_interviews_acknowledgments).
  - HR-5 (Unified Employee Profile tabs: Resumo, Histórico, Documentos, Avaliações, Ponto & Frequência, Acesso ao app; employment events: admission, manual termination, suspension history, notes, reactivate; paginated timeline projection aggregating events, roles, documents, vacations, and access audits; migration 20260925040000_hr_employment_events).
  - HR-6 (Disciplinary actions: verbal warning, written warning, suspension; pure progression calculator, CLT Art. 474 suspension limits, prior action references, void handling cascade, PDF templates, and frontend wizard on /admin/documentos/disciplina, migration 20260925050000_hr_disciplinary_actions).
  - HR-7 (Performance evaluations: versioned catalog with 8 canonical criteria, bounded 1-5 integer scores, deterministic 2-decimal rounded mean calculation and qualitative classification bands, review document drafts and HTML/CSS PDF templates, atomic confirmation with employment timeline logging, review history table with supersession modal, and employee profile evaluations tab; migration 20260925060000_hr_performance_reviews).
- Verified gates: `pnpm check` passed 100% (376 unit/tooling tests: shared 91, API 183, desktop 90, tooling 12; 0 lint errors, clean format, all production builds), and `pnpm --filter @ph-ponto/api test:integration` passed 100% (25 PostgreSQL integration tests applying all 12 migrations).
- Next: HR-8 (Onboarding setup dashboard 6 milestones validation, archive filtering, cross-feature UX polish, local synthetic seed dataset).
- Migrations: 12 migrations applied successfully from scratch on PostgreSQL `ph_ponto_test`.
- Known failures: none.
- Production: no remote service, push to main, deployment or production data authorized. Local work isolated to feat/hr-evolution branch.

See TASKS and HANDOFF for ownership and exact continuation.
