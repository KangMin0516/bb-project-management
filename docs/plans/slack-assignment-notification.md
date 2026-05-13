# Plan: Slack DM the new assignee on every issue assignment

> **Status**: Proposed
> **Domain**: `slack`, `notification`, `issue` (see [`docs/changelogs/slack-changelog.md`](../changelogs/slack-changelog.md), [`docs/changelogs/notification-changelog.md`](../changelogs/notification-changelog.md))
> **Related**: extends the existing `notifyAssignment` path at `packages/api/src/issue/issue.service.ts:72`.

---

## Requirement summary

- **What**: when an issue's assignee changes, in addition to creating the existing in-app `notifications` row, the system DMs the new assignee on Slack with a link to the issue.
- **Why**: today users have to manually open the web app to see new assignments. The standup bot already DMs them daily, the bot has `im:write` scope, and `users.slack_user_id` is already populated by the standup mapping flow — so the infra is 90% there.
- **For whom**: any user who has connected their Slack identity (i.e., `users.slack_user_id IS NOT NULL`). Users without Slack mapping keep getting only the in-app notification.

---

## Affected services

- **Services**: `api` only. No web change. No DB change.
- **Files to modify**:
  - `packages/api/src/slack/slack.service.ts` — add `sendDirectMessage(slackUserId, text, blocks?)` helper (mirrors the standup pattern at `packages/api/src/standup/standup.service.ts:300-346`).
  - `packages/api/src/notification/notification.service.ts:48-60` — after the DB insert in `create()`, if `type === 'ASSIGNED'` and the recipient has `users.slack_user_id`, fire-and-forget `slackService.sendDirectMessage(...)`.
  - `packages/api/src/notification/notification.module.ts` — import `SlackModule` to inject `SlackService`.
  - `packages/api/src/common/constants.ts` — add a `WEB_APP_URL` resolver or reuse the existing `FRONTEND_URL` env var (already consumed by `MgmtDigestService`).
- **New files**: none.
- **DB / Prisma**: none — `users.slack_user_id` already exists (`packages/api/prisma/schema.prisma:26`).

---

## Proposed implementation

### Step 1 — Add `SlackService.sendDirectMessage`

In `packages/api/src/slack/slack.service.ts`, add a helper that:

1. Looks up the most-recent `SlackIntegration` (mirrors `getStatus()` at `:329` and the standup at `:691`):
   ```ts
   const integration = await this.prisma.slackIntegration.findFirst({
     orderBy: { createdAt: 'desc' },
   });
   if (!integration) return; // no Slack installed, skip silently
   ```
2. Decrypts the bot token and builds a `WebClient` (re-use the existing `decrypt` helper at `:48`).
3. Calls `conversations.open({ users: slackUserId })` → grabs `dm.channel.id`. Skip if `dm.channel?.id` is missing (DM disabled, user deactivated).
4. Calls `chat.postMessage({ channel: dmChannelId, text, blocks })` — wrap in the existing retry loop pattern from `sendMessage()` at `:249-291` (handles `ratelimited` with exponential backoff up to 3 retries).
5. Logs warnings on every catch — does **not** throw upward.

Signature:
```ts
async sendDirectMessage(
  slackUserId: string,
  text: string,                       // plain-text fallback for notifications
  blocks?: unknown[],                  // optional rich blocks
): Promise<void>
```

### Step 2 — Wire `SlackService` into `NotificationModule`

In `packages/api/src/notification/notification.module.ts`:
- `imports: [SlackModule]` so `SlackService` is injectable.
- Update `NotificationService` constructor to inject `SlackService`.

This means `SlackService` must remain exported from `SlackModule` (it already is at `slack.module.ts:8`).

### Step 3 — Trigger DM from `NotificationService.create`

In `packages/api/src/notification/notification.service.ts`, after the existing `prisma.notification.create({ data })`:

```ts
async create(data: {...}) {
  if (data.actorId === data.userId) return null; // self-action, skip everything

  const notification = await this.prisma.notification.create({ data });

  if (data.type === 'ASSIGNED') {
    this.fireSlackDm(notification.id, data).catch((err) =>
      this.logger.warn('Slack DM failed', err instanceof Error ? err.message : String(err)),
    );
  }

  return notification;
}
```

The `fireSlackDm` helper:
1. Fetches `recipient = users.findUnique({ where: { id: data.userId }, select: { slackUserId: true } })`.
2. If `recipient.slackUserId == null`, returns early — user hasn't linked Slack, in-app is enough.
3. Builds the Slack blocks (see "Message format" below).
4. Calls `slackService.sendDirectMessage(recipient.slackUserId, fallbackText, blocks)`.

Fire-and-forget: never blocks the issue PATCH response on Slack latency.

### Step 4 — Message format

