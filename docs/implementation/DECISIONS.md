# Architectural Decisions

## D001 — Evolve the authoritative monorepo

Use apps/api, apps/desktop and packages/shared. Do not rewrite frameworks or independently modify duplicated Git submodules. Existing IDs/contracts remain compatible where possible. Alternative wholesale rewrite rejected due to attendance regression risk.

## D002 — Single-company ADMIN-only HR

User explicitly selected one company per installation and existing ADMIN/EMPLOYEE roles. No multi-tenant claims; no employee access to private HR documents. Company singleton and contextual resource checks enforce the chosen scope.

## D003 — Written reference and official brand

No video was supplied. User selected written specification. Preserve actual logo and existing calm blue/navy identity; do not claim video parity. Mobile and tablet layouts remain required.

## D004 — Immutable PDF publication

User selected PDF with paper signatures, including interview and both acknowledgments. Server-side versioned templates, prepared PDF and atomic publication give reproducible historical documents. Generated is distinct from signed. No DOCX or electronic signing provider.

## D005 — Separate access, employment and discipline

User selected active employees without app access, documentary-only suspension, manual simple termination. Add accessEnabled without conflating it with isActive; no automatic attendance deductions or employment decisions. No CPF auth requirement.

## D006 — Correct inherited security/integrity gaps first

The audit found localStorage refresh tokens, incorrect web logout, default bootstrap credentials, non-revoking admin password resets, wildcard CORS, lint exclusions, physical punch deletion, weak image decode and sandbox bypass. Repair with tests before exposing HR data. Current minute-resolution attendance arithmetic is intentionally retained despite stale older documentation.

## D007 — Local-only execution

No production credentials, data, deployments, pushes or tags. Existing workflows can auto-publish/roll out, so local branches/commits do not imply permission to push. Local scripts must reject non-loopback API/database targets and production mode. Test database cleanup must be restricted to explicit test databases.

## D008 — Runtime/environment evidence

Workstation has Node 24.18.1 and pnpm 11.21.0 under /Users/nycolazs/.nvm/versions/node/v24.18.1/bin; non-interactive shell PATH does not include them. Existing Homebrew PostgreSQL 16 is available; repository also specifies PostgreSQL 18 Docker. Record which engine is actually tested.
