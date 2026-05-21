# Public Share Link

> External, passcode-gated, read-only view of a project's Timeline.
> PMs create a link, send the URL + passcode to a client, the client
> opens the link without a BB PM account and sees only what we've
> whitelisted. Shipped for PM-60 in two PRs (BE `93abe78`, FE pending).

> **Why this doc exists.** Share-link is the first feature that adds a
> *parallel JWT lane* to the API. Getting the boundary right matters
> for security; getting the redirect/clear semantics right matters for
> UX. Both are easy to break in a follow-up if the design isn't
> written down somewhere outside the changelogs.

---

## 1. What problem it solves

External stakeholders (clients of consulting engagements; product
managers at partner orgs) need to see project progress without a BB PM
account. The internal Timeline page is the right shape for that — Epic →
Task rows on a date axis — but the page bundles drag-to-reschedule,
filter persistence to URL, `IssueDetailPanel` with comments / activity,
assignee email tooltips, and every other internal-only surface. Sharing
the internal URL would leak both PII and the ability to mutate.

A public surface needs to satisfy four constraints simultaneously:

1. **No BB PM account.** Cold-open URL → see data.
2. **Read-only.** Mutation endpoints must reject any token issued for
   sharing, regardless of where it shows up.
3. **PII-safe.** Comments, activity log, assignee email, source flag,
   description — none of those reach the wire.
4. **Revocable now, not in 2h.** When a PM hits "Revoke" the next
   client request returns 410. Token-only auth (sign-and-forget) can't
   do this.

The design below is a passcode-gated, multi-link-per-project,
short-lived-JWT surface where the JWT is necessary but not sufficient
on every read.

---

## 2. Where the code lives

| Layer | Path | Notes |
|---|---|---|
| Schema + migration | `packages/api/prisma/schema.prisma` (model `ShareLink`, enum `ShareScope`); `packages/api/prisma/migrations/20260521100415_add_share_link/` | One table, no backfill. Cascade on Project delete; Restrict on User delete (auditing). |
| Domain (pure) | `packages/api/src/share-link/domain/share-link.entity.ts` | `canUnlock`, `recordFailure`. State machine with unit tests in `*.spec.ts`. |
| Application | `packages/api/src/share-link/application/` | Five use cases (`create`, `unlock`, `revoke`, `rotate-passcode`, `get-public-timeline`) + port + Prisma adapter. CQRS-lite per [`refactor-plan.md`](./refactor-plan.md) §6.3. |
| Strategy / Guard | `packages/api/src/share-link/strategies/share-jwt.strategy.ts`, `guards/share-auth.guard.ts` | Parallel to `JwtStrategy` / `JwtAuthGuard` in `auth/`. Different secret, different `kind` claim. |
| Controllers | `packages/api/src/share-link/share-link.controller.ts` (admin, `/api/projects/:projectId/share-links`); `share-link.public.controller.ts` (public, `/api/public/share/:token/*`) | Admin lives under the project URL, behind `ProjectMemberGuard` + `RolesGuard(ADMIN, PM)`. Public is `@Public()` + `ShareAuthGuard`. |
| Module wiring | `packages/api/src/share-link/share-link.module.ts` | Imports `JwtModule.register({})` (passes per-call `{secret, expiresIn}`) and `IssueModule` (for `IssueQueryService`). |
| FE public surface | `packages/web/src/features/share-link/pages/SharePasscodePage.tsx`, `SharedTimelinePage.tsx`; `app/router/index.tsx` routes outside `AuthGuard` | Slim header, no AppLayout. |
| FE admin surface | `packages/web/src/features/share-link/components/ShareLinkDialog.tsx` (Create + Manage tabs) | Triggered from `TimelinePage` via a `rightActions` slot on `TimelineHeader`. |
| FE axios + adapter | `packages/web/src/features/share-link/api/publicApi.ts`, `shareLinkApi.ts`, `toIssueShape.ts` | Separate axios instance with sessionStorage JWT; adapter maps `PublicTimelineIssue` → internal `Issue` so existing timeline hooks/components work unchanged. |
| Defense-in-depth patch | `packages/api/src/auth/strategies/jwt.strategy.ts` | Rejects `payload.kind === 'share'` even if signed with the wrong secret. |
| Env keys | `JWT_SHARE_SECRET`, `SHARE_JWT_EXPIRES_IN`, `SHARE_LINK_PASSCODE_FAIL_THRESHOLD`, `SHARE_LINK_LOCKOUT_MINUTES` in `.env.example` + `docker-compose.prod.yml` | `JWT_SHARE_SECRET` is `:?must be set` in prod compose. |

