# External API Changelog

> The `/api/external/*` REST surface. `X-API-Key`-authenticated, intended for AI agents and external integrations to read and write issues, specifications, and links without going through the interactive JWT flow. Mirrors the JWT-gated routes one-to-one but accepts human-friendly identifiers (`projectKey`, `issueNumber`, `assigneeEmail`, label `name`).

## Owns

- **Modules**: `packages/api/src/external/` — `external.controller.ts` (entire surface), `external.service.ts` (resolves keys/emails/labels to UUIDs and delegates to feature services), DTOs
- **Auth**: `packages/api/src/api-key/api-key.guard.ts` (the `ApiKeyGuard`)
- **Tables**: `api_keys` (validation); does not own any data tables of its own

## Surface

All routes are `@Public()` + `@UseGuards(ApiKeyGuard)` and require `X-API-Key: bbpm_<56 hex>`.

### Issues
- `POST /api/external/issues` — body `{projectKey, title, description?, status?, priority?, type?, assigneeEmail?, parentId?, startDate?, dueDate?, labels?: string[]}`. Resolves `assigneeEmail` → `User.id`; resolves `labels` (array of names) → `Label.id[]` scoped to the project.
- `PATCH /api/external/issues/:projectKey/:issueNumber` — partial update; `assigneeEmail: null | ''` clears.
- `GET /api/external/issues/:projectKey/:issueNumber` — single issue with assignee, creator, labels, children.
- `GET /api/external/issues/:projectKey?status=&page=&limit=` — paginated list (max 100/page).

### Project digest (read-only, agent-friendly aggregator)
- `GET /api/external/projects/:projectKey/digest?days=7` — rolling-window summary: counts by status/type/priority, archived count, per-assignee workload, overdue list, upcoming-due list, recently-created (last `days`), recently-completed (last `days`), recent activity. Capped at 100 activities, 50 entries per list. `days` clamped to `[1, 90]`.

### Specifications
- `GET /api/external/projects/:projectKey/specs?category=&status=`
- `GET /api/external/projects/:projectKey/specs/:specId`
- `GET /api/external/projects/:projectKey/specs/:specId/markdown` — raw `content` for downstream Markdown processors
- `POST /api/external/projects/:projectKey/specs` — body `{title, content, category?, status?}`
- `PATCH /api/external/projects/:projectKey/specs/:specId`

### Issue ↔ Spec links
- `POST /api/external/issues/:projectKey/:issueNumber/spec-links` — body `{specId, sectionSlug?}`
- `GET /api/external/issues/:projectKey/:issueNumber/spec-links`
- `DELETE /api/external/issues/:projectKey/:issueNumber/spec-links/:linkId`

## Timeline

### 2026-05-24 — SpecItem ↔ Issue link mirror (PM-82)
**Added.** External API surfaces the new SpecItem-to-Issue link CRUD so MCP agents can wire freshly-created issues to a spec's individual checkbox-line requirements (not just the spec as a whole). Two new routes:
- `POST /api/external/projects/:projectKey/specs/:specId/items/:itemId/issues` `{ issueId }` — link an issue to a SpecItem (idempotent; returns 400 on duplicate).
- `DELETE /api/external/projects/:projectKey/specs/:specId/items/:itemId/issues/:linkId`.

Both resolve `projectKey → projectId` and delegate to `SpecItemIssueLinkService` which validates that the spec item belongs to the project (404 otherwise) and the issue belongs to the same project (404 otherwise) to avoid cross-project leaks. The internal `GET /specs/:specId` response (also externally accessible) now includes the spec's `items[]` so agents have a discoverable item list to link against without a separate roundtrip. See [`specification-changelog.md`](./specification-changelog.md#2026-05-24--specitem-checklist--ai-suggest--spec-rollup-view-pm-82) for the data model.
- DTO: `packages/api/src/external/dto/external-link-spec-item-issue.dto.ts`.
- Controller: `packages/api/src/external/external.controller.ts`.
- Service: `packages/api/src/external/external.service.ts` (`linkIssueToSpecItem`, `unlinkIssueFromSpecItem`).

