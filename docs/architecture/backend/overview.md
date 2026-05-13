# Overview

A NestJS 11 application that exposes a versioned REST API at `/api/*`, plus a
Swagger UI at `/api/docs`, plus three cron schedulers, all backed by Prisma 6
over Postgres. Slack and GitHub are wired in as side channels; S3 is the only
external storage layer.

```
                ┌────────────────────────────────────────────────────────┐
                │                       main.ts                          │
                │   • global prefix /api                                 │
                │   • CORS (CORS_ORIGINS)                                │
                │   • ValidationPipe (whitelist + transform)             │
                │   • GlobalExceptionFilter                              │
                │   • TransformInterceptor → { success, data }           │
                │   • Swagger at /api/docs                               │
                └──────────────────────────┬─────────────────────────────┘
                                           │ bootstraps
                ┌──────────────────────────▼─────────────────────────────┐
                │                    AppModule                           │
                │   30 feature modules + ConfigModule + ScheduleModule   │
                │   + ThrottlerModule(30/min)                            │
                │   APP_GUARDs: JwtAuthGuard (global) + ThrottlerGuard    │
                └─────┬──────────────┬──────────────┬──────────────┬─────┘
                      │              │              │              │
              ┌───────▼────┐  ┌──────▼─────┐  ┌─────▼──────┐  ┌────▼──────┐
              │ Controllers│  │  Services  │  │ Schedulers │  │ Webhooks  │
              │ (HTTP)     │→ │ (domain    │← │  @Cron     │  │ /external │
              │            │  │  logic)    │  │            │  │ /slack    │
              └────────────┘  └─────┬──────┘  └────────────┘  │ /standup  │
                                    │                          │ /github   │
                                    ▼                          └───────────┘
                              ┌────────────┐
                              │PrismaService│ → Postgres (PrismaPg adapter)
                              │ S3Client    │ → AWS S3 (avatars, attachments)
                              │ WebClient   │ → Slack Web API
                              │ EncryptSvc  │ → AES-256-CBC (Slack token + creds)
                              └────────────┘
```

## The three global cross-cutting providers

Every request goes through all three, in this order:

1. **`JwtAuthGuard`** (`common/guards/jwt-auth.guard.ts`) — registered as
   `APP_GUARD`. Extends `AuthGuard('jwt')`. Skipped when the handler or its
   class is decorated with `@Public()`. Used by the external API
   (`/api/external/*`) which authenticates via API key instead.
2. **`ThrottlerGuard`** — also registered as `APP_GUARD`. 30 requests per
   60-second window per IP. Configured in `app.module.ts`:
   `ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }])`.
3. **`TransformInterceptor`** — wraps every controller return value in
   `{ success: true, data: <value> }`. The frontend's `apiClient.ts` unwraps
   `data` automatically.

Plus on the error path:

4. **`GlobalExceptionFilter`** — catches everything. Maps Prisma
   `P2002 → 409`, `P2003 → 400`, `P2025 → 404`. Returns
   `{ success: false, statusCode, message, timestamp }` so the frontend can
   show a useful toast.

## What lives in each layer

| Layer | Where | Responsibility |
|---|---|---|
| **Bootstrap** | `main.ts` | Global config: prefix, CORS, pipes, filter, interceptor, Swagger. Nothing domain. |
| **Module wiring** | `app.module.ts`, `<feature>/<feature>.module.ts` | Declare providers, controllers, exports. Cross-module deps come in via `imports: [...]`. |
| **Cross-cutting infra** | `common/` | Guards, decorators, filters, interceptors, encryption, constants. No domain. |
| **Auth** | `auth/` | Login, register, refresh, change-password, update-profile. Issues JWT + refresh-token pair. |
| **Domain modules** | `<feature>/<feature>.service.ts` | All business logic, all Prisma access. Controllers thin. |
| **Persistence** | `prisma/prisma.service.ts` + `generated/prisma/*` | Single `PrismaClient` extension, `OnModuleInit` connects, `OnModuleDestroy` disconnects. Adapter: `PrismaPg`. |
| **Side channels** | `slack/`, `github/`, `upload/` | Encapsulate the SDKs (`@slack/web-api`, `@octokit/*`, `@aws-sdk/client-s3`). |
| **Schedulers** | `issue/archive.scheduler.ts`, `standup/standup.scheduler.ts`, `report/report.scheduler.ts` | `@Cron()` declarations on `@Injectable()` classes. Wired into the relevant module's `providers`. |

The dependency direction is one-way:

```
controllers → services → (prisma + side channels)
                  ↑
                  └─ schedulers (call services on cron)
```

Controllers never reach into another module's service directly — they go
through that module's `imports`. Services may import other modules' services
when the module exposes them via `exports`. There are several intentional
cross-module dependencies:

