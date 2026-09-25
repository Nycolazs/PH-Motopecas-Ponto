# Implementation Tasks

Statuses: pending, active, review, done, blocked. A planned task is never evidence of implementation. Every task inherits the phase acceptance in MASTER_PLAN and test matrix in TESTING.

| ID      | Status  | Owner             | Modules/files                         | Dependency | Acceptance/tests                                                   |
| ------- | ------- | ----------------- | ------------------------------------- | ---------- | ------------------------------------------------------------------ |
| HR0-001 | done    | orchestrator      | implementation docs, PROJECT_PROGRESS | approval   | Durable plan, audit, decisions and handoff                         |
| HR0-002 | done    | local environment | local scripts/config                  | HR0-001    | Isolated loopback services; production refusal                     |
| HR0-003 | done    | QA                | existing test suites                  | HR0-001    | Exact baseline commands/results                                    |
| HR0-004 | done    | quality           | lint/format/build scripts             | HR0-001    | Renderer included, build artifacts not copied into tracked sources |
| HR1-001 | done    | auth              | auth/users/bootstrap/web bridge       | HR-0       | Cookie auth, revocation, no bootstrap defaults                     |
| HR1-002 | done    | orchestrator      | shared dates/config                   | HR-0       | São Paulo end-to-end and local origins                             |
| HR1-003 | done    | attendance        | punches/adjustments/schema            | HR-0       | Voids preserve original history; race tests                        |
| HR1-004 | done    | security          | avatars/Electron                      | HR-0       | Decode/reencode validation, sandbox enabled                        |
| HR2-001 | done    | backend           | company                               | HR-1       | Company persistence and DTO tests                                  |
| HR2-002 | done    | backend           | users/employees                       | HR-1       | App access independent, migration preserves users                  |
| HR2-003 | done    | backend           | job-roles                             | HR-1       | Versions and assignment constraints                                |
| HR2-004 | done    | frontend          | layout/routes                         | HR-1       | Responsive coherent navigation                                     |
| HR3-001 | pending | documents         | drafts/shared schemas                 | HR-2       | Autosave/conflict/refresh                                          |
| HR3-002 | pending | documents         | builders/storage/worker               | HR-2       | Durable jobs, recovery, safe PDF                                   |
| HR3-003 | pending | documents         | prepare/finalize/preview              | HR3-002    | Same reviewed bytes, atomic confirmation                           |
| HR3-004 | pending | frontend          | archive                               | HR3-003    | Authorized retrieval after login                                   |
| HR3-005 | pending | product           | culture                               | HR3-003    | First complete document flow                                       |
| HR4-001 | pending | product           | regulations                           | HR-3       | Six-step persisted wizard and versions                             |
| HR4-002 | pending | documents         | role map                              | HR-3       | Published role version snapshots                                   |
| HR4-003 | pending | product           | interviews                            | HR-3       | Candidate not silently made employee                               |
| HR4-004 | pending | product           | acknowledgments                       | HR-3       | Exact role/regulation historical references                        |
| HR5-001 | pending | frontend          | profile                               | HR-4       | Unified tabs/quick actions                                         |
| HR5-002 | pending | backend           | employee-history                      | HR-4       | Stable paginated projection, no duplicates                         |
| HR5-003 | pending | backend           | access                                | HR-4       | Revocation and preserved employment                                |
| HR5-004 | pending | backend           | employment events                     | HR-4       | Manual termination and archive history                             |
| HR6-001 | pending | discipline        | conversation/verbal                   | HR-5       | Structured record, PDF, idempotency                                |
| HR6-002 | pending | discipline        | written warnings                      | HR-5       | Same-employee prior references                                     |
| HR6-003 | pending | discipline        | suspension                            | HR-5       | Valid period, no attendance effects                                |
| HR6-004 | pending | discipline        | summary/voids                         | HR-5       | Pure progression tests                                             |
| HR7-001 | pending | performance       | criteria                              | HR-6       | Versioned criteria                                                 |
| HR7-002 | pending | performance       | reviews/scores                        | HR-6       | Bounded scores and deterministic mean                              |
| HR7-003 | pending | documents         | review document/history               | HR-6       | Supersession preserves history                                     |
| HR8-001 | pending | product           | setup dashboard                       | HR-7       | Six real requirements                                              |
| HR8-002 | pending | frontend          | archive filters                       | HR-7       | Search/page/state coverage                                         |
| HR8-003 | pending | UX                | cross-feature UI                      | HR-7       | Keyboard/mobile/theme visual review                                |
| HR8-004 | pending | QA                | local seed                            | HR-7       | Idempotent synthetic full workflow dataset                         |
| HR9-001 | pending | QA                | regression/E2E                        | HR-8       | Real local API/database flows                                      |
| HR9-002 | pending | QA                | recovery/migrations                   | HR-8       | Upgrade/restore/job restart                                        |
| HR9-003 | pending | reviewer          | security/architecture                 | HR-8       | Independent findings resolved                                      |
| HR9-004 | pending | UX                | PDFs/screens                          | HR-8       | Rendered page/layout evidence                                      |
| HR9-005 | pending | orchestrator      | builds/handoff                        | HR-8       | Complete evidence and platform limitations                         |
