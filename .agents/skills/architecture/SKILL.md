---
name: architecture
description: Design and review PH-Ponto boundaries, module responsibilities, cross-cutting flows, and architectural decisions. Use for new subsystems, changes spanning API/desktop/shared packages, dependency choices, refactors, or maintainability reviews.
---

# PH-Ponto Architecture

1. Read `/AGENTS.md`, `/PROJECT_PROGRESS.md`, and `/docs/architecture.md` before proposing changes.
2. Identify the domain owner, trust boundary, persistence boundary, and API contract affected.
3. Keep business rules out of controllers and React components. Put pure attendance rules in `packages/shared`; put orchestration and authorization in NestJS application services.
4. Prefer feature modules with narrow public interfaces. Avoid circular imports, giant services, generic repositories, and renderer-to-database access.
5. Preserve schedule history, punch immutability, append-only adjustments, refresh rotation, idempotency, and audit integrity.
6. For punch flows, require actor-scoped idempotency with a request fingerprint, employee-stream serialization, one captured server instant, duplicate-window validation, atomic response persistence, and same-key replay.
7. Route detailed review through the relevant local skills: backend, data model, attendance, security, product/frontend, Electron, and QA.
8. Record material decisions and their tradeoffs in `PROJECT_PROGRESS.md`; add a focused document under `docs/` when the decision needs durable detail.
9. Validate the change with dependency-aware unit, real-PostgreSQL concurrency, integration, type, and build checks.

Use PostgreSQL transactions for invariants spanning multiple writes. Treat the API as authoritative for identity, time, permissions, calculations, and state transitions. Keep Electron as a secure desktop shell around the renderer.