**Plain-text fallback** (used by Slack notifications + clients that don't render blocks):
```
You've been assigned BBPM-123 "Fix login redirect bug" by Alice
```

**Rich blocks** (rendered in the Slack DM):
```
📋 *You've been assigned a new issue*

*BBPM-123* — Fix login redirect bug
*Status*: TODO   *Priority*: HIGH   *Type*: BUG
*Assigned by*: Alice

[View in BB-PM]
```

The "View" button links to `${FRONTEND_URL}/projects/${projectKey}/issues/${issueId}` — `FRONTEND_URL` already used by `MgmtDigestService` (see `packages/api/src/report/mgmt-digest.service.ts`). Default `http://localhost:5173` in dev.

To build the blocks, `fireSlackDm` needs `projectKey` + `issueNumber` + `issueTitle` + `actorName`. Easiest: extend the `notifyAssignment` caller (`issue.service.ts:81`) to pass these in `data.meta` rather than fetching again. Alternative: refetch inside the helper. Recommendation: pass via `data.meta` to avoid extra queries on the hot path.

### Step 5 — Tests + manual verification

No backend unit-test infrastructure for this exact path. Manual smoke:
1. As user A: assign an issue to user B. → user B (with Slack linked) gets a DM with the right blocks and a working "View" link.
2. Assign an issue to a user without `slackUserId`. → only in-app notification; no error in logs.
3. Slack disconnected (no `slack_integrations` row). → no error, in-app notification still works.
4. Slack rate-limited (force by mocking) → existing retry path kicks in.
5. User C self-assigns. → no notification (existing `actorId === userId` skip).

### Step 6 — Update changelogs

After merge:
- Add an entry to [`docs/changelogs/slack-changelog.md`](../changelogs/slack-changelog.md): "Added — `sendDirectMessage(slackUserId, text, blocks?)` helper, used by assignment notifications".
- Add an entry to [`docs/changelogs/notification-changelog.md`](../changelogs/notification-changelog.md): "Changed — `ASSIGNED` notifications now also DM the recipient on Slack when their account is linked."
- Add an entry to [`docs/changelogs/issue-changelog.md`](../changelogs/issue-changelog.md): one-line cross-reference.

---

## API changes

**None on the public surface.** `POST/PATCH /api/projects/:projectId/issues` and `PATCH .../bulk` are unchanged. The Slack DM is a side effect of the existing `notifyAssignment` call.

---

## UI / UX changes

- No changes to the web UI.
- Slack DM appears in the user's "Apps" → BB-PM bot DM thread (or wherever the user installed the bot).

---

## Risks & considerations

| # | Risk | Mitigation |
|---|---|---|
| 1 | User has no `slack_user_id` (never used standup) → no DM. | Acceptable: in-app notification still fires. Document this in the changelog. Optional follow-up: a one-time mapping flow on first login (look up Slack email, set `users.slack_user_id`). |
| 2 | Slack DM creates a "noise" channel for high-velocity users. | Future: per-user notification preferences (`user_notification_prefs` table). Out of scope for this plan. |
| 3 | Slack rate limit on bulk-assign (e.g., bulkUpdate assigning 50 issues to one user). | Existing retry path in `sendMessage` handles `ratelimited` errors. Additionally consider coalescing: if N issues are assigned in the same bulk call, send one summary DM instead of N — see "Out of scope" below; not blocking. |
| 4 | The "View" link uses `FRONTEND_URL` which may be wrong in dev when developing on a tunnel or a different host. | Reuse the same env var the management digest already uses — same problem, same fix. |
| 5 | `notifyAssignment` is fire-and-forget today; failures are swallowed by `.catch(() => {})` (`issue.service.ts:91`). Adding Slack should keep that property. | Keep the catch + log; never let Slack failures bubble up to the issue PATCH. |
| 6 | Webhook/standup bot already runs `conversations.open` per DM. Cost: ~150ms per `open` call. Doing it on every assignment is fine; doing it on every bulk-50 assignment is borderline. | Use the standup pattern. If bulk volume becomes a problem, coalesce. |
| 7 | If the user moves Slack workspaces, `slack_user_id` may point at a stale account. | Slack API will return `users_not_found` — log and skip. Future: add a "Re-link Slack" flow in profile. |

---

## Out of scope

- **Notification preferences** (opt out of Slack DM per user, per type).
- **Coalesced bulk DMs**: if `bulkUpdate` assigns 30 issues to one user, send one DM with a list, not 30 DMs. Track as a follow-up if pain emerges.
- **Slack DM on comment / mention / join-request resolution.** Same infra would extend trivially (`if (type === 'COMMENTED') ...`), but each needs its own block design. This plan ships `ASSIGNED` first and leaves the rest as obvious follow-ups.
- **Mobile push notifications.**
- **Email notifications.**

---

## Estimated effort

- Files modified: **3** (`slack.service.ts`, `notification.service.ts`, `notification.module.ts`).
- Lines added: **~50** (one helper, one trigger block, one module import).
- Complexity: **Low**. Pattern already exists in standup; nothing novel.
- Reasoning: the riskiest part is the message-format blocks; everything else is wiring.

---

## Next step

**Awaiting user approval** → `/2-implement`.
