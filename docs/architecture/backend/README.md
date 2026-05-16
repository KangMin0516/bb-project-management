# Backend Architecture (`packages/api`)

> Living architecture reference for the NestJS API. Read this before touching a
> module, before introducing a new dependency, before adding a scheduler. The
> domain changelogs in `docs/changelogs/` cover *what shipped when*; these docs
> cover *how things are shaped and why*.

## Reading order

1. **[overview.md](./overview.md)** — the 30,000-foot view: how `main.ts`,
   `app.module.ts`, the three global cross-cutting providers (Guard, Filter,
   Interceptor), Prisma, and the scheduler all wire together.
2. **[folder-structure.md](./folder-structure.md)** — what lives inside a
   module folder, where to put `dto/`, `strategies/`, `formatters/`, and the
   one or two folders that deliberately break the rule.
3. **[patterns.md](./patterns.md)** — the recurring shapes you'll meet: layered
   guard composition, deferred-with-cancel Slack DMs, AES-256-CBC at rest,
   activity coalescing, tz-aware cron checks, the API-shape envelope.
4. **[modules-catalog.md](./modules-catalog.md)** — every module in `src/`
   with a one-line intent and its public service exports (parallel to the
   frontend's `hooks-catalog.md`).
5. **[entities.md](./entities.md)** — every Prisma model (30 of them) with
   fields, FKs, indexes, and cascade behaviour. The *what's in the database*
   reference, grouped by domain.
6. **[mcp-server.md](./mcp-server.md)** — pointer to the dedicated MCP corpus
   at [`docs/architecture/mcp/`](../mcp/) (HLD + phased plan + OAuth
   deep-dive).

## What's NOT in here

- **Per-domain history** — see `docs/changelogs/<domain>-changelog.md`. There
  are 16 domain changelogs covering issues, slack, github, standup, etc.
- **Cross-stack pain points** — see `docs/ARCHITECTURE.md` (P1-P10).
- **Prisma schema** — see `packages/api/prisma/schema.prisma` (26 KB,
  authoritative).
- **API endpoints** — Swagger at `http://localhost:3000/api/docs` is the
  source of truth.

## Quick orientation

| Thing | Where |
|---|---|
| NestJS bootstrap | `src/main.ts` (global prefix, CORS, pipes, filters, interceptor, Swagger) |
| Module wiring | `src/app.module.ts` (30 feature modules + 2 global APP_GUARDs) |
| Prisma client | `src/prisma/prisma.service.ts` (adapter-pg, lifecycle hooks) |
| Schemas / migrations | `packages/api/prisma/schema.prisma` + 29 migrations |
| Auth strategy | `src/auth/strategies/jwt.strategy.ts` (Passport JWT) |
| Global guards | `src/common/guards/{jwt-auth,roles,project-member,superuser}.guard.ts` |
| Encryption (Slack token, credentials) | `src/common/encryption.service.ts` (Global module) |
| Response envelope | `src/common/interceptors/transform.interceptor.ts` |
| Error → HTTP mapping | `src/common/filters/http-exception.filter.ts` |
| Schedulers | `src/issue/archive.scheduler.ts`, `src/standup/standup.scheduler.ts`, `src/report/report.scheduler.ts` |

## Conventions worth knowing up front

- **ESM-first.** Every relative import ends in `.js` even when the source is
  `.ts`. The Prisma client is imported from `../../generated/prisma/client.js`,
  not `@prisma/client`. Don't strip the `.js` to "fix" it — the build will
  break.
- **`projectId` URL param can be a key OR a UUID** at the *controller* layer.
  `ProjectMemberGuard` resolves keys to UUIDs and replaces `request.params.projectId`
  before the controller runs, so downstream services always see a UUID.
- **Slack DMs are best-effort, never authoritative.** The in-app
  `Notification` row is the source of truth. Slack failures get logged at
  `warn` and swallowed.
- **No silent failures inside `try/catch`.** Either rethrow as an
  `HttpException` subclass, or `logger.warn(message, stackOrString)` with a
  reason the next debugger can grep for.
