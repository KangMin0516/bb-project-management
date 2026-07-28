# Doc Comment Changelog

> Notion-style inline comments anchored to a span of text inside a document **this API does not host** — currently the Saramin VN feature-spec site, a static Vite build with no database of its own. Read and written through a passcode-gated share link.

## Owns

- **Modules**: `packages/api/src/doc-comment/` (`domain/`, `application/`, `infrastructure/`, public controller, module)
- **Tables**: `doc_comments` (Prisma model `DocComment` in `packages/api/prisma/schema.prisma`)
- **Migrations**: `packages/api/prisma/migrations/*_add_doc_comments`
- **Enum**: the `COMMENT` member of `ShareScope` (the enum itself is owned by the share-link surface — see `project-changelog.md`)
- **Frontend**: no *reading* surface in `packages/web` — the only client today lives in the separate `saramin-template/SARAMIN` repo (`src/comments/`). The `COMMENT` tickbox in `features/share-link/` belongs to the share-link feature; this domain only defines what the scope means.

### Not owned — three comment models, on purpose

| Model | Anchored to | Author | Why it didn't fit |
|---|---|---|---|
| `Comment` | an Issue (required FK) | member | A spec page is commentable before anyone has filed an issue for it. |
| `SpecComment` | a `SpecSection` row we host | member (`userId` required) | An external reviewer has no BB PM account, and the section rows don't exist for a doc we don't host. |
| `DocComment` | a text quote in an arbitrary document | member **or** share-link guest | — |

## Surface

- **HTTP routes** — all under the public share surface, `@Public()` + `ShareAuthGuard` + the `COMMENT` scope, re-checked on every call by `VerifyShareAccessUseCase`:
  - `GET /api/public/share/:token/doc-comments?docKey=…` — every thread on one document
  - `GET /api/public/share/:token/doc-comments/all` — every thread in the project, each with its own `docKey`, plus `truncated`; capped at 1000. What the spec-site rail polls.
  - `GET /api/public/share/:token/doc-comments/counts` — open/resolved head counts per document. Nothing calls it since the rail started counting from `/all`.
  - `POST /api/public/share/:token/doc-comments` — new thread, or a reply via `parentId` (40/min)
  - `PATCH /api/public/share/:token/doc-comments/:commentId/resolve` — resolve/reopen a thread head (60/min)
  - `DELETE /api/public/share/:token/doc-comments/:commentId` — delete own comment (40/min)
- **Identity, two sources.** A guest sends `X-Doc-Author-Key`, an opaque per-browser id — not authentication; it only decides which rows the caller may delete and which come back flagged `mine`. A member who unlocked via `POST /api/public/share/:token/unlock-member` (BB PM OAuth token or API key, plus a `ProjectMember` row on the project) carries `userId` inside the share JWT, and their comments are signed with that account. Account identity beats browser key wherever the two disagree.
- **Visibility is role-scoped.** A thread is *internal* (a BB PM user started it) or *external* (a guest did). Guests see external, DEVELOPERs see internal plus threads they posted in, PM/ADMIN see both; PM/ADMIN may also delete anyone's comment. Role is re-read per request, not taken from the JWT. See the 2026-07-28 entry below for the full table and reasoning.
- **No member-facing surface yet.** Comments are not visible inside the BB PM web UI — see *Open questions* below.

## Timeline

### 2026-07-28 — Internal and client comments stop being the same pile

**Added. Security.** Until member sign-in landed earlier today, every comment was a share-link guest's and everyone holding the link could read all of them — which was fine, because there was nothing to separate. The moment the team could comment as themselves, "internal" became a real category with nothing enforcing it: **a client holding the passcode could read the team's internal notes**, and role played no part anywhere — `ProjectRole` was never read on this surface.

A thread is now **internal** when a BB PM user started it and **external** when a guest did, and that one axis decides visibility:

| Caller | Sees | Deletes | Resolves |
|---|---|---|---|
| Passcode guest | external threads | own (browser key) | anything they can see |
| DEVELOPER | internal threads, plus any thread they posted in | own (account) | anything they can see |
| PM / ADMIN | everything | anything | anything |