---

## 3. Data model

```prisma
enum ShareScope { TIMELINE BOARD CALENDAR LISTS }   // only TIMELINE used Phase 1

model ShareLink {
  id             String       @id @default(uuid())
  token          String       @unique @db.VarChar(32)   // 32 hex, URL slug
  passcodeHash   String       @map("passcode_hash")     // bcrypt cost 10
  scopes         ShareScope[] @default([TIMELINE])

  expiresAt      DateTime?
  revokedAt      DateTime?
  lastAccessedAt DateTime?
  accessCount    Int          @default(0)
  failedAttempts Int          @default(0)
  lockedUntil    DateTime?

  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  projectId      String
  project        Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  createdById    String
  createdBy      User         @relation("CreatedShareLinks", fields: [createdById], references: [id], onDelete: Restrict)

  @@index([projectId])
}
```

**Why each column**:

- `token` — URL slug. 32 hex = 128 bits entropy. Unique constraint so the
  URL is the row's only addressing path.
- `passcodeHash` — bcrypt (cost 10). Plain passcode is never persisted,
  shown to the human exactly once.
- `scopes` — array so a single link can grant Board + Calendar later
  without schema change.
- `failedAttempts` + `lockedUntil` — per-link brute-force defence,
  computed by the pure `recordFailure(threshold, lockoutMs)` function.
- `revokedAt` — soft delete. The row stays for audit (`accessCount`,
  `lastAccessedAt`); only `ADMIN` hard-deletes via `DELETE`.
- `createdBy` is `Restrict` on delete: removing the user who created a
  link would clear `createdById` and lose the audit trail, so the user
  has to revoke their links before being removed.

---

## 4. Two JWT lanes

The system runs **two parallel passport-jwt strategies** that are
mutually exclusive at the payload level. This is the load-bearing
design choice — get it wrong and a share token can act as a user
session, or vice versa.

### Lane A — User session (existing)

- Secret: `JWT_SECRET`
- Strategy: `JwtStrategy` (`auth/strategies/jwt.strategy.ts`)
- Guard: `JwtAuthGuard` (registered globally via `APP_GUARD`)
- Payload: `{ sub, email }` — no `kind` field on issued user tokens
- Opt-out: `@Public()` on the route

### Lane B — Share session (new)

- Secret: `JWT_SHARE_SECRET` (**must be different from `JWT_SECRET`** in prod)
- Strategy: `ShareJwtStrategy(Strategy, 'share-jwt')`
- Guard: `ShareAuthGuard extends AuthGuard('share-jwt')` — applied per-route
- Payload: `{ kind: 'share', shareLinkId, projectId, scopes, exp }`
- TTL: `SHARE_JWT_EXPIRES_IN` (default `2h`)

### Cross-rejection (defense-in-depth)

Both strategies check the `kind` claim explicitly:

- `JwtStrategy.validate`: `if (payload.kind === 'share') throw UnauthorizedException`
- `ShareJwtStrategy.validate`: `if (payload.kind !== 'share') throw UnauthorizedException`

Even if `JWT_SECRET` and `JWT_SHARE_SECRET` were ever set to the same
value (operator misconfig), a share token still cannot reach the
internal API — and a user token still cannot reach the public read.
The strategies and the secrets are independently sufficient.

### Why a separate JwtService instance isn't needed

`JwtModule.register({})` is imported into `ShareLinkModule` with no
default secret. `UnlockShareLinkUseCase` calls
`jwt.sign(payload, { secret, expiresIn })` with both options
**explicitly** every time — the module-level config is intentionally
empty so a future contributor can't accidentally sign a share token
with `JWT_SECRET`.

---

## 5. Endpoint surface

