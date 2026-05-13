# Project Configuration

This file is the **single source of truth** for project environment information used by every Claude Code agent and slash command in `.claude/`.

> **Read this first.** Every agent (`.claude/agents/*.md`) and every command (`.claude/commands/*.md`) begins by reading this file. Hard-coding paths, ports, or commands anywhere else is a bug. If a value is wrong here, fix it here — do not patch it downstream.

---

## Project Info

- **project_name**: `bb-pm` (BB Project Management)
- **project_description**: Self-hosted, Jira-style project management platform with deep Slack integration, GitHub PR sync, LLM-assisted quick-issue capture, and a public AI-system REST API. TypeScript pnpm monorepo.
- **project_root**: `/Users/vanthuongdao/Documents/BurningBros/bb-project-management`
- **package_manager**: `pnpm` (workspace defined in `pnpm-workspace.yaml`)
- **node_version**: `>=22`
- **architecture_doc**: `docs/ARCHITECTURE.md` (the canonical "where we are" map)

---

## Services

The monorepo has three workspace packages under `packages/*` and one Postgres container.

### web (frontend)
- **path**: `packages/web/`
- **stack**: React 19 + Vite 8 + Tailwind CSS v4 + React Router 7 + Zustand 5 + @tanstack/react-query 5 + Tiptap 3 + axios
- **port (dev)**: `5173` (Vite dev server with `/api` proxy → `http://localhost:3002`)
- **port (prod)**: `3000` (nginx serving `dist/` + reverse-proxying `/api` → `app:3000`)
- **build_cmd**: `pnpm --filter @bb-pm/web build` (runs `tsc -b && vite build`)
- **lint_cmd**: `pnpm --filter @bb-pm/web lint`
- **typecheck_cmd**: `pnpm --filter @bb-pm/web exec tsc -b --noEmit`
- **test_cmd**: _none configured — frontend has no unit tests today_
- **dev_cmd**: `pnpm dev:web` (== `pnpm --filter @bb-pm/web dev`)

### api (backend)
- **path**: `packages/api/`
- **stack**: NestJS 11 (ESM) + Prisma 7 (with `@prisma/adapter-pg`) + Passport JWT + `@nestjs/schedule` + `@nestjs/swagger` + `@nestjs/throttler` + AWS S3 SDK + `@slack/web-api` + Anthropic SDK
- **port (dev)**: `3002` (host port; container internal `3000`)
- **port (prod)**: `3000` (container internal; not exposed on host — only reachable via nginx in `web` container)
- **build_cmd**: `pnpm --filter @bb-pm/api build` (runs `nest build`)
- **lint_cmd**: `pnpm --filter @bb-pm/api lint`
- **typecheck_cmd**: `pnpm --filter @bb-pm/api exec tsc --noEmit -p tsconfig.json`
- **test_cmd**: `pnpm --filter @bb-pm/api test` (Jest, `testRegex: .*\.spec\.ts$`)
- **test_e2e_cmd**: `pnpm --filter @bb-pm/api test:e2e`
- **dev_cmd**: `pnpm dev:api` (== `pnpm --filter @bb-pm/api start:dev`)
- **swagger_url**: `http://localhost:3002/api/docs`

### shared (workspace package)
- **path**: `packages/shared/`
- **stack**: pure TypeScript types (compiled with `tsc`)
- **build_cmd**: `pnpm --filter @bb-pm/shared build`
- **dev_cmd**: `pnpm --filter @bb-pm/shared dev` (tsc watch)

### db (Postgres)
- **type**: PostgreSQL 16 (`postgres:16-alpine`)
- **port (dev)**: `5433` (host) → `5432` (container)
- **managed_by**: Docker Compose (`docker-compose.yml` for dev, `docker-compose.prod.yml` for prod)
- **default_creds (dev)**: `bbpm` / `bbpm_secret` / db `bbpm_db`
- **connection_url (dev)**: `postgresql://bbpm:bbpm_secret@localhost:5433/bbpm_db`
- **migrate_cmd**: `pnpm db:migrate` (== `pnpm --filter @bb-pm/api db:migrate`)
- **seed_cmd**: `pnpm db:seed`
- **studio_cmd**: `pnpm db:studio` (Prisma Studio on `http://localhost:5555`)
- **schema_file**: `packages/api/prisma/schema.prisma`
- **migrations_dir**: `packages/api/prisma/migrations/` (29 migrations at time of writing)