- **Classified by the head, never per comment.** A thread is one conversation; hiding half would leave a reply dangling under a question the reader can't see. The whole thread goes or none of it does.
- **One softening, deliberate:** a member keeps seeing a thread they have posted in whatever its head is. Otherwise a role change — or any thread from before this rule — makes somebody's own words vanish, and a comment tool that eats your comment is worse than one that shows more than it strictly must.
- **404, not 403, for a thread you may not see.** Delete, resolve and reply-to all check visibility first and answer with the same "no longer exists" as a genuinely missing row, so an id can't be probed for existence. A thread you *can* see but don't own still gets 403 — the distinction is deliberate.
- **Role is re-read from the database on every call**, in `VerifyShareAccessUseCase`, not trusted from the 12h share JWT. A demotion or a revoked membership bites now; a member whose `ProjectMember` row is gone gets 403 rather than being quietly downgraded to guest, since the session was issued on the strength of that membership.
- **`canDelete` is now a field on the view.** The client stopped inferring the delete button from `mine`, so the UI can't offer a moderator action the use case would refuse — or hide one it would allow.
- **`/doc-comments/counts` counts the filtered set**, not a `GROUP BY` over the table: a badge reading "3" on a page where the caller can open nothing would leak that an internal conversation exists.
- **Known consequence, worth stating plainly:** every comment that existed before member sign-in is guest-authored, so it is all *external*. DEVELOPERs therefore see very little until internal threads accumulate, and PM/ADMIN see the backlog as before.
- Verified against a scratch Postgres over HTTP with four credentials (guest, DEVELOPER, a second DEVELOPER, PM) and three threads (external, internal, mixed): each role's read set is exactly the table above; guest→internal delete/resolve/reply all 404; a non-participant DEVELOPER replying to a client thread 404s; a DEVELOPER deleting a PM's comment 403s; a PM deletes a client thread that carries someone else's reply (200, moderator bypass of the usual 409); and deleting the `ProjectMember` row mid-session turns the next read into 403.
- Source: `packages/api/src/doc-comment/domain/doc-comment.entity.ts` (+ spec), `packages/api/src/doc-comment/application/visibility.ts`, `list-doc-comments.use-case.ts` (+ spec), `create-doc-comment.use-case.ts`, `resolve-doc-comment.use-case.ts`, `delete-doc-comment.use-case.ts`, `doc-comment.view.ts`, `doc-comment.public.controller.ts`, `packages/api/src/share-link/application/verify-share-access.use-case.ts`.

### 2026-07-28 — A project-wide read, so the rail can list the whole review

**Added.** The only read was per-document, which meant the publishing site could show you the comments on the page you were already looking at — and nothing else. The nav badge said "3", and finding out what those three said meant opening each feature in turn. Comments left on a page nobody thought to revisit simply went unread. `GET /doc-comments/all` returns every thread in the project, each carrying its own `docKey`, and the client now polls that instead of the per-document route and filters locally.

