# BB Project Management (`bb-pm`)

Self-hosted, Jira-style project management platform with deep Slack integration, GitHub PR sync, LLM-assisted quick-issue capture, and a public AI-system REST API.

Built as a TypeScript pnpm monorepo: **NestJS + Prisma + Postgres** backend, **React 19 + Vite + Tailwind v4** frontend. Designed to be the single source of truth for issues, specifications, daily reports, and standups for a ~20-person engineering team across multiple projects.

> See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the canonical map of modules / layers / data flow. See [`docs/PRD.md`](./docs/PRD.md) for the original product brief.

---

## Why this exists

Replace Jira with something that:

- **Costs nothing per-seat** — self-hosted, single Postgres, single Node process.
- **Removes the "where do I write this?" thrash** — chat (Slack), code (GitHub), tickets (this app), and specs are tied together by issue keys, PR links, and standup answers. One issue is the spine; everything else hangs off it.
- **Speaks to AI systems by default** — a stable `X-API-Key`-authenticated REST surface under `/api/external/*` lets internal AI agents read and write issues, specs, and links exactly the way a human can.
- **Is operationally boring** — no message broker, no Elastic, no Redis, no CDN, no SSO. One Docker Compose, three containers (`db`, `app`, `web/nginx`).

Out of scope (intentional): SSO/SAML, WebSocket/SSE real-time push, search engine, multi-region, background-job queue. Cron-driven polls cover everything async.

---

## Feature set

### Project & issue tracking
- Hierarchical issues: **EPIC → TASK / BUG → SUB_TASK**, with `parentId` constraints enforced at the use-case layer.
- Statuses: `BACKLOG / TODO / IN_PROGRESS / REVIEW_QA / DONE / CANCELED`. Priorities: `HIGH / MEDIUM / LOW`. Recheck flag on `IN_PROGRESS` for QA bounce-backs.
- Per-issue: assignee, reviewer, labels, components, dependencies (`BLOCKS`, `RELATES_TO`, `DUPLICATES`, …), attachments (S3-backed), threaded comments with `@mention`, full activity log.
- Kanban order via `order` column; drag-to-reorder with optimistic UI; auto-archive of old DONE/CANCELED issues by a nightly cron.
- Bulk operations (status, priority, assignee, delete) over multi-select.

### Specifications (기획서)
- Markdown specs with inline section anchors.
- Bi-directional **issue ↔ spec links** so a feature ticket reads both ways (which spec section drives it, which tickets implement it).
- Threaded comments per spec section.

### Slack workflows
- **Daily project reports** — morning / lunch / evening digests posted to a Slack channel per project, configurable per timezone, with weekend skip and dedup-by-day. Backed by `report.scheduler.ts`.
- **Standup bot** — conversational, one-question-at-a-time DM flow. Configurable cron per team, configurable question list. Reminders for unanswered participants every 5 min.
- **Quick-issue from DM** — paste a free-form description; an Anthropic Claude call extracts title / type / priority / description and creates the issue in the right project.
- **Admin DM notifications** — join-request approvals, assignment changes, mentions, all delivered via `MessagingPort`.
- **Management digest** — twice-daily Asia/Seoul digest for stakeholders (morning 07:30, evening 17:30).

### GitHub PR sync
- PAT-based linking with HMAC-verified webhooks.
- Auto-link PRs to issues by parsing `PROJECT-123` keys from PR title / body / branch.
- Auto-transition issue status on PR `opened` / `merged`.

### Public AI-system API
- `X-API-Key` auth, separate from user JWT.
- Surface under `/api/external/*` for: list issues, create/update issue, attach labels/components, link specs, search.
- Designed for internal LLM agents — stable contract, JSON-friendly errors, no breaking changes outside major versions.

### Credentials vault
- Per-project secret store (AWS / GCP / DB / Slack tokens / custom).
- Encrypted at rest (AES-256-CBC, currently single `ENCRYPTION_KEY`; KMS envelope encryption is on the M5 roadmap).
- Per-entry "sensitive" flag toggles value masking in the UI.

---

## Quick start

```bash
# 1. Install dependencies
pnpm install

# 2. Start Postgres (uses docker-compose.yml — db on :5433)
docker compose up -d

# 3. Apply migrations + seed
pnpm db:migrate
pnpm db:seed   # creates admin@burningb.com / changeme123

# 4. Run both dev servers (web on :5173, api on :3002)
pnpm dev
```

Visit `http://localhost:5173` and sign in with the seeded admin.

