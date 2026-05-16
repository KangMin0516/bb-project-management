# MCP Changelog

> The `bbpm-internal-mcp` rollout — both the OAuth 2.1 Authorization
> Server that hosts authentication for remote / cloud MCP clients and
> the `/api/external/*` surface extensions that MCP-class agents
> needed. See [`docs/architecture/backend/mcp-server.md`](../architecture/backend/mcp-server.md)
> for the full design.

## Owns

- **Modules**: `packages/api/src/oauth/` (controller, service,
  module, well-known controller), updates to
  `packages/api/src/api-key/api-key.guard.ts`, additions in
  `packages/api/src/external/` (new endpoints), and
  `packages/api/src/common/source.ts` (source detection).
- **Frontend**: `packages/web/src/pages/OAuthAuthorizePage.tsx`,
  `packages/web/src/features/api-key/` (Profile UI), source badges
  in issue / activity / comment lists.
- **Tables** (migration `20260515_oauth_2_1_authorization_server`):
  `oauth_clients`, `oauth_auth_codes`, `oauth_access_tokens`,
  `oauth_refresh_tokens`. Migration `20260515064854_add_source_columns`
  adds `source VARCHAR(20) NOT NULL DEFAULT 'WEB'` to `issues`,
  `activities`, `comments`.

## Surface

### OAuth 2.1 Authorization Server (`/api/oauth/*`)

All routes are `@Public()` (no JWT) and Bearer-friendly where
relevant. PKCE S256 is mandatory.

- `GET /api/.well-known/oauth-authorization-server` — RFC 8414
  metadata. Canonical path (issuer = `<webBase>/api`). A legacy copy
  remains at `/api/oauth/.well-known/...` for clients that cached it.
- `POST /api/oauth/register` — RFC 7591 Dynamic Client Registration.
  Throttled 10/min/IP. Public clients (`token_endpoint_auth_method:
  'none'`) skip secret issuance.
- `GET /api/oauth/authorize/client?client_id=…` — JWT-only helper for
  the React consent screen.
- `POST /api/oauth/authorize/consent` — JWT-only, mints a single-use
  authorization code (5-min TTL).
- `POST /api/oauth/token` — `authorization_code` + `refresh_token`
  grants. Throttled 60/min/IP. PKCE-verified, single-use codes,
  rotating refresh tokens.
- `POST /api/oauth/revoke` — RFC 7009.
- `ALL /api/oauth/userinfo` — Bearer-only, returns `{ sub, email }`.

### `ApiKeyGuard` — dual-credential

A single guard now accepts both credential types and normalises them
to the same `request.user = { sub, email }`:

- `X-API-Key: bbpm_<56-hex>` — long-lived personal key (Cursor,
  Claude Code, Claude Desktop, scripts).
- `Authorization: Bearer bbpm_at_<base64url>` — short-lived OAuth
  access token (claude.ai web, ChatGPT remote MCP).

### New external endpoints (`/api/external/*`)

Authentication: `@Public()` + `@UseGuards(ApiKeyGuard)` — same as
the rest of `/api/external/*`.

- `POST /api/external/issues/:projectKey/:issueNumber/comments` —
  body `{ content }`. Delegates to `CommentService` so `@mention`
  dispatch (Slack DM, `MENTIONED` notification) runs through the
  same code path as the web flow.
- `GET /api/external/projects` — projects the calling user is a
  member of. The LLM needs this before any project-scoped call.
- `GET /api/external/projects/:projectKey/members` — id + role +
  avatar so an LLM can resolve a name to a user UUID.
- `GET /api/external/projects/:projectKey/labels` — id + name + color
  catalog for `create_issue` labels arrays.
- `GET /api/external/issues/:projectKey/:issueNumber/comments` and
  `…/activities` — exposed to the external surface so an LLM can read
  threaded discussion + audit history.

### Source tagging

- `issues.source`, `activities.source`, `comments.source` —
  `VARCHAR(20) NOT NULL DEFAULT 'WEB'`. Free-form string (intentionally
  not a Prisma enum) so new clients can be added without a migration.
- Detection priority: `X-Client-Source` header > `User-Agent`
  sniffing > `API` fallback. Implemented in
  `packages/api/src/common/source.ts`.
- Web UI badges render for any row with `source !== 'WEB'`.

## Timeline

### 2026-05-15 19:26 — OAuth consent page hydrates auth state itself (`df78c01`)
**Fixed.** `OAuthAuthorizePage` lived outside `<AuthGuard>` (so the
`?response_type=code&client_id=…` params survive a round-trip through
`/login`), which meant nothing else was calling `loadUser()` after
hydration. The page sat on the initial `isLoading: true` state
indefinitely. Now the page owns its own hydration: if a token is
present, call `loadUser()`; otherwise drop straight to the login
redirect.
- Source: `packages/web/src/pages/OAuthAuthorizePage.tsx:23`.

