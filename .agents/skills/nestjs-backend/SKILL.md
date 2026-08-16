---
name: nestjs-backend
description: Implement and review PH-Ponto NestJS REST modules, authentication, authorization, DTO validation, transactions, errors, OpenAPI, and API tests. Use for controllers, guards, services, API contracts, configuration, and backend integrations.
---

# PH-Ponto NestJS Backend

1. Read `/AGENTS.md`, `/PROJECT_PROGRESS.md`, `/docs/architecture.md`, and the affected Prisma models.
2. Keep controllers thin: parse validated DTOs, invoke application services, and map responses. Keep domain logic in focused services or shared pure functions.
3. Apply global validation with whitelist and rejection of unknown fields. Return stable structured errors with a correlation identifier and safe `pt-BR` client messages.
4. Authenticate access tokens, rotate hashed refresh tokens, revoke sessions on logout, reject inactive users, and rate-limit login.
5. Enforce RBAC and resource ownership at every read and mutation boundary; never trust IDs merely because they were supplied by an authenticated client.
6. Use transactions for refresh rotation, last-active-admin protection, punching/idempotency, adjustments, and coupled audit records.
7. Use server time for punches and inject a clock abstraction for deterministic tests.
8. Document endpoints with Swagger and test DTO rejection, authorization, conflicts, and persistence effects.

Never return password hashes, refresh hashes, secret configuration, storage paths, or internal exception details.