Copy `.env.example` → `.env` and fill in:

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (default points at the compose db) |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Token signing |
| `ENCRYPTION_KEY` | AES key for the credentials vault and Slack/GitHub PAT storage |
| `SLACK_CLIENT_ID`, `SLACK_CLIENT_SIGNING_SECRET`, `SLACK_REDIRECT_URI` | Slack OAuth (workspace install) |
| `GITHUB_WEBHOOK_SECRET` | HMAC verification for inbound PR webhooks |
| `S3_*` | R2/S3 attachment + avatar storage |
| `ANTHROPIC_API_KEY` | Claude model for quick-issue extraction |

---

## Repository layout

```
packages/
  api/                          NestJS backend
    src/
      app.module.ts             — root module + cron scheduler registration
      common/
        ports/                  — vendor-neutral interfaces (MessagingPort, FileStoragePort, AiCompletionPort)
        guards/, decorators/    — JwtAuthGuard, ApiKeyGuard, role checks
      prisma/                   — PrismaService + module
      outbox/                   — transactional outbox infra (M2): repo, event bus, publisher, retention cron, admin health
      <domain>/                 — one folder per bounded context
        domain/                 — entities, value objects, events (migrated modules only — Issue, Project, JoinRequest)
        application/            — use cases, query services, ports
        infrastructure/         — Prisma repositories, vendor adapters
        *.controller.ts         — HTTP surface
        *.module.ts             — DI wiring
        *.scheduler.ts          — cron jobs (Report, Standup, Archive, Outbox)
    prisma/
      schema.prisma             — Prisma 7 schema, 29+ migrations
      seed.ts                   — admin + sample project seed
    test/
      app-boot.e2e-spec.ts      — DI graph smoke test (catches UnknownDependenciesException at CI time)
  web/                          React frontend
    src/
      app/                      — providers (QueryClient, Theme), router
      pages/                    — route components
      widgets/                  — top-level layout (sidebar, header)
      features/                 — feature modules (issue, project, standup, report, …)
        <feature>/
          api/                  — axios clients
          components/           — feature-specific UI
          hooks/                — feature-specific hooks
          repository/           — query-key conventions
      entities/                 — cross-feature read models (UserAvatar, UserPicker, …)
      shared/
        ui/                     — shadcn primitives (Dialog, Sheet, Select, DropdownMenu, Command, AlertDialog, ConfirmDialog, Button) + atoms
        lib/                    — utils, hooks (useDeferredClose, useOutsideClick, toast, theme)
        config/constants.ts     — STATUS_LABELS, PRIORITY_COLORS, TYPE_ICONS, …

docs/
  ARCHITECTURE.md               canonical "where we are" map (read this first)
  PRD.md                        original product brief
  IMPLEMENTATION_PLAN.md        sequenced delivery plan
  changelogs/                   per-domain changelogs (auth, issue, project, slack, …) — see docs/changelogs/README.md
  plans/                        feature design docs that survive across sessions

.claude/
  config.md                     single source of truth (ports, paths, commands) — every agent/command reads this first
  agents/                       9 sub-agent definitions (planner, implementer, code-reviewer, tester, …)
  commands/                     7 slash-command playbooks (/0-run … /6-verify, the lifecycle stages)
  skills/                       higher-level capabilities (architecture-doc-writer)
  shared/                       principles, procedures, templates referenced across agents

REFACTOR_PLAN.md                Clean Architecture refactor roadmap (M0 → M5)
REFACTOR_FROTEND_SPEC.md        frontend spec (shadcn migration scope)
AGENTS.md                       AI agent contract (vendor-neutral) — start here if you're an AI tool
CLAUDE.md                       Claude Code extensions on top of AGENTS.md
```

---