---

## Infrastructure

- **orchestration**: Docker Compose
- **dev_config**: `docker-compose.yml` (db only — api/web run on host via `pnpm dev`)
- **prod_config**: `docker-compose.prod.yml` (db + app + web/nginx)
- **start_cmd**: `make dev` (== `docker compose up -d` + boots only the db; you run `pnpm dev` on host for api/web)
- **stop_cmd**: `make dev-down`
- **build_cmd**: `make dev-build` (rebuilds all dev images)
- **prod_start_cmd**: `make prod` (requires `JWT_SECRET`, `ADMIN_PASSWORD`, `POSTGRES_PASSWORD` in `.env`)
- **prod_stop_cmd**: `make prod-down`
- **logs_cmd**: `make logs` / `make logs-be` / `make logs-fe` / `make logs-db`
- **shell_cmd**: `make shell` (sh inside `app` container) / `make shell-db` (`psql`)
- **clean_cmd**: `make clean` (down + volumes — **destructive, confirm before running**)

> **Networking note.** In dev, the frontend runs on the **host** (`vite` on `:5173`) and proxies `/api/*` to the backend on the **host** (`:3002`). In prod, the frontend runs in nginx inside Docker (`web` container on `:3000`) and proxies `/api/*` to `app:3000` over the `bbpm-network` Docker bridge.

---

## Auth

### Interactive (browser → web → api)
- **method**: JWT bearer (HS256) + refresh token rotation
- **access_token_lifetime**: configured via `JWT_EXPIRES_IN` (default `1h`)
- **refresh_token_storage**: bcrypt-hashed UUID in `users.refresh_token` (**single slot per user** — second login invalidates the first)
- **login_endpoint**: `POST /api/auth/login`
- **login_content_type**: `application/json`
- **login_body**: `{"email": "<email>", "password": "<password>"}`
- **login_response**: `{"data": {"accessToken": "<jwt>", "refreshToken": "<userId:uuid>", "user": {...}}}`
- **refresh_endpoint**: `POST /api/auth/refresh` with `{"refreshToken": "<userId:uuid>"}`
- **default_account (seeded)**: `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env` (default `admin@burningb.com` / `changeme123`)

### Programmatic (AI agents, integrations)
- **method**: API key in `X-API-Key` header
- **key_format**: `bbpm_<56 hex chars>` (raw shown once on creation)
- **storage**: bcrypt hash + 8-char unencrypted `keyPrefix` index for fast lookup
- **endpoints**: `/api/external/*` (controllers in `packages/api/src/external/`)
- **management endpoint**: `POST/GET/DELETE /api/api-keys` (JWT-authenticated)

### Token-acquisition snippet
Used by agents (see `.claude/shared/procedures.md`):
```bash
TOKEN=$(curl -s -X POST http://localhost:3002/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@burningb.com","password":"changeme123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")
```

---

## API

- **base_url (dev)**: `http://localhost:3002`
- **base_url (prod)**: depends on `FRONTEND_URL` / nginx host
- **prefix**: `/api` (set globally in `packages/api/src/main.ts` via `app.setGlobalPrefix('api')`)
- **frontend_url (dev)**: `http://localhost:5173`
- **frontend_url (prod)**: `http://localhost:3000` (or whatever the nginx host maps to)
- **swagger**: `http://localhost:3002/api/docs`
- **rate_limit**: 30 requests / 60s per IP (global `ThrottlerGuard`)
- **cors_origin**: `CORS_ORIGINS` env var (comma-separated; default `http://localhost:5173`)
- **response_envelope**: every successful response is `{"data": <payload>}` (`TransformInterceptor`); errors are `{"statusCode", "message", "error"}` (`GlobalExceptionFilter`)

---

## CI/CD