### 2026-05-21 — `DOMAIN` issue type + Table of Content + bulk-set-module endpoints (PR1: BE)
**Added.** The shared `IssueType` enum now includes `DOMAIN`, so external `create_issue` / `update_issue` / `list_issues` accept `type=DOMAIN` for free via the regenerated Prisma client (no DTO change needed). Two new endpoints scoped to MCP / agent callers:
- `GET /api/external/projects/:projectKey/table-of-content` — returns the project's `Domain → Epic` outline plus an `orphanEpics` bucket for Epics that haven't been assigned a Module yet. Lets agents reason about scope without paging the full issue list.
- `PATCH /api/external/projects/:projectKey/issues/bulk-set-module` — body `{ epicIds: string[], domainId: string | null }`. Re-parents many Epics under a Module (or unparents when `domainId` is null) in one transaction. Validates every input is an `EPIC` in `projectKey`, and the target is a `DOMAIN` in the same project; rejects 400 on type mismatch / cross-project mix.

Both delegate to internal use cases (`IssueQueryService.findTableOfContent`, `BulkSetParentUseCase`). Plan: [`docs/plans/table-of-content-domain-level.md`](../plans/table-of-content-domain-level.md). The MCP server (`bbpm-internal-mcp` npm package) needs a follow-up to wire `get_project_table_of_content` and `bulk_set_epic_module` tools to these routes.
- Controller: `packages/api/src/external/external.controller.ts`.
- Service: `packages/api/src/external/external.service.ts`.

### 2026-05-19 — `parentIssueKey` accepted on create + update (PM-29, f102150)
**Added.** External create/update endpoints now accept a human-friendly `parentIssueKey` (e.g. `"PM-17"`) alongside the existing UUID `parentId`. The MCP `create_issue` tool already advertised this field, but the API rejected it with `400 property parentIssueKey should not exist` — agents had to fall back to manual UI clicks to attach issues to an epic. `ExternalService.resolveParentIssueKey()` parses `<KEY>-<NUMBER>`, asserts the parent lives in the same project as the child, and forwards the resolved UUID to the use case. `parentId` still wins when both are sent (backward-compat). On update, `parentIssueKey: null | ""` clears the parent. `UpdateIssueUseCase` already has cycle detection + hierarchy validation, so no new guards needed.
- DTOs: `packages/api/src/external/dto/external-create-issue.dto.ts`, `packages/api/src/external/dto/external-update-issue.dto.ts`.
- Service: `packages/api/src/external/external.service.ts`.
- Follow-up: the MCP server tool schema for `update_issue` still needs to expose `parentIssueKey` to agents.

### 2026-05-15 — Comments + activities readable, members + labels listable (74e3064, 853651e)
**Added.** Phase 1 of the MCP rollout — endpoints an LLM agent needs
*before* it can sensibly call `create_issue` or `comment`.
- `POST /api/external/issues/:projectKey/:issueNumber/comments` —
  delegates to `CommentService` so `@mention` dispatch (Slack DM,
  `MENTIONED` notification) runs through the same path as the web flow.
- `GET /api/external/projects` — projects the calling user is a
  member of.
- `GET /api/external/projects/:projectKey/members` — id + role +
  avatar; lets an LLM resolve a human name to a user UUID.
- `GET /api/external/projects/:projectKey/labels` — label catalog.
- `GET /api/external/issues/:projectKey/:issueNumber/comments` and
  `…/activities` — readable threaded discussion + audit history.
- Source: `packages/api/src/external/external.controller.ts`,
  `packages/api/src/external/external.service.ts`. Full rollout notes:
  [`mcp-changelog.md`](./mcp-changelog.md).

### 2026-05-15 — Accept `assigneeId` on create + update (3ca73ba)
**Fixed.** External DTOs only declared `assigneeEmail`, so the global
`ValidationPipe` (`whitelist: true`) silently dropped any
`assigneeId` an LLM-driven client sent — and the create succeeded
without an assignee. Added `assigneeId` (UUID) to both create + update
DTOs; when both are sent, `assigneeId` wins. Email lookup stays as a
fallback for clients that only have the email.

