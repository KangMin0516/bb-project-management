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