- **Same request count.** This *replaces* the per-document poll rather than adding to it, and the client also stopped calling `/doc-comments/counts` — nav badges are now counted from the list it already holds, so a badge and the rail can no longer disagree. Both routes stay for compatibility; nothing calls `/counts` today.
- **Bounded, and honest about it.** `MAX_PROJECT_COMMENTS = 1000` with no cursor: the repository fetches `limit + 1` as a probe and the response carries `truncated`, which the rail renders as a line telling the reader what it couldn't show. A half-set that reads as complete is the failure mode worth avoiding here.
- **Truncation cannot orphan a reply.** Rows come back oldest-first, and a head is always older than its replies — so anything whose head fell outside the cap fell outside it too.
- Read throttle is the same 240/min as the other reads; the payload is larger (every body, not one page's) which is the deliberate trade for one request per poll.
- The write path is untouched: a reply still inherits its head's `docKey`, so nothing about posting depends on which page the rail was opened from.
- Verified against a scratch Postgres with threads seeded across four pages: heads and replies fold correctly across documents, resolved threads are included for the client to filter, and the client-side jump navigates to the thread's page and scrolls to its quote (`scrollY` 1678 for a quote 1791px down).
- Source: `packages/api/src/doc-comment/application/list-doc-comments.use-case.ts` (+ spec), `packages/api/src/doc-comment/application/ports/doc-comment.repository.ts`, `packages/api/src/doc-comment/infrastructure/doc-comment.prisma.repository.ts`, `packages/api/src/doc-comment/doc-comment.public.controller.ts`, `packages/api/src/doc-comment/doc-comment.module.ts`. Client half in the SARAMIN repo: `src/comments/CommentRail.tsx`, `CommentsProvider.tsx`, `docTitle.ts`.

### 2026-07-28 — BB PM members sign in instead of sharing a passcode

**Added.** The spec site had exactly one way in: a passcode every reader shares, which makes every comment anonymous until its author types a name — so the team's own comments arrived as "Guest" or as whatever someone last typed. A member can now unlock through BB PM's existing OAuth 2.1 authorization server (the one claude.ai's MCP connector already uses): the browser leaves for `/oauth/authorize`, logs in and consents, comes back with a code, and the site exchanges it for a share JWT that carries their account. Their comments then resolve to their real name and avatar, `isGuest: false`, from the read path that already knew how to render them. The passcode stays exactly as it was for client reviewers and anyone without an account.

- **New route:** `POST /api/public/share/:token/unlock-member` (10/min), guarded by `ApiKeyGuard` so it accepts either an OAuth access token or a personal API key. Returns the same payload as `/unlock` plus `member: { id, name, avatar }`.
- **Membership, not just authentication.** The credential says who you are; a `ProjectMember` row on the link's project is what lets you sign your name to its review. A BB PM user outside the project gets 403 with "use the passcode instead" — deliberately not a 401, so the client can offer the other path instead of re-prompting.
- **The access token is never stored by the site.** It is spent once here and dropped, because `ApiKeyGuard` accepts a `bbpm_at_…` bearer on every external route regardless of scope — it is a full-account credential, and a static review site has no business holding one. What persists is the share JWT, which can only comment on this one project. The site therefore requests `openid profile email` and never `mcp`.
- **Member JWTs live 12h** (`SHARE_JWT_MEMBER_EXPIRES_IN`) against the guest's 2h: a guest session renews silently from the stored passcode, while a member's can only renew by bouncing through the redirect, which loses the reader's place mid-review.
- **`SharePayload` gained optional `userId` + `userName`**, and is now defined once in `share-jwt.strategy.ts` — `unlock-share-link.use-case.ts` had a second copy of the same interface.
- **Ownership is now two-tier.** `canDelete` prefers account identity over browser key, so a member owns their comment on a second machine and *doesn't* own another member's comment that happens to share a browser key. `mine` in the view mirrors the same rule — a delete button the use case would refuse is worse than no button.
- **A member's `resolvedBy` comes off their JWT**, not the client-supplied `by`; likewise a `guestName` sent alongside a member session is dropped rather than stored as a second name for the same author.
- **Lockout does not apply to members.** `canUnlock`'s `LOCKED` state is the passcode brute-force defence, so someone else guessing must not shut the door on an authenticated member.
- No migration: `doc_comments.user_id` and the `isGuest` read path have existed since the table was created — only the write path never set them.
- Verified end-to-end against a scratch Postgres: login → consent → form-encoded PKCE token exchange → `unlock-member` → post → read. Confirmed 401 without a credential, 403 for a non-member, `userId`/`userName` in the minted JWT at a 12h TTL, `isGuest: false` with the real name and avatar on the posted comment, `mine: true` for the same account from a browser with *no* author key, 403 when a guest tries to delete a member's comment, `resolvedBy` overriding a spoofed `by`, and the passcode guest path unchanged.
- Source: `packages/api/src/share-link/application/unlock-share-link-as-member.use-case.ts` (+ spec), `packages/api/src/share-link/share-link.public.controller.ts`, `packages/api/src/share-link/share-link.module.ts`, `packages/api/src/share-link/strategies/share-jwt.strategy.ts`, `packages/api/src/share-link/application/unlock-share-link.use-case.ts`, `packages/api/src/doc-comment/**` (domain `canDelete` + spec, view, four use cases, port, Prisma repo, public controller). Client half in the SARAMIN repo: `src/comments/oauth.ts`, `OAuthCallback.tsx`, `UnlockDialog.tsx`.

### 2026-07-28 — Read routes get their own throttle ceiling
**Fixed.** The two GET routes inherited the app-wide default of 30 req/min/IP (`ThrottlerModule.forRoot` in `app.module.ts`), but the spec-site client polls the open document every 5s — 12 requests/min *per viewer*. An office shares one NAT address, so the counter is effectively per-company: the third reviewer to open the site started getting 429s, in the exact scenario the feature is for. Found while smoke-testing the deployed site, not in review.

- `GET /doc-comments` and `GET /doc-comments/counts` now allow 240/min, leaving room for ~20 concurrent viewers behind one address. Each is a single indexed read on `(project_id, doc_key)`.
- Writes keep their tighter limits (40/min create + delete, 60/min resolve) — the ceiling that matters for abuse is unchanged.
- The client half (429 → transient, exponential backoff, no error banner) lives in the SARAMIN repo; without it a throttled reader saw the raw `ThrottlerException` text in the comment rail.
- Source: `packages/api/src/doc-comment/doc-comment.public.controller.ts`.

### 2026-07-28 — COMMENT scope selectable in the share-link dialog
**Fixed.** The `COMMENT` scope shipped in the API and the enum but the create-link dialog still hardcoded `scopes: ['TIMELINE']` behind a disabled checkbox labelled "(more coming in Phase 2)" — so the scope existed and nothing could ever be granted it. The dialog now offers a real scope picker, `COMMENT` is flagged **writes** (it is the only scope that lets a link holder change anything on our side), and Create is blocked on an empty selection.

- Manage rows now show each link's scopes, so a project with several links says which is which without opening each one.
- Copy that promised "read-only" is now wrong for a `COMMENT` link and was corrected on the dialog, the Share links page, and the settings section.
- `BOARD` / `CALENDAR` / `LISTS` are deliberately still not offered: they exist in the enum but have no public read surface, so a link granted one would 403 on use.
- Source: `packages/web/src/features/share-link/components/ShareLinkDialog.tsx`, `packages/web/src/features/share-link/api/shareLinkApi.ts`, `packages/web/src/pages/ShareLinksPage.tsx`, `packages/web/src/features/project/components/settings/ShareLinksSection.tsx`.

### 2026-07-28 — Doc comments over share links (deployed, `271455c`)
**Added. Schema.** Reviewers of the Saramin VN spec site can select any text and leave a threaded comment, stored in BB PM instead of in a Notion page nobody keeps in sync. Anchoring follows the W3C annotation shape — a `quote` plus `prefix`/`suffix` context plus a `textOffset` tiebreaker — so a comment survives edits elsewhere on the page; when the quoted text really is gone the thread is flagged *orphaned* to the client rather than deleted.

- **Threads are one level deep.** A head has `parentId = null`; replies point at a head and inherit its `docKey` and anchor (a reply's client-supplied `docKey` is ignored — trusting it would let a reply drift onto another page).
- **Resolve is a property of the head**, open to anyone holding the link: the person who can answer a question is rarely the one who asked. Re-resolving keeps the first resolver and timestamp.
- **Delete is author-only**, keyed by `authorKey`, and refuses a head that carries replies from other people (the FK cascade would take them with it) — 409 with "resolve it instead".
- **`authorKey` is never serialised.** `doc-comment.view.ts` is the single mapping from row to client shape; it drops the key and substitutes a `mine` boolean. That one function is what separates "delete your own comment" from "delete anyone's".
- **Guests, not accounts.** `guestName` is a display string with no uniqueness enforced; `userId` stays null for share-link traffic. Both nullable so a deleted user doesn't take the comment with them.
- **Scope gates writes.** `COMMENT` is the first `ShareScope` that grants a write, so it is never implied by another scope and is read off the freshly-loaded link row, not off the JWT — narrowing a link's scopes bites immediately instead of at JWT expiry.
- Migration: `20260728120000_add_doc_comments` — creates `doc_comments` (indexed on `(project_id, doc_key)` and `parent_id`) and adds `COMMENT` to the `ShareScope` enum.
- Verified against a scratch Postgres with a 28-case end-to-end suite: passcode rejection, scope gating, cross-link JWT replay (410), reply-depth limit, delete authorisation (403/409), resolve idempotency, `authorKey` non-disclosure, and `docKey` normalisation.
- Source: `packages/api/prisma/schema.prisma`, `packages/api/src/doc-comment/**`, `packages/api/src/app.module.ts`.

### 2026-07-28 — Share-access check extracted from the public controller (`271455c`)
**Changed.** `ShareLinkPublicController` carried `getValidatedClaims` + `requireFreshLink` as private methods. Doc comments need byte-identical rules, and a second copy is how a revoked link keeps working on one surface after being fixed on the other — so the check moved into `VerifyShareAccessUseCase` (claims present → JWT/token binding → `canUnlock` → project not archived → scope granted) and both controllers now call it. `ShareLinkModule` exports the use case; `claimsOf()` moved next to `SharePayload` in the strategy.

- No behaviour change to the timeline surface: the same four checks run in the same order, and the scope check still reads `link.scopes`, not the JWT's snapshot.
- Source: `packages/api/src/share-link/application/verify-share-access.use-case.ts`, `packages/api/src/share-link/share-link.public.controller.ts`, `packages/api/src/share-link/share-link.module.ts`, `packages/api/src/share-link/strategies/share-jwt.strategy.ts`.

---

## Open questions / known issues

- **No member-facing view.** Comments left on the spec site are invisible inside BB PM — there is no `packages/web` surface and no notification, so a question only reaches the team if someone opens the spec site. The intended fix is either a project-level "Doc comments" page or an outbox-driven Slack/notification fan-out on create; neither is built.
- **Polling, not realtime.** The API has no WebSocket or SSE transport, so the client polls every 5s. Fine for review comments; it would not carry a live-collaboration feature.
- **`docKey` is unvalidated.** A `COMMENT`-scoped link can write comments under any `docKey` string in its own project. Bounded by the 300-char column and the write throttle; the blast radius of a leaked link is spam that a PM can delete, not cross-project access.
- **No edit.** A comment can be deleted and re-posted but not edited in place; `updatedAt` exists for when that changes.