```
Admin (under existing user JWT + ProjectMemberGuard + RolesGuard(ADMIN, PM))
  POST   /api/projects/:projectId/share-links                  create
  GET    /api/projects/:projectId/share-links                  list (no passcode hash)
  PATCH  /api/projects/:projectId/share-links/:id/revoke       soft delete (idempotent)
  PATCH  /api/projects/:projectId/share-links/:id/rotate-passcode
  DELETE /api/projects/:projectId/share-links/:id              ADMIN only — hard delete

Public (no user JWT; @Public()):
  POST   /api/public/share/:token/unlock          ← @Throttle 5/min/IP, returns share JWT
  GET    /api/public/share/:token/project         ← ShareAuthGuard
  GET    /api/public/share/:token/timeline        ← ShareAuthGuard

Mutation endpoints under `/api/projects/*` and `/api/external/*` are unchanged.
They reject share JWTs by `kind` claim — no other modification needed.
```

---

## 6. Sequence flows

### 6.1 Create + share

```
PM   web                       api                     db
 │    │                          │                       │
 │ Share button (TimelinePage)   │                       │
 │ ─→ │                          │                       │
 │    │ open ShareLinkDialog     │                       │
 │    │ generate passcode (FE)   │                       │
 │    │                          │                       │
 │    │ POST /share-links        │                       │
 │    │ (passcode, scopes,       │                       │
 │    │  expiresAt)              │                       │
 │    │ ───────────────────→ JwtAuthGuard + RolesGuard   │
 │    │                          │ bcrypt.hash           │
 │    │                          │ randomBytes(16) tok   │
 │    │                          │ ───────→ INSERT       │
 │    │                          │ ←─────── row          │
 │    │ ←─────────────────────── {id, token, url}        │
 │    │ reveal URL + passcode    │                       │
 │ ←──│ (Copy URL + passcode)    │                       │
 │ send to client                │                       │
```

### 6.2 Client unlock + read

```
client browser                api                       db
 │                              │                          │
 │ GET /share/<token>           │ (FE route, no API hit)   │
 │ form passcode                │                          │
 │ POST /public/share/:token    │ ThrottlerGuard 5/min/IP  │
 │ /unlock {passcode}           │ ──────────────→          │
 │                              │ UnlockShareLinkUseCase    │
 │                              │  findByToken              │
 │                              │  canUnlock(now)           │
 │                              │    revoked? → 410        │
 │                              │    expired? → 410        │
 │                              │    locked?  → 423        │
 │                              │  bcrypt.compare           │
 │                              │    fail → 401 + bump      │
 │                              │      failedAttempts       │
 │                              │      lockedUntil if 20+   │
 │                              │    ok →                   │
 │                              │      accessCount++        │
 │                              │      reset counters       │
 │                              │      jwt.sign({kind, ...})│
 │ ← 200 { shareJwt, ... }      │                          │
 │ store in sessionStorage      │                          │
 │ navigate /timeline           │                          │
 │                              │                          │
 │ GET /public/share/:token/    │ ShareAuthGuard           │
 │ timeline                     │ ────────→                │
 │ Authorization: Bearer ...    │ verify share JWT          │
 │                              │ requireFreshLink:         │
 │                              │   findByToken(:token)     │
 │                              │   JWT.shareLinkId ==      │
 │                              │     row.id?               │
 │                              │   canUnlock(now)?         │
 │                              │   → revoked since unlock? │
 │                              │     410 (immediate)       │
 │                              │ GetPublicTimelineUseCase  │
 │                              │ IssueQueryService.findAll │
 │                              │   (limit=200)             │
 │                              │ toPublicTimelineIssue     │
 │                              │   (whitelist mapper)      │
 │ ← 200 { issues[] }           │                          │
 │ map → Issue shape (FE)       │                          │
 │ render TimelineLabelColumn + │                          │
 │   TimelineChart              │                          │
```

The **load-bearing step** is `requireFreshLink` — every public read
re-fetches the row and re-checks `revokedAt` / `expiresAt`. A valid
JWT alone never grants access; the row must still be live. This is
what makes revoke take effect immediately rather than waiting up to
2h for the JWT to expire on its own.

### 6.3 Brute-force lockout

```
attacker          api                              db
 │                  │                                 │
 │ 19× wrong pass   │ bcrypt.compare → false          │
 │                  │ recordFailure(19, 20, 60min)    │
 │                  │ → {failedAttempts: 20,          │
 │                  │    lockedUntil: now + 60min}    │
 │                  │ ─────→ UPDATE share_links       │
 │                  │                                 │
 │ 20th wrong pass  │ findByToken → row              │
 │                  │ canUnlock(now) → {LOCKED}       │
 │                  │ NOT bcrypt-comparing            │
 │                  │ (timing-safe — same response    │
 │                  │  whether passcode was correct)  │
 │ ← 423 {retryAfterSeconds: 3600}                   │
 │                                                    │
 │ ... 60 min elapse ...                              │
 │                  │ canUnlock → ok                  │
 │                  │ (lockedUntil < now)             │
 │                  │ bcrypt.compare → run            │
 │ correct passcode │ → success, reset counters       │
```

Key property: in the locked window, **correct passcodes get the same
423 response as wrong ones**. The branch that returns 423 sits *before*
the bcrypt-compare, so an attacker who guesses the right passcode
mid-lockout learns nothing.

---

## 7. The whitelist boundary

```
Prisma Issue row  ── findAll() ──→  toPublicTimelineIssue() ──→ PublicTimelineIssue
                                          (mapper)

Allowed across:  id, number, title, type, status, priority,
                 startDate, dueDate, parentId, createdAt,
                 assignee {name, avatar},
                 labels [{name, color}]

Dropped:         description, comments, activities, attachments,
                 reviewerAssignee, creator, source, isRecheck,
                 archivedAt, focusDate, order, _count,
                 assignee.id, assignee.email, components,
                 specLinks, githubPrLinks, issueLinks
```

The mapper is a hand-curated whitelist (`get-public-timeline.use-case.ts`,
`toPublicTimelineIssue`). It does **not** read from the internal
`Issue` serializer or `ISSUE_INCLUDE` shape — if it did, the next field
added to the internal API would silently become public.

`createdAt` is included because the FE timeline lib uses it as the bar
anchor when `startDate` is null (`computeBarStyle` in
`features/timeline/lib.ts`). It's a timestamp only, no PII; the
project's age is already implied by the issue-number counter.

---

## 8. Frontend integration

### 8.1 Two axios instances

```
main client (shared/api/client.ts)
  baseURL=/api
  Auth: localStorage 'token' + refresh dance
  401 → trigger refresh → retry
  → all internal screens, including ShareLinkDialog (admin tab)

public client (features/share-link/api/publicApi.ts)
  baseURL=/api/public
  Auth: sessionStorage 'bbpm.share.${token}' (per-tab)
  No refresh dance — re-prompt for passcode
  401 OR 410 → clear local JWT (interceptor)
  → only the public passcode + timeline pages
```

The split is intentional: the public client cannot accidentally hit an
internal endpoint, and the internal client cannot accidentally hit a
public endpoint. A leak of one auth source doesn't widen the blast
radius into the other.

### 8.2 Reusing internal Timeline components without modifying them

`SharedTimelinePage` does NOT mode-fork the internal `TimelinePage`. It
composes the same leaf components (`TimelineLabelColumn`,
`TimelineChart`, `TimelineTooltip`) and reuses the timeline hooks
(`useTimelineDateRange`, `useTimelineGroups`, `useTimelineRows`) via
an adapter `toIssueShape`:

```ts
PublicTimelineIssue  ── toIssueShape() ──→ Issue (FE type)
```

The adapter fills internal-only fields with safe defaults so the hooks
don't crash, but the public render path never displays those defaults —
the click handler opens `PublicIssueModal` which only renders the
whitelist fields. This means:

- Zero risk of regression in the internal Timeline.
- New internal fields don't accidentally leak into the public view.
- New public fields require an explicit BE whitelist + FE adapter
  edit — two-step gate.

### 8.3 Redirect semantics

When the public timeline gets a 401 or 410, `SharedTimelinePage`
navigates back to `/share/:token` carrying a `location.state.reason`
so the passcode page can show *why*:

| Path | State reason | Banner shown |
|---|---|---|
| 401 (token expired) | `session-expired` | amber: "Your session expired. Enter the passcode again." |
| 410 (revoked / expired link) | `gone` | red: "This share link is no longer available." |

The publicApi interceptor clears the local JWT on **both** 401 and
410. Without clearing on 410 the passcode page would see a still-valid
JWT and bounce back into the broken state — that was a real bug fixed
during PR2.

---

## 9. Threat model

| # | Threat | Mitigation | Where it lives |
|---|---|---|---|
| 1 | Link leak (Slack / screenshot) | Passcode is a second factor; bcrypt at rest; revocable per-link | `passcodeHash`, `revoke` use case |
| 2 | Brute-force passcode | bcrypt cost 10 + `@Throttle 5/min/IP` + per-link 20-fail lockout for 60min | `unlock.public.controller.ts`, `recordFailure` |
| 3 | Token enumeration | 32-hex (128-bit) entropy; unknown-token returns the same 401 as wrong passcode; FE shape pre-check `/^[a-f0-9]{32}$/i` returns 400 with the same message | `crypto.randomBytes`, `isLikelyToken`, controller |
| 4 | Timing attack on passcode | bcrypt-compare is constant-time; locked state is checked *before* compare so locked-correct and locked-wrong are indistinguishable | `canUnlock`, then `compare` |
| 5 | Share JWT misused on internal API | `JwtStrategy.validate` rejects `kind: 'share'`; even if both secrets matched, the kind-check holds | `jwt.strategy.ts` |
| 6 | User JWT misused on public API | `ShareJwtStrategy.validate` rejects payloads without `kind: 'share'` | `share-jwt.strategy.ts` |
| 7 | JWT replay after revoke | Every public read re-fetches the row and re-runs `canUnlock` | `requireFreshLink` in `share-link.public.controller.ts` |
| 8 | URL swap mid-session (JWT for link A on path of link B) | `requireFreshLink` checks `JWT.shareLinkId === row.id` for the path's `:token` | same |
| 9 | Data leak via internal endpoints | Public surface is a separate controller (`/api/public/share/*`); internal endpoints unchanged; mapper is a hand-curated whitelist, not derived from internal includes | `share-link.public.controller.ts`, `toPublicTimelineIssue` |
| 10 | Stale link forgotten | Default 90-day expiry, `expiresAt` enforced at every read; PM can opt for "No expiry" but the UI hints at the risk | `CreateShareLinkDto`, ShareLinkDialog |
| 11 | Operator misconfig (`JWT_SHARE_SECRET` defaults to dev value) | `:?must be set` in `docker-compose.prod.yml`; module also throws on missing env at boot | docker compose, `ShareJwtStrategy` constructor |
| 12 | Naming collision with existing `share/` module (OG unfurl at `/share/PITB-12`) | New module is `share-link/`; new route prefix is `/api/public/share/*`; FE route `/share/:token` has 32-hex token which can never collide with `PITB-12` style keys | module + route naming |

---

## 10. Out of scope (Phase 2+)

- **Board / Calendar / Lists share** — schema's `scopes[]` already
  allows it. Phase 2 adds a public endpoint per surface + flips the
  scope checkbox in the dialog.
- **Per-link granular permission** (share only one Domain or one Epic)
  — extend the row with `scopeFilter: Json` (e.g. `domainIds[]`).
- **Per-user passcode** — multiple passcodes under one link, one per
  client. Currently a single passcode per link.
- **Audit access log table** — `(shareLinkId, ip, ua, accessedAt)`
  table + an admin view. Currently we only track `accessCount` /
  `lastAccessedAt` on the link itself.
- **Magic-link email** — PM enters client email → server sends
  URL+passcode via Notification module.
- **MCP tool `create_share_link`** — agent-facing endpoint via
  `external.controller.ts` + bbpm-mcp.

---

## 11. Related

- Changelogs: [`auth-changelog.md` (PM-60 PR1)](../../changelogs/auth-changelog.md), [`issue-changelog.md` (PM-60 PR1)](../../changelogs/issue-changelog.md), [`ui-changelog.md` (PM-60 PR2)](../../changelogs/ui-changelog.md).
- Plan with decisions log: [`docs/plans/public-share-link.md`](../../plans/public-share-link.md).
- BB PM ticket: [PM-60](https://pm.burningbros.kr/projects/PM/board?open=d29c59c5-2506-4afd-a01c-fd15e3eeb3de) + sub-tasks PM-61 (BE), PM-62 (FE-core), PM-63 (FE-admin, collapsed into PR2).
