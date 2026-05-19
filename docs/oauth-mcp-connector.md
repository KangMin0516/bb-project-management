# Remote MCP Connector + OAuth 2.1 setup

How the BB PM MCP HTTP server (`mcp.burningbros.kr`) authenticates remote AI clients (Claude.ai, ChatGPT, MCP Inspector, etc.) through the BB PM OAuth 2.1 server (`pm.burningbros.kr`). Captures the spec references, the moving parts, and the four bugs we hit while making Claude.ai's custom connector work — most clients are lenient, Claude follows the RFCs strictly, so it surfaced gaps the others masked.

---

## TL;DR — the four things every conforming client needs

If you're extending the MCP / OAuth surface, these are the load-bearing invariants. Break any of them and at least one major client (Claude is the canary) will fail with "Couldn't reach the MCP server".

1. **`POST /api/oauth/register` accepts a missing `client_name`** (RFC 7591 §2). Falls back to a name derived from `redirect_uris[0]`'s hostname (e.g. `claude.ai`).
2. **`WWW-Authenticate` on `mcp.burningbros.kr/mcp` 401 responses uses `resource_metadata=`**, not the non-standard `as_uri=` (RFC 6750 + RFC 9728).
3. **AS metadata is served at the RFC 8414 path**: for issuer `https://pm.burningbros.kr/api`, that is `https://pm.burningbros.kr/.well-known/oauth-authorization-server/api` — the well-known suffix is inserted **between host and issuer-path**.
4. **`nginx` forwards `/.well-known/*` to NestJS**, so the SPA catch-all doesn't swallow the discovery probe and return `index.html`.

---

## Architecture

```
                ┌────────────────────────────────────────┐
   Claude.ai    │  remote MCP client (Claude / ChatGPT)  │
   user adds    └──────────────┬─────────────────────────┘
   custom               URL    │
   connector       ────────────┘
                                │
                                ▼ (1) probe with no creds
┌─────────────────────────────────────────────────────────────────┐
│  MCP HTTP server — `mcp.burningbros.kr/mcp`                     │
│  bbpm-internal-mcp (Streamable HTTP transport)                  │
│                                                                 │
│  ◀──── 401 + WWW-Authenticate: Bearer realm="bbpm-mcp",         │
│        resource_metadata="…/.well-known/oauth-protected-resource"│
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼ (2) fetch resource metadata
                       https://mcp.burningbros.kr/.well-known/oauth-protected-resource
                       → { resource, authorization_servers: ["https://pm.burningbros.kr/api"] }
                                │
                                ▼ (3) fetch AS metadata (RFC 8414)
                       https://pm.burningbros.kr/.well-known/oauth-authorization-server/api
                       → { issuer, authorization_endpoint, token_endpoint, registration_endpoint, … }
                                │
                                ▼ (4) dynamic client registration (RFC 7591)
                       POST https://pm.burningbros.kr/api/oauth/register
                       { redirect_uris: ["https://claude.ai/api/mcp/auth_callback"] }
                       → { client_id, client_secret, … }
                                │
                                ▼ (5) authorize (PKCE, browser tab)
                       https://pm.burningbros.kr/oauth/authorize?client_id=…&code_challenge=…
                       ◀──── React consent screen → POST /api/oauth/authorize/consent
                       ──── redirect to claude.ai with ?code=…
                                │
                                ▼ (6) exchange code for access_token (PKCE)
                       POST https://pm.burningbros.kr/api/oauth/token
                       → { access_token, refresh_token, … }
                                │
                                ▼ (7) replay original /mcp request with Authorization
                                  Streamable HTTP transport carries MCP protocol over a single POST.
```

### Three discovery paths, all serve the same AS metadata

NestJS's `setGlobalPrefix('api')` is configured to **exclude** `/.well-known/*` so the well-known docs reach Nest at host-root paths. `WellKnownController` answers at:

| Path | Why |
|---|---|
| `/.well-known/oauth-authorization-server/api` | **RFC 8414 conformant** for issuer `https://pm.burningbros.kr/api`. Claude.ai checks this. |
| `/.well-known/oauth-authorization-server` | Host-rooted variant — used by clients that assume the issuer is the bare host. |
| `/api/.well-known/oauth-authorization-server` | Legacy path that ChatGPT / older clients cached. Kept for back-compat. |

