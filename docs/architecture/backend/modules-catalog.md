# Modules Catalog

> Every module in `packages/api/src/`, with route prefix, public service
> exports, and intent. Scan this before adding a new module — chances are the
> domain you want already exists, or there's a closely related one you should
> extend instead.

Approximate sizes are line counts of the primary `*.service.ts` (Σ ≈ 8.7K
LOC). The four heaviest (dashboard, standup, issue, slack) carry most of the
business logic; everything else is thin CRUD plus side effects.

---

## Core infrastructure (no domain)

| Module | Service exports | Route | Intent |
|---|---|---|---|
| `CommonModule` (`@Global`)  | `EncryptionService` | — | AES-256-CBC for Slack tokens + project credentials. Plus guards, decorators, filters, interceptors, constants. |
| `PrismaModule`               | `PrismaService`     | — | Single `PrismaClient` extension. `OnModuleInit` connects, `OnModuleDestroy` disconnects. Uses `PrismaPg` adapter. |
| `AppController`              | —                   | `/`, `/health` | Liveness probe + root info. |

---

## Auth + identity

| Module | LOC | Route prefix | Intent |
|---|---:|---|---|
| `AuthModule`     | 180 | `auth`     | Register (pending-approval flow), login, refresh, change-password, update-profile, get-profile. Issues JWT (`JWT_EXPIRES_IN`, default 1h) + refresh token. Passport JWT strategy. |
| `UserModule`     | 222 | `users`    | Admin-facing user list + approve/reject/suspend/activate/update/reset-password/remove. Plus `me` endpoints. |
| `ApiKeyModule`   |  83 | `api-keys` | CRUD of API keys (per-user). Bcrypt-hashed at rest. Exports `ApiKeyGuard` for `ExternalModule`. |

---

## Project workspace

| Module | LOC | Route prefix | Intent |
|---|---:|---|---|
| `ProjectModule`        | 175 | `projects`                            | Create / list / get / update / delete projects. Bootstraps creator + all superusers as ADMIN. Seeds 6 default labels. `findOne` accepts UUID OR key; `update`/`remove` require UUID. |
| `ProjectMemberModule`  |  98 | `projects/:projectId/members`         | Add / remove / role-update members. |
| `JoinRequestModule`    | 298 | (mixed: `projects/.../join-requests` + `me/join-requests`) | Requester-side: create + cancel. Admin-side: list + approve + reject. Approval creates a notification. |
| `LabelModule`          |  99 | `projects/:projectId/labels`          | Per-project labels (CRUD + seed defaults). |
| `ComponentModule`      | 110 | `projects/:projectId/components`      | Per-project components (CRUD). Used as cross-cutting tagging. |

---

## Issue domain (the heaviest cluster)

| Module | LOC | Route prefix | Intent |
|---|---:|---|---|
| `IssueModule`         | 928 | `projects/:projectId/issues`                        | The big one. CRUD + bulk update + bulk delete + reorder. Activity logging (with 10s coalescing on assignee changes). Schedules assignment notifications. Auto-assigns unassigned children when parent assignee changes. Owns `ArchiveScheduler` (daily 3 AM archive of stale DONE/CANCELED). |
| `IssueLinkModule`     | 195 | `projects/:projectId/issues/:issueId/links`         | Issue ↔ issue links (BLOCKS, RELATES_TO, DUPLICATES, …). The strategy table for link directionality lives on the frontend (see `features/issue/strategy`); the backend stores raw source/target pairs. |
| `IssueSpecLinkModule` | 120 | `projects/:projectId/issues/:issueId/spec-links`    | Issue ↔ specification-section links. |
| `CommentModule`       | 188 | `projects/:projectId/issues/:issueId/comments`      | Threaded comments. Markdown body. Mention parsing → `MENTIONED` notification. |
| `ActivityModule`      |  42 | `projects/:projectId/activity`                      | Read-only activity feed (issue field changes). Writes happen inside `IssueService`. |
| `TemplateModule`      |  56 | `templates`                                         | Issue templates (admin-managed). |
| `QuickIssueModule`    | 193 | `quick-issue`                                       | Cross-project "quick add" — resolves project key, picks default values, creates the issue. |

---

## Specification domain

| Module | LOC | Route prefix | Intent |
|---|---:|---|---|
| `SpecificationModule` | 423 | `projects/:projectId/specifications` | Specs (markdown docs with sections). CRUD + reorder. Section-level comments lived here previously, now delegated to the frontend's spec link store. |

---

## Dashboards