### 2026-05-15 19:17 — CORS allowlist for MCP Inspector + claude.ai + ChatGPT (`b4e936f`)
**Fixed.** CORS was tied to a single `CORS_ORIGINS` env (defaulted to
`http://localhost:5173`). MCP Inspector on `http://localhost:6274`,
claude.ai web custom connectors, and ChatGPT remote MCP servers were
all hitting `405 / CORS error` on the preflight to `/api/oauth/*`
and never reaching the registration / token endpoints. Switched to a
callback-based origin check that keeps the configured strict
whitelist, also allows `http(s)://localhost:*`, and allows
`https://*.claude.ai`, `*.anthropic.com`, `*.chatgpt.com`,
`*.openai.com`. Also exposed `WWW-Authenticate` so browser-based
clients can read the 401 challenge and start OAuth discovery, and
`Mcp-Session-Id` for the MCP streamable-HTTP transport.
- Source: `packages/api/src/main.ts:17`.

### 2026-05-15 17:58 — Well-known at API root for OAuth discovery (`bcac982`)
**Fixed.** claude.ai / ChatGPT discover the AS by *appending*
`/.well-known/oauth-authorization-server` to the URL they find in
protected-resource metadata. With issuer = `https://pm.burningbros.kr`
the request hit the React SPA at the apex and never reached the API.
Moved the canonical metadata path to
`/api/.well-known/oauth-authorization-server` (new
`WellKnownController` at the API root) and shifted issuer to
`https://pm.burningbros.kr/api`. The legacy `/api/oauth/.well-known/…`
path stays on `OAuthController` for back-compat.
`OAuthService.metadata` now takes `{ apiBase, webBase }`: `apiBase`
is the issuer and host for `/oauth/{token,register,revoke,userinfo}`;
`webBase` is the React app root that owns `/oauth/authorize`.
- Source: `packages/api/src/oauth/well-known.controller.ts`,
  `packages/api/src/oauth/oauth.service.ts:67`.

### 2026-05-15 17:52 — RFC 6749 error shape + raw OAuth responses (`faf7265`)
**Fixed.** The global `TransformInterceptor` wraps every response in
`{ success, data }`. OAuth clients expect the response body to be
the raw RFC 6749 shape (e.g. `{ access_token, token_type, ... }` or
`{ error: 'invalid_grant', error_description: '...' }`). Added a
`@RawResponse()` decorator so the interceptor skips wrapping for
OAuth-bound controllers. Errors are reshaped to the RFC 6749 form
inside the controllers, not by the global filter, so the response
body matches what `oauth-client` libraries parse.
- Source: `packages/api/src/common/interceptors/transform.interceptor.ts`,
  `packages/api/src/oauth/oauth.controller.ts:31`.

### 2026-05-15 17:40 — OAuth 2.1 Authorization Server (`a0629e0`)
**Added.** Full OAuth 2.1 AS for MCP custom connectors. Lets
claude.ai web / ChatGPT / any RFC 7591 client onboard the MCP server
with a real consent flow instead of a hand-pasted personal API key.
Authorization is delegated to BB-PM (single source of user identity);
existing `X-API-Key` callers (Cursor, Claude Code, Desktop, scripts)
keep working unchanged.

- **Prisma**: `oauth_clients`, `oauth_auth_codes`,
  `oauth_access_tokens`, `oauth_refresh_tokens`. `User` has inverse
  relations for cascade.
- **API**: `/api/oauth/.well-known/oauth-authorization-server`
  (RFC 8414), `/register` (RFC 7591 DCR), `/authorize/{client,
  consent}`, `/token` (PKCE S256 code + refresh rotation), `/revoke`
  (RFC 7009), `/userinfo`. Public clients (auth method `'none'`)
  allowed for browser-based PKCE; confidential clients require
  `client_secret`.
- **`ApiKeyGuard`**: now accepts `Authorization: Bearer bbpm_at_<…>`
  in addition to `X-API-Key`. Bearer tokens are resolved against
  `oauth_access_tokens` and populate `request.user` the same way;
  downstream controllers stay agnostic.
- **Web**: `/oauth/authorize` consent screen. Renders client name,
  human-readable scope descriptions, and a Deny path returning
  `error=access_denied` per RFC 6749. `LoginPage` honours `?next=`
  so the round-trip through login preserves OAuth params.

Migration: `20260515_oauth_2_1_authorization_server`.
- Source: `packages/api/src/oauth/`,
  `packages/api/src/api-key/api-key.guard.ts`,
  `packages/web/src/pages/OAuthAuthorizePage.tsx`.

### 2026-05-15 14:27 — Source detection via `X-Client-Source` header (`4bd0043`)
**Fixed.** Node's `http` layer can rewrite `User-Agent` in subtle
ways (e.g. when going through proxies); UA sniffing alone misclassified
MCP traffic as `API`. Promoted `X-Client-Source` to the primary
signal — the `bbpm-mcp` server sends it verbatim. UA stays as a
fallback for third parties (Slackbot, GitHub Hookshot). Also dropped
the legacy "via Web" footer text on issue/comment rows now that the
badge carries the signal visually.
- Source: `packages/api/src/common/source.ts:30` (`detectSourceFromHeaders`).