`nginx` forwards `/.well-known/*` to `app:3000`; without that the SPA's `try_files $uri /index.html` ate the request.

### OAuth client model

`OAuthClient` row carries `clientId`, `clientSecret` (nullable for public clients), `clientName`, `redirectUris[]`, `scopes[]`, `grantTypes[]`. Dynamic Client Registration always issues PKCE-friendly clients; `token_endpoint_auth_method: "none"` is honoured for public clients, default is `client_secret_basic`.

Token issuance lives in `OAuthService.issueTokenPair`. Refresh-token rotation is single-use; existing token gets revoked on refresh.

### Transports

The HTTP server (`bbpm-internal-mcp` v0.8.3+) uses **`StreamableHTTPServerTransport`** — one POST per RPC, response streamed if the tool emits multiple frames. Many third-party MCP servers (Asana, Atlassian) ship `SSE` transport on a `/sse` path; both are valid per MCP spec and both Claude/ChatGPT accept either.

---

## The four-stage debug story (Claude failed where ChatGPT worked)

These are the bugs we hit on the same connector, in order, each one masked by the next. ChatGPT was permissive at every layer; Claude was strict.

### 1. DCR required `client_name` (PM-44, commit `6f78e09`)

**Symptom.** Claude.ai showed *"Couldn't reach the MCP server"* with a fresh reference id. The MCP URL was reachable, the OAuth discovery worked, but DCR returned `400 {"error":"invalid_request","error_description":"client_name is required"}`.

**Why.** RFC 7591 §2 marks `client_name` as **OPTIONAL** ("Human-readable name of the client to be presented to the end user"). Our service threw early when it was absent. ChatGPT happened to send `client_name` in its DCR; Claude did not.

**Fix.** `OAuthService.registerClient` now derives a fallback name from `new URL(redirect_uris[0]).hostname` (e.g. `claude.ai`) or `"Anonymous MCP Client"` if the URI is unparseable.

### 2. `WWW-Authenticate` used non-standard `as_uri=` (bbpm-mcp v0.8.3, commit `3675ff8`)

**Symptom.** With DCR fixed, Claude still bailed at the same step — same error message, new reference id. ChatGPT continued to work.

**Why.** The MCP HTTP server's 401 response carried:
```
WWW-Authenticate: Bearer realm="bbpm-mcp", as_uri="…/.well-known/oauth-authorization-server"
```
`as_uri` isn't a real parameter. RFC 9728 (OAuth 2.0 Protected Resource Metadata) defines `resource_metadata=` as the standard pointer — it names the protected-resource metadata document, which in turn lists the authorization servers. Claude followed RFC 9728 strictly; ChatGPT happened to fall back to fetching the AS metadata from the resource URL (which we happen to proxy), so the bug was invisible from ChatGPT.

**Fix.** Header now reads:
```
WWW-Authenticate: Bearer realm="bbpm-mcp", error="invalid_token",
                  resource_metadata="https://mcp.burningbros.kr/.well-known/oauth-protected-resource"
```

The HTTP server also infers its own host from `X-Forwarded-Proto` + `Host` so the URL is correct behind nginx / Cloudflare.

### 3. AS metadata not at the RFC 8414 path (commit `8c43827`)

**Symptom.** With (1) and (2) fixed, Claude reached the AS-discovery step but still failed. Resource metadata correctly listed `authorization_servers: ["https://pm.burningbros.kr/api"]`. Claude then probed `https://pm.burningbros.kr/.well-known/oauth-authorization-server/api` — and got the React `index.html`.

**Why.** RFC 8414 §3 says the well-known suffix is inserted **between the host and the issuer path**: for issuer `https://pm.burningbros.kr/api`, the metadata URL is `https://<host>/.well-known/oauth-authorization-server<path>`, i.e. `…/.well-known/oauth-authorization-server/api`. Our `WellKnownController` only served `/api/.well-known/oauth-authorization-server` — the path-after-prefix convention, which is non-standard.

**Fix.** Two parts:
- `main.ts`: `setGlobalPrefix('api', { exclude: ['/.well-known/(.*)'] })` so the global prefix doesn't capture well-known paths.
- `WellKnownController` answers at all three paths — RFC, host-rooted, and legacy — pointing the same metadata object at each.