| Module | LOC | Routes | Intent |
|---|---:|---|---|
| `DashboardModule` | 1137 | `projects/:projectId/dashboard`, `dashboard` (global + team) | Three controllers in one module: per-project stats, global "My Dashboard" cross-project query, team-wide view. Plus focus-date toggling. |
| `ReportModule`    |  294 (+ 318 digest + 5K scheduler) | `projects/:projectId/reports`, `admin/digest/*` | Daily report configs (morning/lunch/evening) per project. Tz-aware. Cron `0 * * * * *` checks every minute. Plus management digest (`Asia/Seoul` 7:30 / 17:30). |

---

## Slack integration

| Module | LOC | Route prefix | Intent |
|---|---:|---|---|
| `SlackModule` | 418 | `slack` | OAuth install/callback, channel + user list (cached 5min), `sendDirectMessage` (with retry on `ratelimited`), `sendMessage` to channels. Stores bot token encrypted via `EncryptionService`. |

Used by:
- `NotificationModule` — DMs for `ASSIGNED`, `REVIEWER_ASSIGNED`, `JOIN_APPROVED`, `JOIN_REJECTED`.
- `ReportModule` — Daily standup reports + management digest.
- `StandupModule` — Bot prompts via DM + responses via webhook.

---

## Standup

| Module | LOC | Routes | Intent |
|---|---:|---|---|
| `StandupModule` | 1057 (+ 4.3K scheduler + 5.6K webhook) | `standup`, `standup/webhook` | Per-config standup config (questions + cron-style time). Scheduler fires DM prompts; webhook receives responses (Slack Events API). Two crons: `checkAndTriggerStandups` (every minute, tz-aware) + `checkReminders` (every 5 min). |

---

## GitHub integration

| Module | LOC | Route prefix | Intent |
|---|---:|---|---|
| `GitHubModule` | 388 (+ 161 sync + 118 webhook) | `github` | Per-user PAT (encrypted). Sync PRs/issues into linked issues. Webhook for incoming push/PR events. |

---

## Attachments + uploads

| Module | LOC | Route prefix | Intent |
|---|---:|---|---|
| `UploadModule` | 263 | `upload` | Avatar upload (5 MB, jpg/png/webp). Issue/comment attachment (50 MB, blocked-ext list of executables + HTML/SVG). S3 PUT + DB row. Avatar served through a proxy URL `/api/upload/avatar/:userId` to keep S3 internal. |

---

## Notification + share

| Module | LOC | Route prefix | Intent |
|---|---:|---|---|
| `NotificationModule` | 273 | `notifications` | In-app notification list + unread count + mark-as-read. Deferred Slack DM delivery for assignment events (10s grace). Public `scheduleAssignmentNotification`/`cancelPendingAssignment` consumed by `IssueService`. |
| `ShareModule`        |  67 | `share`         | Generate / resolve share links for read-only issue views. |

---

## Cross-project endpoints

| Module | LOC | Route prefix | Intent |
|---|---:|---|---|
| `SearchModule`     |  32 | `search`     | Global search across issues + specs (Postgres ILIKE for now, see `docs/ARCHITECTURE.md` P-9 for the planned upgrade to full-text search). |
| `CredentialModule` | 149 | `projects/:projectId/credentials` | Per-project secret store. Each row has a JSON `entries[]` array; entries flagged `sensitive: true` are masked on read, revealed on a separate endpoint. |

---

## External API

| Module | LOC | Route prefix | Intent |
|---|---:|---|---|
| `ExternalModule` | 508 | `external` | API key-authenticated read/write surface for CI bots, scripts, MCP servers. Issues, specs, project digests. `@Public()` + `@UseGuards(ApiKeyGuard)`. |

---

## How to find things

- **"Where is `<endpoint>` handled?"** — `grep -r "<route segment>" packages/api/src/*.controller.ts`.
- **"What does `<service>` expose?"** — open `<module>/<module>.service.ts`, look at the public methods.
- **"What does this module need?"** — open `<module>.module.ts`, look at `imports: [...]` + `providers: [...]`.
- **"What does this module publish?"** — `exports: [...]` in the same file.
- **"Where do mutations to model X happen?"** — `grep -r "prisma\.<model>\." packages/api/src` (services are the only writers).

---

## Total

**30 feature modules** + 2 infrastructure modules (`Common`, `Prisma`).
Σ ≈ **8.7K LOC** of service logic. Three schedulers across the
issue/report/standup modules. One global guard chain (Throttler + JWT).

When you add a module here, also add it to:
1. `app.module.ts` (`imports`).
2. This catalog (one row, one-line intent).
3. The relevant `docs/changelogs/<domain>-changelog.md` entry once it ships.
