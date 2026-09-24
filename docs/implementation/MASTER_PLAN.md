# PH-Ponto HR Implementation Plan

## Approved product

Extend the existing attendance monorepo into company, employee, and document management. Preserve existing employee UUIDs and attendance workflows. The written product specification is the visual/functional reference; no reference video was supplied. Use the official PH Motopeças assets, pt-BR UI/documents, and English source/documentation.

User decisions: one company per installation; ADMIN manages HR and EMPLOYEE retains attendance access; PDF and paper signatures only; include interview and both acknowledgment documents; app access is separate from employment; suspensions are documentary only; termination is an explicit manual employment event without severance calculations. No deployments, pushes, production secrets/data, multi-tenancy, CPF login, electronic signatures, DOCX, empty guides/jobs modules, or automatic employment/legal decisions.

## Architecture

- Keep `apps/api` (NestJS/Prisma/PostgreSQL), `apps/desktop` (Electron/React/Vite), and `packages/shared` (portable contracts and pure rules).
- Add focused company, job-roles, regulations, culture, documents, onboarding, discipline, performance, and employee-history modules. Avoid a generic HR everything table/service.
- Reuse User/EMPLOYEE identity. EmployeeProfile is a one-to-one extension with userId as key. Add accessEnabled independently of isActive. Login requires both. Disabled-access creation does not require a known password; enabling requires explicit credentials.
- Company is a singleton. Use normalized company data and immutable snapshots for historical documents. No tenant selector.
- JobRole has immutable versions and dated principal-role assignments. Regulations have structured work rules and ordered clauses. Culture has mission, vision, motto, ordered values.
- DocumentDraft contains a versioned discriminated payload and optimistic revision. Server autosave permits incomplete drafts; preparation/finalization requires complete validation. Author owns draft editing.
- Pure builders produce typed document content. Versioned code templates render HTML/CSS to PDF with Playwright Chromium, bundled fonts/assets, and no untrusted network/file resources. PDF.js previews the prepared PDF.
- PostgreSQL render jobs use leases/retries and a separate worker; private storage holds checksummed artifacts. Prepare PDF before confirmation. Confirmation atomically publishes domain record, GeneratedDocument and audit, promoting the same reviewed bytes. Dependency/revision changes invalidate preparation.
- Final domain/document records are immutable; corrections explicitly supersede/void with reason. Do not silently replace historical files. Real foreign keys link documents and domain records.
- Employee timeline is a paginated read projection, not duplicated business truth. A warning plus its PDF appears once. Role, access, employment, evaluation and documentary history remain recoverable.
- Disciplinary summary marks only actually recorded stages, ignores voids for current summary, preserves voids in history, and never recommends/automates punishment or termination.
- Performance starts with eight criteria from the specification; integer scores 1–5, equal weights, mean rounded to two decimals. Criteria versions preserve older reviews. One current review per employee/period, explicit supersession for correction.
- Company progress has six equal requirements: complete company, published regulation, published role, published culture, active employee, all active employees assigned roles and current generated acknowledgments. Generated does not mean signed.
- Dates use America/Sao_Paulo; instants UTC. Importing attendance schedules into regulations creates a reference/snapshot, not automatic two-way synchronization.

## Existing debt in scope

Repair browser refresh-token localStorage, incorrect browser logout, bootstrap default credentials, missing administrative reset revocation, wildcard CORS, disabled sandbox scripts, renderer lint/format exclusions, stale build copies, mixed timezones, weak image decoding, and physical punch deletion. Replace punch deletion with immutable voiding and derive effective kinds from surviving chronology, preserving the current minute-resolution calculation.

## Phases and acceptance