- **enabled**: `true`
- **tool**: GitHub Actions
- **repo_url**: `https://github.com/seo-burning/bb-project-management`
- **default_branch**: `main`
- **branch_strategy**: feature branch → PR → CI checks → merge to `main`
- **branch_prefix**: `feat/`, `fix/`, `refactor/`, `chore/`, `docs/`
- **pr_base_branch**: `main`
- **deploy_trigger**: merge to `main` (handled by the GitHub Actions workflow under `.github/`)
- **pipeline_url**: `https://github.com/seo-burning/bb-project-management/actions`
- **status_check_cmd**: `gh run list --limit 5`
- **pr_checks_cmd**: `gh pr checks <pr-number>`

> **`enabled: false`** triggers `/5-deploy` to abort with a CI/CD-not-configured warning. Manual deploys are **not** permitted in this repo.

### Required CLI tools for deploy
- `gh` — GitHub CLI (`brew install gh` on macOS). Verify with `gh --version`.
- `git` — must be on a clean working tree before `/5-deploy` runs.

---

## E2E / Browser Automation

- **tool**: Claude in Chrome (MCP) — `mcp__claude-in-chrome__*` tools
- **required**: `true` (Stage 4 will not pass without it)
- **e2e_entry_url (dev)**: `http://localhost:5173`
- **e2e_entry_url (prod)**: configured via `FRONTEND_URL`
- **login_flow**:
  1. Navigate to `e2e_entry_url`.
  2. On the login page, enter the seeded admin credentials (`default_account`).
  3. Submit and assert redirect to `/` (Global Dashboard) without console errors.
- **critical_paths** (verified on every test/verify run):
  1. **Login → Global Dashboard** loads with no console errors.
  2. **Create a project** via `/projects/new`, verify it appears in `/projects`.
  3. **Create an issue** on the project board (`/projects/:projectId/board`), verify it appears in the BACKLOG column.
  4. **Drag-reorder issue** from BACKLOG → TODO → IN_PROGRESS, verify status change persists after refresh.
  5. **Open issue detail panel**, post a comment, verify it appears in the activity feed.
  6. **Open Timeline view** (`/projects/:projectId/timeline`), verify horizontal/vertical scroll sync.
  7. **Open Specifications view** (`/projects/:projectId/specs`), create a new spec, verify markdown render.
  8. **Logout**, verify redirect to `/login` and that `localStorage` is cleared.
- **console_error_policy**: zero console errors required for PASS. Warnings are tolerated; errors of any severity fail the test.
- **gif_recording**: `true` — record critical paths as GIFs into `.claude/outputs/` for evidence.

> **Failure mode.** If the Chrome extension is not connected, the QA agent must warn the user, request activation, and **not** mark QA as PASS. Skipping E2E silently is forbidden.

---

## Conventions

- **commit_prefix**: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`, `perf`
- **commit_format**: `<prefix>: <short imperative summary>` (one line, ≤72 chars)
- **typescript_style**: `camelCase` for functions/variables, `PascalCase` for components/types/classes, `SCREAMING_SNAKE_CASE` for module-level constants
- **prisma_style**: model names `PascalCase`, columns `camelCase` in TS / `snake_case` in DB via `@map`, tables `snake_case_plural` via `@@map`
- **nest_module_layout**: each feature module is a directory under `packages/api/src/<feature>/` with `<feature>.module.ts`, `<feature>.controller.ts`, `<feature>.service.ts`, optional `<feature>.scheduler.ts`, `dto/`, `formatters/`, `parsers/`
- **frontend_layout**: pages under `packages/web/src/pages/`, route-shared components under `packages/web/src/components/<domain>/`, axios per-domain modules under `packages/web/src/api/`, Zustand stores under `packages/web/src/stores/`
- **import_order**: (1) node built-ins, (2) third-party packages, (3) `@bb-pm/*` workspace, (4) `@/...` aliased internal, (5) relative `./`/`../`
- **error_handling**: throw `NestException` subclasses (`BadRequestException`, `NotFoundException`, `ForbiddenException`, `UnauthorizedException`, `ConflictException`) — `GlobalExceptionFilter` shapes the response
- **secrets**: never commit `.env`; encrypted Slack/GitHub tokens use `EncryptionService` (AES-256-CBC, key from `ENCRYPTION_KEY`)
