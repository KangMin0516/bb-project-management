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
  - `GET /api/public/share/:token/doc-comments/counts` — open/resolved head counts per document, for nav badges
  - `POST /api/public/share/:token/doc-comments` — new thread, or a reply via `parentId` (40/min)
  - `PATCH /api/public/share/:token/doc-comments/:commentId/resolve` — resolve/reopen a thread head (60/min)
  - `DELETE /api/public/share/:token/doc-comments/:commentId` — delete own comment (40/min)
- **Header**: `X-Doc-Author-Key` — opaque per-browser id. Not authentication; it only decides which rows the caller may delete and which come back flagged `mine`.
- **No member-facing surface yet.** Comments are not visible inside the BB PM web UI — see *Open questions* below.

## Timeline

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
