---
name: security-review
description: Threat-model and audit PH-Ponto authentication, RBAC, IDOR, tokens, uploads, audit integrity, database access, Electron IPC, CSP, secrets, and error leakage. Use before merging security-sensitive work and during release review.
---

# PH-Ponto Security Review

1. Read `/AGENTS.md`, `/PROJECT_PROGRESS.md`, and the exact code/configuration under review.
2. Map assets, actors, trust boundaries, entry points, and attacker-controlled inputs. Trace authorization from route to database predicate.
3. Verify Argon2id parameters/rehash policy, enumeration-safe errors, inactive-user rejection on every request, trusted-proxy-aware throttling, refresh concurrency/reuse handling, lifecycle revocations, JWT algorithm/issuer/audience/expiry, and secret redaction.
4. Attempt horizontal and vertical IDOR across employees, punches, reports, avatars, adjustments, admins, settings, and audit reads.
5. Verify DTO whitelisting, query bounds, transactional invariants, safe errors, idempotency scoping, and audit coupling.
6. Inspect uploads using bytes-derived MIME, decode/re-encode, dimension/size limits, generated names, fixed storage roots, and non-executable serving.
7. Inspect report row authorization, CSV formula injection, PDF escaping/resource fetching, export bounds, safe filenames, and temporary-file cleanup.
8. Inspect TLS/CORS/trusted-proxy assumptions, headers, Swagger exposure, container/database least privilege, secret/bootstrap handling, dependency provenance, and Electron isolation, IPC, CSP, navigation, permissions, URLs, and token storage.
9. Report findings by severity with evidence, exploit path, affected files, and concrete remediation. Fix meaningful findings, add regression tests, rerun checks, and update progress.

Do not mark speculative concerns as confirmed. Do not expose actual secrets in findings or logs.
