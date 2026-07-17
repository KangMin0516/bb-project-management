# Core / Infrastructure Changelog

> Cross-cutting NestJS scaffolding: bootstrap, validation, guards, encryption, throttling, Prisma adapter, common module, and the deploy pipeline. Anything that is *not* a feature module but is depended on by every feature module.

## Owns

- **Bootstrap**: `packages/api/src/main.ts`, `packages/api/src/app.module.ts`
- **Common utilities**: `packages/api/src/common/` — guards (`JwtAuthGuard`, `ProjectMemberGuard`, `RolesGuard`, `SuperuserGuard`), decorators (`@Public`, `@Roles`, `@CurrentUser`), filters (`GlobalExceptionFilter`), interceptors (`TransformInterceptor`), `EncryptionService`, `constants.ts`
- **Persistence**: `packages/api/src/prisma/prisma.service.ts` (PrismaClient + `@prisma/adapter-pg`)
- **Schema**: `packages/api/prisma/schema.prisma`, all migrations under `packages/api/prisma/migrations/`
- **Workspace + Docker**: `pnpm-workspace.yaml`, `Makefile`, `docker-compose.yml`, `docker-compose.prod.yml`, `docker-compose.ci.yml`, `packages/api/Dockerfile`, `packages/web/Dockerfile`, `packages/web/nginx.conf`

## Surface

- **Global prefix**: `/api`
- **Swagger**: `GET /api/docs`
- **Rate limit**: 30 req / 60s / IP (`ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }])`)
- **CORS**: comma-separated `CORS_ORIGINS`, defaults to `http://localhost:5173`
- **Response envelope (success)**: `{ data: <payload> }` via `TransformInterceptor`
- **Response envelope (error)**: `{ statusCode, message, error }` via `GlobalExceptionFilter`
- **Schedulers root**: `ScheduleModule.forRoot()` — individual crons live in feature modules (see `issue/archive.scheduler.ts`, `standup/standup.scheduler.ts`, `report/report.scheduler.ts`)

## Timeline

### 2026-07-17 — Build + push images to GHCR in CI; server pulls instead of building
**Changed.** `deploy.yml` ran a single SSH job that did `git pull` + `docker compose build` on the production server itself — every deploy spent server CPU rebuilding both images with no addressable artifact to roll back to. Split into two jobs: `build-and-push` (GitHub-hosted runner, builds via the new `docker-compose.ci.yml`, tags `IMAGE_TAG=${{ github.sha }}`, pushes to `ghcr.io`) and `deploy` (`needs: build-and-push`, SSH job, now pulls the tagged images instead of building). `docker-compose.prod.yml`'s `app`/`web` services now reference `image: ghcr.io/seo-burning/bbpm-{api,web}:${IMAGE_TAG}` instead of `build:`. No new secrets required — GHCR auth uses the workflow's own auto-issued `secrets.GITHUB_TOKEN` (scoped via each job's `permissions:` block: `packages: write` for `build-and-push`, `packages: read` for `deploy`), streamed to the server over SSH for a `docker login`/`pull`/`logout` cycle and never persisted there.
- Source: `.github/workflows/deploy.yml`, `docker-compose.prod.yml`, `docker-compose.ci.yml`.

### 2026-04-23 — Migration idempotency hardening (09f8c4f)
**Fixed.** A failed prod deploy was traced to a non-idempotent migration. Re-ran the migration step on existing rows with safe `IF NOT EXISTS` / re-checked guards.
- Source: `packages/api/prisma/migrations/`.

### 2026-04-23 — ANTHROPIC_API_KEY plumbed through deploy pipeline (d3d64f9)
**Changed.** The quick-issue feature needs `ANTHROPIC_API_KEY` at runtime. Added the env var to `docker-compose.prod.yml`, `.env.example`, and the production env requirements documented in `Makefile`.
- Source: `docker-compose.prod.yml`, `.env.example`.

### 2026-04-18 — Security + performance pass after code review (a5611b3)
**Fixed.** Resolved a batch of code-review findings across the backend and frontend: tightened input validation on a few DTOs, removed an N+1 in the dashboard aggregator, added missing `await` on a few fire-and-forget paths, and corrected guard order on several controllers.
- Source: cross-cutting; see commit diff.

### 2026-04-17 — Cross-cutting refactor + dark-mode prep (bfaf239)
**Changed.** Project-wide refactor to consolidate `USER_SELECT`, `ISSUE_MAX_PER_COLUMN`, `NOTIFICATION_LIMIT`, and other magic numbers into `packages/api/src/common/constants.ts`. Frontend gained `lib/utils.ts` and consistent `cn()` helper.
- Source: `packages/api/src/common/constants.ts`, `packages/web/src/lib/utils.ts`.

### 2026-04-06 — Initial Prisma schema (Schema: `20260406080645_init`)
**Schema.** Initial schema with `users`, `projects`, `project_members`, `issues`, `labels`, `issue_labels`, `activities`, `api_keys`. UUID primary keys. snake_case column mapping via `@map`. Standard `created_at` / `updated_at` pair on every model.
- Migration: `20260406080645_init`.

### 2026-04-06 — Cascade + SET NULL onDelete policies (Schema: `20260406092530_add_on_delete_policies`)
**Schema.** Codified ON DELETE behavior: project members and labels cascade with the parent project; user-attributed records (`activities.user_id`, `comments.user_id`) set to NULL on user deletion so the audit trail survives.
- Migration: `20260406092530_add_on_delete_policies`.

### 2026-04-06 — NestJS bootstrap (init commit)
**Added.** App skeleton: `NestFactory.create(AppModule, { rawBody: true })` (raw-body capture needed for Slack and GitHub webhook signature verification later), `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true`, global exception filter, transform interceptor, Swagger module mounted at `/api/docs`, throttler at 30/60s.
- Source: `packages/api/src/main.ts`, `packages/api/src/app.module.ts`.

## Open questions / known issues

- **R1 — In-process schedulers (no leader election).** All `@Cron` decorators run inside the API container. A second replica would double-fire every job. Currently mitigated by deploying exactly one replica. See [`docs/ARCHITECTURE.md` §13](../ARCHITECTURE.md#13-risk-register).
- **R10 — No centralized observability.** Only Docker JSON-file logs (10MB × 3 per container). No metrics, no traces, no log aggregator. See `docs/ARCHITECTURE.md` §13.
- **R3 — Symmetric encryption with one env-managed key.** `EncryptionService` uses `ENCRYPTION_KEY` directly; no KMS, no rotation. See `docs/ARCHITECTURE.md` §9.3.