## Architecture in one screen

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Browser (React 19 + Vite + Tailwind v4 + shadcn/Radix)                   │
│  └─ @tanstack/react-query (cache + invalidation)                         │
│  └─ Zustand (UI state)                                                   │
│  └─ Tiptap (rich-text editor for descriptions, comments, specs)          │
│  └─ /api/*  ──► nginx (prod) / vite proxy (dev)                          │
└──────────────────────────────────────────────────────────────────────────┘
                                  │ HTTP + JSON
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ NestJS API (single Node process, port 3002)                              │
│                                                                          │
│  Controllers ── Use Cases ── Domain Entities                             │
│       │                │            │                                    │
│       │                ├─► Ports ───┴─► Adapters (Slack, S3, Anthropic)  │
│       │                │                                                 │
│       │                └─► Repositories ──► Prisma ──► Postgres          │
│       │                                                                  │
│       └─► Outbox publisher (5s cron) ──► registered handlers             │
│                                                                          │
│  Schedulers (in-process @nestjs/schedule):                               │
│   • Report (per-minute config check + 2× Asia/Seoul digests)             │
│   • Standup (per-minute trigger + 5-min reminder sweep)                  │
│   • Archive (3am daily — old DONE/CANCELED)                              │
│   • Outbox publisher (5s — drain pending events)                         │
│   • Outbox retention (3am daily — prune delivered > 30d)                 │
└──────────────────────────────────────────────────────────────────────────┘
       │                                                  │
       ▼                                                  ▼
┌──────────────┐                                  ┌──────────────────────┐
│ Slack Web API│  ◄── MessagingPort ──            │ Anthropic Claude API │
│ GitHub Webhk │                                  │ (quick-issue extract)│
└──────────────┘                                  └──────────────────────┘
       │
       ▼
┌──────────────┐
│ S3 / R2      │  ◄── FileStoragePort ──
│ (attachments)│
└──────────────┘
```

Detailed module map, sequence diagrams, and data-flow narratives live in [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) (~1200 lines).

---

## Tech stack

| Layer | Stack | Why |
|---|---|---|
| Backend framework | **NestJS 11** | DI, modules, guards, interceptors out of the box; ScheduleModule for cron; aligns with team patterns |
| ORM | **Prisma 7** | Type-safe, generated client, dev-friendly migrations |
| Database | **Postgres 16** | Single self-hosted instance; no replicas |
| Auth | JWT (Passport) + bcrypt + Argon2 refresh tokens | Stateless API; refresh-token rotation; superuser flag bypasses tenant guard |
| Frontend framework | **React 19 + Vite 8** | Fast HMR, modern compiler, JSX runtime defaults |
| Styling | **Tailwind v4 + shadcn primitives + Radix** | shadcn = Radix primitives + project-owned source files (in `shared/ui/`), styled with Tailwind tokens via CSS vars |
| Animation | `tw-animate-css` | Tailwind v4 replacement for `tailwindcss-animate`; powers all Radix overlay enter/exit |
| Editor | **Tiptap 3** | Rich-text for descriptions / comments / specs |
| Data fetching | **@tanstack/react-query 5** | Cache + invalidation + optimistic updates (board drag uses `onMutate` + `setQueriesData`) |
| Client state | **Zustand 5** | Tiny stores for theme, toast, shortcuts, image-preview |
| Integrations | Slack Web API · GitHub REST + Webhooks · S3 / R2 · Anthropic Claude | All abstracted behind ports in `common/ports/` |
| Tooling | pnpm workspaces · ESLint with `eslint-plugin-boundaries` (architectural rules) · Jest ESM |

---

## Common workflows

### Issue lifecycle
1. Author creates issue (UI / external API / Slack quick-issue).
2. `CreateIssueUseCase` validates parent-type rules, persists via `IssueRepository`, emits `IssueCreated` to outbox.
3. Outbox publisher drains every 5s; registered handlers fire: notification to assignee, Slack DM (flag-gated), activity log entry.
4. Status changes go through `UpdateIssueUseCase` → `ReorderIssueUseCase` (drag) or `BulkUpdateIssueUseCase` (multi-select).
5. Daily report cron picks up the issue's current status into the next morning/evening digest.
6. Archive cron sweeps DONE/CANCELED issues older than the configured threshold.

### Standup
1. Admin creates a `StandupConfig` per team (cron expression, timezone, channel, question list).
2. Per-minute scheduler computes "is it `cronHour`:`cronMinute` in `timezone` now and did we trigger today already?".
3. On trigger, the bot DMs every project member with question 1.
4. As each user replies, the bot stores the answer, asks the next question. Done responses summarize into the channel.
5. Every 5 min the reminder cron pokes anyone with `ACTIVE` (in-flight) or `AWAY` (no first reply yet) status.

### Daily report
1. Admin configures `DailyReportConfig` per project: timezone, 3 send times (morning / lunch / evening), Slack channel per slot, skip weekends.
2. Per-minute scheduler evaluates each config in its own timezone; on match, calls `ReportService.sendReport(projectId, 'morning' | 'lunch' | 'evening')` and updates `<slot>LastSent` for dedup.

### AI external API
1. Admin issues an API key in Settings → API Keys.
2. AI agent calls `POST /api/external/issues` with `X-API-Key`.
3. `ApiKeyGuard` resolves the key to a project scope; controller delegates to the same Use Case the UI uses.
4. Response is shaped for LLM consumption (no `null`-vs-`undefined` ambiguity, predictable error envelopes).

---

## Backend refactor in flight

The API is migrating from anemic services to Clean Architecture. Tracked in [`REFACTOR_PLAN.md`](./REFACTOR_PLAN.md):

| Milestone | Scope | Status |
|---|---|---|
| **M0** | Issue domain reference (entity + VOs + events), ESLint `eslint-plugin-boundaries`, Jest ESM | ✅ shipped |
| **M1** | Vendor ports — `MessagingPort` (Slack), `FileStoragePort` (S3), `AiCompletionPort` (Anthropic) — feature modules migrated off vendor SDKs | ✅ shipped |
| **M2** | Transactional outbox — schema, repo, event bus, publisher, retention cron, admin health endpoint; gated rollout of `IssueAssigned` + admin join-request DM | ✅ shipped |
| **M3** | Use-case migration: JoinRequest, Project, Issue (Phase 1 → 3); legacy `IssueService` deleted | ✅ shipped |
| **M4** | Service splits — `DashboardService` → 3 query services; `StandupConfigService` extracted | ✅ shipped |
| **M5** | Outbox production flags rollout, KMS envelope encryption for secrets, leader election for schedulers | 🚧 next |

Migrated modules use `domain/` + `application/` + `infrastructure/` layout. The legacy `*.service.ts` pattern is no longer accepted for migrated modules — see [`docs/ARCHITECTURE.md` §5](./docs/ARCHITECTURE.md) for the layering rules and [`AGENTS.md` §9](./AGENTS.md) for the hard rules.

---

## Common commands

```bash
# Monorepo root
pnpm dev                           # both servers in parallel
pnpm dev:api                       # api only (port 3002)
pnpm dev:web                       # web only (port 5173, proxies /api → 3002)
pnpm build                         # build both
pnpm lint                          # lint both
pnpm db:migrate                    # apply pending Prisma migrations
pnpm db:seed                       # seed admin + sample data
pnpm db:studio                     # Prisma Studio UI

# API only
pnpm --filter @bb-pm/api test              # unit tests
pnpm --filter @bb-pm/api test:e2e          # e2e (includes DI boot smoke test)
pnpm --filter @bb-pm/api build             # nest build
pnpm --filter @bb-pm/api db:migrate:dev    # create a new migration

# Web only
pnpm --filter @bb-pm/web build             # tsc + vite build
pnpm --filter @bb-pm/web lint              # eslint
pnpm --filter @bb-pm/web preview           # preview production build
```

---

## Configuration & deployment

- **Local dev**: docker-compose brings up Postgres only; the API and web run on host for faster HMR.
- **Production**: `docker-compose.prod.yml` builds three images — `db`, `app` (API), `web` (nginx serving the SPA + proxying `/api`).
- **Migrations** run automatically on API container start (`prisma migrate deploy`).
- **Cron schedulers run in-process** — do **not** scale the API replica count > 1 until M5 ships leader election (otherwise reports fire twice).

Env vars are documented in [`.env.example`](./.env.example) and consumed via NestJS's `ConfigModule` (`isGlobal: true`).

---

## Contributing

1. **Branch from `main`**: `feat/<scope>`, `refactor/<scope>`, or `fix/<scope>`.
2. **Read** [`.claude/shared/principles.md`](./.claude/shared/principles.md) before opening a PR.
3. **Update the matching changelog** in [`docs/changelogs/<domain>-changelog.md`](./docs/changelogs/) *in the same PR* — anchor to the commit hash and, for backend, the Prisma migration.
4. **CI gates**: `pnpm lint`, `pnpm build`, `pnpm --filter @bb-pm/api test`, `pnpm --filter @bb-pm/api test:e2e`.
5. **Commit format**: `type(scope): subject` — match the existing log style. Common types: `feat`, `fix`, `refactor`, `chore`, `test`, `docs`.

AI-assisted contributions follow the [agent contract](./AGENTS.md). Claude Code-specific extensions are in [`CLAUDE.md`](./CLAUDE.md).

---

## Documentation index

- **Architecture & design**
  - [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — module map, layers, data flow
  - [`docs/PRD.md`](./docs/PRD.md) — original product requirements
  - [`docs/IMPLEMENTATION_PLAN.md`](./docs/IMPLEMENTATION_PLAN.md) — sequenced delivery plan
  - [`REFACTOR_PLAN.md`](./REFACTOR_PLAN.md) — Clean Architecture refactor (M0–M5)
  - [`REFACTOR_FROTEND_SPEC.md`](./REFACTOR_FROTEND_SPEC.md) — frontend spec
- **Per-domain history** — [`docs/changelogs/`](./docs/changelogs/) ([index](./docs/changelogs/README.md))
- **Feature design docs** — [`docs/plans/`](./docs/plans/) ([index](./docs/plans/README.md))
- **AI agent contract** — [`AGENTS.md`](./AGENTS.md) · [`CLAUDE.md`](./CLAUDE.md)
- **Project conventions / ports / commands** — [`.claude/config.md`](./.claude/config.md)
- **Workspace READMEs** — [`packages/api/README.md`](./packages/api/README.md) · [`packages/web/README.md`](./packages/web/README.md)

---

## License

Internal Burningbros tool — not licensed for external distribution.