### 2026-05-15 — Bearer tokens accepted alongside `X-API-Key` (a0629e0)
**Changed.** The guard on `/api/external/*` is still `ApiKeyGuard`, but
the guard itself now accepts `Authorization: Bearer bbpm_at_<…>` in
addition to `X-API-Key`. Cursor / Claude Code / scripts keep using
their API keys; claude.ai web custom connectors and ChatGPT remote
MCP use OAuth-issued Bearer tokens — the controller surface is the
same either way. See
[`docs/architecture/backend/mcp-server.md`](../architecture/backend/mcp-server.md).

### 2026-05-15 — Row provenance via `source` column (8316d12, 4bd0043)
**Changed.** Every write through the external surface now tags
`issues.source`, `activities.source`, `comments.source` with the
detected client (`MCP`, `API`, `SLACK`, `WEBHOOK`, `SYSTEM`).
Detection priority: `X-Client-Source` header > User-Agent sniffing >
`API` fallback. Migration `20260515064854_add_source_columns` backfills
existing rows to `'WEB'`.

### 2026-05-11 — Issue↔spec links via external API (7eb50ad)
**Added.** Three endpoints to wire issues to specs from an agent context. Lets the agent that just generated an issue from a spec section persist the back-link in the same call sequence.
- Source: `packages/api/src/external/external.controller.ts:134`, `packages/api/src/external/external.service.ts:468`.

### 2026-05-11 — Spec create/update (d5705ee)
**Added.** `POST` and `PATCH` for specs on the external surface. The DTOs validate `status` against the `SpecStatus` enum and default to `DRAFT` on create.
- Source: `packages/api/src/external/external.service.ts:433`.

### 2026-05-05 — Specifications listed + markdown export (32ee26d)
**Added.** Three GET endpoints (`/specs`, `/specs/:id`, `/specs/:id/markdown`). The markdown export returns the raw `content` preserving section anchors.

### 2026-05-05 — Project digest endpoint (76b46bf)
**Added.** `GET /api/external/projects/:projectKey/digest`. Built specifically for AI agents that want to "catch up" on a project without making N separate calls. Reuses `IssueService.findAll` and aggregates in-memory because the digest's scope is bounded by `archivedAt IS NULL`.
- Source: `packages/api/src/external/external.service.ts:191`.

### 2026-04-06 — Initial external surface (init commit)
**Added.** `external.controller.ts` with `@Public()` + `@UseGuards(ApiKeyGuard)` on the class. Endpoints:
- `POST /api/external/issues` — resolves `projectKey`, `assigneeEmail`, label names. Delegates to `IssueService.create`.
- `PATCH | GET /api/external/issues/:projectKey/:issueNumber`.
- `GET /api/external/issues/:projectKey`.

`ApiKeyGuard` validates by narrowing on the 8-char `keyPrefix` and bcrypt-comparing. On match, stamps `lastUsed` and sets `request.user = { sub: <user.id>, email }` so downstream services treat the request as if it had come from that human user (creator, assignee, audit trail).
- Source: `packages/api/src/external/external.controller.ts`, `packages/api/src/api-key/api-key.guard.ts`.

## Security notes

- **The external surface is intentionally a thin wrapper.** All authorization is identical to interactive auth — an API key acts as the user it was issued to. If that user has access to a project, the agent does too. If not, the agent gets 404.
- **No per-key scoping.** A key cannot be limited to "read-only" or "specific project". Future work.
- **No rate limit override for the external surface** — same 30 req/60s/IP as everything else. An aggressive agent will hit 429 quickly.

## Open questions / known issues

- **P11 — External and JWT routes share the same controllers/services in *most* feature modules**, distinguished only by which guard decorator is on the controller. The `external` controller is a separate file precisely to make the public surface obvious in code review. Internal routes should never accidentally land here.
- **No API key rotation flow.** Today: delete the old key + create a new one. There's no overlap window.
- **`X-API-Key` is plaintext in transit** outside HTTPS. Production deploys must terminate TLS; reverse proxies must not log this header.