### 2026-05-15 14:11 — Source-of-write tagging (`8316d12`)
**Added.** End-to-end provenance for every row a write produces.
`issues`, `activities`, `comments` each gain a
`source VARCHAR(20) NOT NULL DEFAULT 'WEB'` column. Source is a
free-form string (not a Prisma enum) so new clients can be added
without another migration — the `SourceLiteral` TS union in
`common/source.ts` is the source of truth. The web UI shows a
coloured badge (Sparkles for MCP, Slack icon for Slack, etc.) on
every row whose source isn't `WEB`, so a developer sees at a glance
when a comment came from Claude on their behalf.

Migration: `20260515064854_add_source_columns` — backfills existing
rows to `'WEB'`.
- Source: `packages/api/src/common/source.ts`, `packages/web/src/shared/ui/source-badge/`.

### 2026-05-15 13:32 — External endpoints accept `assigneeId` (`3ca73ba`)
**Fixed.** bbpm-internal-mcp's `create_issue` / `update_issue` tools
already have the assignee UUID in hand (resolved via `list_members`).
The external DTOs only accepted `assigneeEmail`, and the global
whitelist `ValidationPipe` silently dropped the unknown `assigneeId`,
so creates succeeded without an assignee. Added `assigneeId` (UUID)
to both create + update DTOs. `assigneeId` wins when both are sent —
it's the explicit, unambiguous form. Email lookup stays as a fallback.
- Source: `packages/api/src/external/dto/external-create-issue.dto.ts`,
  `packages/api/src/external/external.service.ts`.

### 2026-05-15 12:21 — External endpoints + Profile UI for MCP integration (`74e3064`)
**Added.** Phase 1 of the bbpm-internal-mcp rollout — the remaining
`/external` endpoints the MCP server needs, plus a Profile page
section so users can mint and revoke their own API keys without DB
access.

- `POST /api/external/issues/:projectKey/:issueNumber/comments` —
  delegates to `CommentService` so `@mention` dispatch runs through
  the same path as the in-app flow.
- `GET /api/external/projects` — projects the user is a member of.
- `GET /api/external/projects/:projectKey/members` — members for
  name→id resolution.
- `GET /api/external/projects/:projectKey/labels` — label catalog.
- **Web — Profile → API Keys**: `features/api-key/` slice with
  list (with revoke confirm) + two-stage create dialog (name →
  generated raw key, copy button, one-time-only warning). The raw
  key is only ever returned by `POST /api-keys`; `GET /api-keys`
  never exposes it again.

`ExternalModule` now imports `CommentModule` so the new
`createComment` path can reuse the comment service.
- Source: `packages/api/src/external/external.controller.ts`,
  `packages/web/src/features/api-key/`.

### 2026-05-15 — Future endpoint expansion (`853651e`)
**Added.** Exposed comments + activities on the read side of
`/api/external/*` so MCP-class agents can pull threaded discussion
and audit history with the same auth shape as everything else.
- Source: `packages/api/src/external/external.service.ts`.

## Security notes

- **Two credential paths share one guard.** `ApiKeyGuard` is the
  chokepoint — there is no controller in the codebase that accepts
  Bearer tokens via a separate route. If a future endpoint should
  *not* be reachable by MCP, its controller must not include
  `@UseGuards(ApiKeyGuard)`.
- **No per-key scoping today.** A key/token acts as its owning user.
  Future work tracked in
  [`docs/architecture/backend/mcp-server.md`](../architecture/backend/mcp-server.md)
  §4.b.
- **Refresh rotation is consume-once.** Reused refresh tokens fail at
  the next exchange. The owning client also rotates on the same
  schedule so concurrent use across two devices isn't supported —
  acceptable for MCP since one connector = one host.
- **DCR is unauthenticated by design.** Anyone can mint a `client_id`;
  the actual authority still comes from the end-user consent. The
  throttle (10/min/IP) is the only abuse limiter.

## Open questions / known issues

- **No background sweep for expired OAuth rows.** Rejected at use
  (the `expiresAt` check) but rows stay in the table. Revisit when
  the table grows past a few hundred thousand rows.
- **No admin UI for revoking a registered `oauth_client`** — emergency
  revocation is a DB action today.
- **Bearer tokens are not sender-constrained** (no DPoP, no mTLS). A
  stolen token in its 1-hour window is usable by any IP.
- **MCP scopes are coarse.** Only `mcp` is checked downstream;
  `openid`/`profile`/`email` exist for OIDC compatibility but are
  not yet enforced anywhere.

## Cross-references

- [`docs/architecture/backend/mcp-server.md`](../architecture/backend/mcp-server.md) — full architecture, sequence diagrams, threat model.
- [`docs/changelogs/external-api-changelog.md`](./external-api-changelog.md) — `/api/external/*` history.
- [`docs/changelogs/auth-changelog.md`](./auth-changelog.md) — JWT + API key history.
- [`docs/architecture/backend/entities.md`](../architecture/backend/entities.md) — OAuth Prisma models.