### 4. Nginx never forwarded `/.well-known/*` (commit `78af6b6`)

**Symptom.** After (3) deployed, the path still returned `index.html`. NestJS was now ready to serve at host-root paths, but production nginx wasn't.

**Why.** `packages/web/nginx.conf` only had `location /api { proxy_pass http://app:3000; }` plus a SPA catch-all (`location / { try_files $uri /index.html; }`). Any request that wasn't under `/api/` fell into the catch-all and returned the React index page.

**Fix.** Added `location /.well-known/ { proxy_pass http://app:3000; … }` before the catch-all.

### Why ChatGPT kept working through (1)–(4)

| Layer | Strict client (Claude.ai) | Lenient client (ChatGPT) |
|---|---|---|
| DCR | Omits `client_name` → 400 → fail | Sends `client_name` → 201 → OK |
| `WWW-Authenticate` | Reads `resource_metadata=` only | Falls back to fetching AS metadata at the resource URL (which our server happens to also serve) |
| AS-metadata path | Probes RFC 8414 `/.well-known/oauth-authorization-server/api` | Probes legacy `/api/.well-known/oauth-authorization-server` |
| Nginx routing | Strict path → SPA HTML → fail | Legacy `/api/` path → backend → JSON → OK |

Three out of the four bugs were invisible from ChatGPT alone.

---

## Verifying the chain

Run these in order — each returns JSON if the layer above is healthy.

```bash
# 1. MCP probe returns 401 + RFC 9728 challenge
curl -sI https://mcp.burningbros.kr/mcp | grep -i www-authenticate
# expected: Bearer realm="bbpm-mcp", error="invalid_token", resource_metadata="…"

# 2. Resource metadata reachable + points at the right AS
curl -s https://mcp.burningbros.kr/.well-known/oauth-protected-resource | jq .
# expected: { resource, authorization_servers, bearer_methods_supported, … }

# 3. AS metadata at the RFC 8414 path
curl -sI https://pm.burningbros.kr/.well-known/oauth-authorization-server/api | head -1
# expected: HTTP/2 200, content-type: application/json
curl -s https://pm.burningbros.kr/.well-known/oauth-authorization-server/api | jq .

# 4. DCR accepts a missing client_name
curl -s -X POST https://pm.burningbros.kr/api/oauth/register \
  -H 'Content-Type: application/json' \
  -d '{"redirect_uris":["https://claude.ai/api/mcp/auth_callback"]}' | jq .
# expected: 201 with { client_id, client_secret, client_name: "claude.ai", … }
```

If any step regresses, the matching commit's diff is the place to look.

---

## Pointers for new connectors / clients

- **Adding a connector**: end-user enters URL `https://mcp.burningbros.kr/mcp` and a display name. Everything else — DCR, PKCE, consent — is automatic. The Advanced settings (`OAuth Client ID` / `Secret`) are only needed if you've pre-registered a client and want to skip DCR.
- **Manual client registration** (Path A workaround): `POST /api/oauth/register` with the client's known redirect URI; paste the returned `client_id` + `client_secret` into Claude.ai's Advanced settings. Useful when DCR is broken or undesirable.
- **Adding SSE transport** (only if a future client requires it): the MCP SDK's `SSEServerTransport` runs alongside the Streamable HTTP server on a `/sse` path. `bbpm-internal-mcp/src/http-server.ts` is the only file that needs editing.
- **MCP Inspector** (`npx @modelcontextprotocol/inspector`) is the fastest way to dry-run the full OAuth flow without involving Claude or ChatGPT.

---

## Spec references

- **RFC 6750** — OAuth 2.0 Bearer Token Usage (defines the `WWW-Authenticate: Bearer` challenge shape).
- **RFC 7591** — Dynamic Client Registration (which DCR fields are required vs optional).
- **RFC 7636** — PKCE (mandatory for public clients in OAuth 2.1).
- **RFC 8414** — OAuth 2.0 Authorization Server Metadata (well-known path construction).
- **RFC 9728** — OAuth 2.0 Protected Resource Metadata (`resource_metadata=` in the bearer challenge, `/.well-known/oauth-protected-resource` document).
- **MCP Authorization spec** — <https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization>
- **Claude MCP connector docs** — <https://platform.claude.com/docs/en/agents-and-tools/mcp-connector>
