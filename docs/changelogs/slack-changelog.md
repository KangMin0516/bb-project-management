# Slack Changelog

> Slack core integration: OAuth install, encrypted bot-token vault, channel/user list with in-process cache, signature verification on events and interactions. The standup bot and the daily-report system are layered on top — see their own changelogs.

## Owns

- **Modules**: `packages/api/src/slack/`, `packages/api/src/common/encryption.service.ts` (used by slack to encrypt bot tokens)
- **Frontend**: `packages/web/src/api/slack.ts`, Slack settings panel in `packages/web/src/pages/StandupSettingsPage.tsx` and `packages/web/src/pages/SettingsPage.tsx`
- **Tables**: `slack_integrations`

## Surface

- `GET /api/slack/install-url` — JWT, returns the OAuth URL with `state = AES-256-CBC({userId, exp: now+10min})`
- `GET /api/slack/oauth/callback` — public, exchanges `code` for `access_token`, encrypts and upserts on `team_id`
- `GET /api/slack/channels` — JWT, lists channels (cached 5 minutes per integration)
- `GET /api/slack/users` — JWT, lists workspace users (cached 5 minutes per integration)
- `DELETE /api/slack/integrations/:id` — JWT, disconnects (cascade-deletes daily report configs first)
- `GET /api/slack/status` — JWT, returns `{connected, integrationId, teamName}` for the most recent integration
- **Webhooks** (verified at controller level — see [`standup-changelog.md`](./standup-changelog.md)):
  - `POST /api/webhooks/slack/events`
  - `POST /api/webhooks/slack/interactions`

## Security

- **Bot token** encrypted at rest using `EncryptionService` (AES-256-CBC, per-row 16-byte IV, `iv_hex:cipher_hex`).
- **OAuth state** is encrypted JSON with an explicit 10-minute expiry. Replay protection.
- **Webhook signatures** verified before any work: HMAC-SHA256 over `v0:${timestamp}:${rawBody}` with `SLACK_SIGNING_SECRET`. Timestamp must be within ±5 minutes. `timingSafeEqual` compare.
- Webhook controller uses `rawBody: true` from `NestFactory` so signature verification sees the original bytes, not a re-serialized parse.

## Timeline

### 2026-05-13 — `SlackService.sendDirectMessage` helper
**Added.** New best-effort `sendDirectMessage(slackUserId, text, blocks?)` method. Picks the most-recent `SlackIntegration`, decrypts its bot token, calls `conversations.open` then `chat.postMessage` to the DM channel. Reuses the existing `ratelimited` retry loop pattern (exponential backoff, up to 3 retries). Skips silently — never throws — when no integration is installed or DM cannot be opened. First consumer: assignment notifications (see [`notification-changelog.md`](./notification-changelog.md)).

- Source: `packages/api/src/slack/slack.service.ts` (above `sendMessage`).
- Plan: [`docs/plans/slack-assignment-notification.md`](../plans/slack-assignment-notification.md).

### 2026-04-18 — Slack-user ID stored on `users` (Schema: `20260418010000_add_slack_user_id`)
**Schema.** Added `users.slack_user_id` (unique, nullable). Standup bot maps Slack DM authors to system users on first contact using email match, then caches the Slack user ID for future calls. See [`user-changelog.md`](./user-changelog.md#2026-04-18--slack-user-mapping-by-email-schema-20260418010000_add_slack_user_id).
- Migration: `20260418010000_add_slack_user_id`.

### 2026-04-18 — Slack-user mapping integrated with standup (66ec78b)
**Added.** When a Slack user replies in DM, `mapSlackUserToSystemUser` is called: if `users.slack_user_id` is missing, look up by email via `users.info`, then persist. Used by both the standup question/answer flow and the issue-list block.
- Source: `packages/api/src/standup/standup.service.ts:914`.

### 2026-04-15 — Initial Slack module (Schema: `20260415094639_add_slack_reports`)
**Added + Schema.** Full OAuth install flow. `slack_integrations` table is unique by `team_id` — installing the same workspace twice upserts. State token is encrypted with the same `ENCRYPTION_KEY` used for bot tokens. Channel and user lists pull from `conversations.list` / `users.list` with pagination, then cache for 5 minutes per integration in an in-memory `Map`. `chat.postMessage` wrapper retries up to 3 times on `ratelimited` with exponential backoff (honoring the `Retry-After` header).
- Migration: `20260415094639_add_slack_reports`.
- Source: `packages/api/src/slack/slack.service.ts`.

## Open questions / known issues

- **R3 — Symmetric encryption key.** Rotating `ENCRYPTION_KEY` requires re-encrypting every encrypted column (bot tokens, GitHub PATs, project credentials). No tooling for that exists today.
- **P5 — In-process channel/user cache.** With multiple replicas, channels refreshed by an admin on replica A won't appear in replica B for up to 5 minutes. Acceptable today (single replica).
- **No multi-workspace support per project.** A `daily_report_config` belongs to one `slack_integration`. If a workspace is reinstalled (`team_id` matches), the same row is reused. If a different workspace is connected, the existing reports continue against the old token until explicitly migrated.
