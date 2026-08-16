# PH-Ponto

Internal employee attendance and working-hour management system for **PH Motopeças**.

The repository is a pnpm monorepo with a NestJS/PostgreSQL API, a secure Electron shell, a React/Vite renderer, and shared TypeScript contracts. Development is proceeding through the controlled phases recorded in [`PROJECT_PROGRESS.md`](./PROJECT_PROGRESS.md); do not interpret the current foundation as a completed attendance product.

## Requirements

- Node.js 24 or newer
- pnpm 11.21.0 through Corepack
- Docker with Docker Compose
- macOS for the primary development workflow

## Local startup

```bash
pnpm install --frozen-lockfile
docker compose up -d --build
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The API is available at `http://localhost:3000`, PostgreSQL is published on loopback port `55432`, and the Electron renderer development server uses `http://localhost:5173`.

Copy `.env.example` to `.env` before changing local defaults. Never reuse example credentials in production.

## Validation

```bash
pnpm check
pnpm test:integration
pnpm e2e:install
pnpm test:e2e
pnpm audit --audit-level=high
```

The integration suite requires PostgreSQL. Locally it creates and migrates the isolated `ph_ponto_test` database through the Compose server on port `55432`; it refuses database names that do not end in `_test`. CI supplies its own isolated database URL. `pnpm e2e:install` installs the pinned Chromium build into the ignored project cache.

## Architecture and continuity

- [`AGENTS.md`](./AGENTS.md) contains permanent engineering rules.
- [`PROJECT_PROGRESS.md`](./PROJECT_PROGRESS.md) is the authoritative operational handoff.
- [`docs/architecture.md`](./docs/architecture.md) describes system boundaries.
- [`docs/domain-model.md`](./docs/domain-model.md) defines attendance and persistence semantics.
- [`docs/security-model.md`](./docs/security-model.md) records the threat model and controls.

The PH Motopeças logo asset has not yet been supplied. The current UI uses a temporary text mark only and must not be treated as final branding.