| Phase | Objective and tasks                                                    | Dependencies | Persistence                                      | Exit evidence                                                               |
| ----- | ---------------------------------------------------------------------- | ------------ | ------------------------------------------------ | --------------------------------------------------------------------------- |
| HR-0  | Durable docs, isolated local services, baseline, real lint/build gates | Approval     | Existing migrations on isolated local database   | Existing units/integration/E2E/builds recorded; no remote fallback          |
| HR-1  | Auth/security, timezone, immutable voids, image validation, sandbox    | HR-0         | Voids and integrity migration                    | Session, image, race, attendance regression tests pass                      |
| HR-2  | Company, identity/access, roles, responsive shell                      | HR-1         | Company/profile/access/role versions/assignments | Existing IDs retained; active employee without login access                 |
| HR-3  | Drafts, storage, jobs, templates, PDF preview, archive; culture first  | HR-2         | Draft/job/artifact/document/culture              | Culture edit → preview → confirm → retrieve after login                     |
| HR-4  | Regulation wizard, role map, interview, acknowledgments                | HR-3         | Rules/clauses/versions/interview/acknowledgments | All foundation/hiring documents persisted and historical versions preserved |
| HR-5  | Employee profile/timeline, access, archive/reactivate/termination      | HR-4         | Employment events/indexes                        | Unified history, no duplicate entries, attendance retained                  |
| HR-6  | Conversation/verbal/written/suspension, progression/voids              | HR-5         | Discipline and prior-record relationships        | Human confirmation, idempotency, no automatic attendance changes            |
| HR-7  | Criteria, scores, performance document/history/supersession            | HR-6         | Criteria versions/reviews/scores                 | Exact persisted scores/mean, immutable older review                         |
| HR-8  | Real progress, complete archive filtering, UX polish, local demo       | HR-7         | Necessary query indexes                          | Coherent complete workflow at mobile/tablet/desktop                         |
| HR-9  | Full QA, recovery, migration upgrade/restore, independent review       | HR-8         | Full migration chain verified                    | Relevant gates pass, no high/critical findings, honest platform limitations |

Each phase requires relevant unit, renderer, API/integration tests, lint, formatting, strict types, affected builds, and evidence updates. Existing phases 0–8 in PROJECT_PROGRESS are historical; HR phases extend them. No phase is complete with required tests failing.

## UI and APIs

Keep current employee/punch/report URLs. `/admin` becomes company setup home and `/admin/gestao` hosts existing operational dashboard. Navigation: Início, Gerar documento, Meus documentos, Equipe, Minha empresa, Painel de gestão, attendance and administration groups. Preserve HashRouter. Responsive sidebar, accessible forms, calm brand styling, lazy feature routes.

Profile tabs: Resumo, Histórico, Documentos, Avaliações, Ponto, Acesso ao app. Regulation steps: Empresa, Jornada, Conduta, Tecnologia, Disciplina, Revisão. Autosave status and conflict recovery are visible; no HR narratives in localStorage. Wizard refresh restores last server-saved revision.

REST groups: company/setup-progress; job-roles/versions; employee role/access/employment/timeline; document-types; document-drafts prepare/finalize; render jobs; documents metadata/content/download; regulations/culture versions; discipline; performance/criteria; onboarding. ADMIN enforcement, bounded pagination, validation, Swagger, expectedRevision and actor-scoped idempotency on consequential mutations. New browser auth endpoints use HttpOnly cookies, explicit origin/CSRF control and serialized refresh; Electron bearer contract remains.

## Data constraints

Use additive migrations, restrictive historical FKs, UUIDs, timestamptz/date, unique entity-version, draft-revision confirmation uniqueness, score bounds, ordered date ranges, no overlapping principal role assignments, immutable published records. Index employee/date, document company/type/date, jobs state/availableAt/lease. Never rewrite existing migrations or fabricate hire dates/deleted history.

## Delivery and recovery

At most four agents including orchestrator. Orchestrator owns shared contracts, schema/migration sequence and durable documents. Assign explicit file ownership; no concurrent edits to shared files or independent architectural redesign. Use small reviewed local commits; no publication. Read AGENTS, PROJECT_PROGRESS and all implementation docs, git status/diff/log before continuing. Record exact commands/results, current partial state and next action before interruption.
