# PH-Ponto Development Environments

## Required local tooling

- Node.js 24 LTS-compatible runtime
- Corepack-managed pnpm
- Docker Desktop with Docker Compose
- Git

The repository will pin pnpm through `packageManager` and Node through `engines`. Environment variables are validated at process startup. `.env.example` documents names only and contains no usable secret.

## Validated commands

```bash
pnpm install
docker compose up -d --build
pnpm dev
pnpm dev:api
pnpm dev:desktop
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
pnpm build:api
pnpm build:desktop
pnpm check
pnpm e2e:install
pnpm audit --audit-level=high
pnpm db:migrate
pnpm db:migrate:deploy
pnpm db:seed
```

`pnpm db:migrate` uses non-destructive deployment semantics for the normal startup workflow; `pnpm db:migrate:dev` is reserved for intentionally creating a new development migration. The integration command creates and migrates only a database whose name ends in `_test`; its local default is `ph_ponto_test`. The seed is idempotent: it creates the first active ADMIN only when one does not exist and creates the immutable seven-day baseline schedule only when no schedule exists. `PROJECT_PROGRESS.md` remains authoritative for the latest executed checks and environment caveats.

`pnpm dev` launches the Electron client against the Compose API, so the documented `docker compose up -d --build` followed by `pnpm dev` has no port collision. `pnpm dev:api` is the source-level backend watcher for API development; stop the Compose API service and provide a local `.env` before using it.

## Configuration contract

- `DATABASE_URL`: PostgreSQL connection URL. Compose publishes PostgreSQL on loopback port `55432` by default to avoid conflicting with a local macOS PostgreSQL service.
- `API_PORT`: listening port, default 3000 for local development.
- `JWT_SECRET` and `JWT_REFRESH_SECRET`: independent high-entropy signing secrets.
- `JWT_ISSUER`, `JWT_AUDIENCE`, and `JWT_ACCESS_TTL_SECONDS`: strict access-token identity and bounded lifetime.
- `REFRESH_IDLE_TTL_SECONDS` and `REFRESH_ABSOLUTE_TTL_SECONDS`: rotating-session idle and absolute limits.
- `AUTH_LOGIN_WINDOW_SECONDS`, `AUTH_LOGIN_MAX_ATTEMPTS`, and `AUTH_LOGIN_BLOCK_SECONDS`: database-backed brute-force controls.
- `APP_TIMEZONE`: required to be `America/Sao_Paulo` initially.
- `INITIAL_ADMIN_USERNAME` and `INITIAL_ADMIN_PASSWORD`: seed-only initial admin input.
- `API_BASE_URL`: renderer/API base URL selected per environment.
- `UPLOAD_DIR`: fixed avatar storage root, `/data/uploads` in the API container.

Local Compose will persist named PostgreSQL and upload volumes. Production-like containers use restart policies and readiness health checks. The Electron development process runs on macOS; the distributable target is Windows x64 through GitHub Actions.

The repository sets `trustLockfile: true` for frozen installs. PH-Ponto is an internal, private application and the committed lockfile is treated as reviewed source; dependency changes still pass the 24-hour release-age policy when the lockfile is generated, and CI runs the high-severity audit gate.
