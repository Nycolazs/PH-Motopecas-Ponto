---
name: postgres-data-model
description: Design, migrate, seed, and review the PH-Ponto PostgreSQL/Prisma data model. Use for schema changes, indexes, constraints, transactions, migrations, seed behavior, query integrity, or database performance.
---

# PH-Ponto PostgreSQL Data Model

1. Read `/AGENTS.md`, `/PROJECT_PROGRESS.md`, `/docs/domain-model.md`, and all existing migrations before editing the schema.
2. Model invariants in PostgreSQL where practical: case-insensitive unique login, non-overlapping schedule effective dates, unique idempotency keys, valid adjustment lineage, and targeted indexes.
3. Use UUID primary keys, UTC timestamptz instants, explicit enums, integer minutes, created/updated timestamps where appropriate, and restrictive foreign keys for audit history.
4. Keep `TimePunch` immutable in normal operations. Append `TimeAdjustment`; mark administrative insertion provenance explicitly.
5. Store only hashed refresh tokens and bounded session metadata. Never seed production-known credentials except through validated environment variables.
6. Create a migration for every schema change. Inspect generated SQL, test migrate/seed against PostgreSQL, and record the migration in `PROJECT_PROGRESS.md`.
7. Use transactions and row locks or equivalent serializable checks for cross-row invariants such as last active admin and punch alternation.

Never use Prisma `db push` as a production deployment strategy or enable automatic schema synchronization.