| Module | Imports | Why |
|---|---|---|
| `IssueModule` | `NotificationModule`, `IssueLinkModule` | Schedule assignment DMs; link dependencies. |
| `NotificationModule` | `SlackModule` | DM delivery via `SlackService.sendDirectMessage`. |
| `ReportModule` | uses `SlackService`, `PrismaService` | Cron sends digests to Slack. |
| `StandupModule` | `SlackModule`, `NotificationModule` | Bot prompts + responses. |
| External / API key | `ApiKeyModule` (exports both `ApiKeyService` and `ApiKeyGuard`) | External API auth. |

## Request lifecycle

A typical authenticated `PATCH /api/projects/:projectId/issues/:issueId`:

```
1. CORS preflight (main.ts enableCors)
2. ThrottlerGuard          → 429 if over 30/min
3. JwtAuthGuard            → 401 if no/invalid Bearer; sets req.user = { sub, email }
4. ValidationPipe          → 400 if DTO has unknown / wrong-typed fields
5. ProjectMemberGuard      → 403 if not a member; resolves project key → UUID;
                             attaches req.projectMember + req.isSuperuser
6. (optional) RolesGuard   → reads @Roles() metadata, checks against req.projectMember
7. Controller handler      → IssueController.update(...)
8. Service                 → IssueService.update(...)
9. Prisma                  → SQL roundtrip via PrismaPg
10. Transactional side effects:
    • Activity rows                       (coalesced if within 10s window)
    • notificationService.scheduleAssignmentNotification (deferred 10s)
11. TransformInterceptor   → { success: true, data: <issue> }
   ── OR on error ──
12. GlobalExceptionFilter  → { success: false, statusCode, message, timestamp }
```

## Data layer

- **Prisma client** is *generated* into `packages/api/generated/prisma/`,
  imported as `from '../../generated/prisma/client.js'`. Custom output path
  keeps the generated code out of `node_modules` and makes the import path
  stable across the monorepo.
- **`PrismaPg` adapter** is used instead of the default Prisma engine. This
  gives us node-postgres compatibility (connection pooling, listen/notify if
  ever needed) and works without the Rust-based query engine binary.
- **29 migrations** in `packages/api/prisma/migrations/`. The naming is
  date-prefixed (`YYYYMMDDHHMMSS_<slug>`). Never edit a migration that's
  already been applied to staging or prod — generate a new one.
- **All Prisma access lives in `<feature>.service.ts`**. There are no
  shared "repositories" on the backend (unlike the frontend's repository
  pattern). Services *are* the persistence boundary.

## External integrations

| Integration | Module | SDK | Auth |
|---|---|---|---|
| **Slack** | `slack/`, used by `notification/`, `report/`, `standup/` | `@slack/web-api` | Bot token, encrypted at rest |
| **GitHub** | `github/` | `@octokit/rest`, `@octokit/webhooks` | PAT (per integration) |
| **S3** | `upload/` | `@aws-sdk/client-s3` | Env-configured IAM keys |
| **External API consumers** | `external/`, `api-key/` | — | API key in `X-API-Key` header (hashed at rest) |

## Schedulers

Three classes, each registered as a provider on its owning module:

| Cron | Class | What it does |
|---|---|---|
| `0 0 3 * * *` (daily 3 AM) | `ArchiveScheduler` | Archives `DONE`/`CANCELED` issues older than 3 days. |
| `0 * * * * *` (every minute) | `ReportScheduler.checkAndSendReports` | Per-project morning/lunch/evening Slack digests. Tz-aware, dedup by `lastSent`. |
| `0 30 7/17 * * 1-5` (Asia/Seoul) | `ReportScheduler.send{Morning,Evening}Digest` | Management daily digest. |
| `0 * * * * *` (every minute) | `StandupScheduler.checkAndTriggerStandups` | Per-config standup trigger, tz-aware. |
| `0 */5 * * * *` (every 5 min) | `StandupScheduler.checkReminders` | Pokes users who haven't answered. |

All schedulers wrap their work in `try/catch` and log to `Logger` — a thrown
error from `@Cron` doesn't get retried, so swallowing-and-logging is the
correct stance.

## Known constraints

- **Pending notification timers are in-memory only.** A restart drops them.
  Acceptable because the window is 10 seconds; not acceptable if we ever
  extend the grace period.
- **No connection-pool sizing config.** The PrismaPg adapter uses the
  `pg` default pool (10 connections). If the API ever scales horizontally,
  revisit this.
- **`projectId` URL params accept both key and UUID** because legacy clients
  and the SPA both rely on it. The `ProjectMemberGuard` mutates
  `request.params.projectId` so downstream services see only UUIDs. If you
  bypass that guard, you also bypass the resolution — that's the bug that
  caused the May 2026 "Project not found on Settings update" incident
  (`docs/architecture/frontend/refactor-2026-05-changelog.md`).
- **`ValidationPipe` is `whitelist: true, forbidNonWhitelisted: true`.**
  Any DTO property the client sends that isn't declared on the DTO class is
  a `400`. Don't be tempted to relax this — it's load-bearing for the audit
  surface.
