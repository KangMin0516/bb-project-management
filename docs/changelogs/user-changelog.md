# User Changelog

> User profile, avatar storage, the superuser bypass mechanism, and the bidirectional Slack-user mapping used by the standup bot.

## Owns

- **Modules**: `packages/api/src/user/` (admin endpoints for approval, deletion, superuser toggle), `packages/api/src/common/guards/superuser.guard.ts`
- **Frontend**: `packages/web/src/api/users.ts`, `packages/web/src/pages/AdminPage.tsx`, `packages/web/src/pages/ProfilePage.tsx`, `packages/web/src/pages/MemberTasksPage.tsx`
- **Tables**: `users` columns `name`, `avatar`, `is_superuser`, `slack_user_id` (unique nullable)

## Surface

- `GET /api/users` — JWT + superuser, list all users
- `PATCH /api/users/:id/approve|reject|delete` — JWT + superuser, account lifecycle transitions
- `PATCH /api/users/:id/superuser` — JWT + superuser, toggle the flag
- `GET /api/upload/avatar/:userId` — public proxy to S3 (resolved by `upload` module)

**Guards**:
- `ProjectMemberGuard` does a superuser short-circuit: `if (dbUser.isSuperuser) { request.isSuperuser = true; return true; }` — superusers bypass membership checks everywhere a `:projectId` is involved.
- `SuperuserGuard` gates admin-only routes.

## Timeline

### 2026-04-18 — Slack-user mapping by email (Schema: `20260418010000_add_slack_user_id`)
**Schema + Added.** Standup bot needs to map a Slack DM author back to a system user to surface their issue list. Adds `users.slack_user_id` (unique, nullable). On first DM, the bot calls `users.info` on Slack, reads the email, looks up `users.email`, and writes back `slack_user_id`. Subsequent DMs hit the cached column.
- Migration: `20260418010000_add_slack_user_id`.
- Source: `packages/api/src/standup/standup.service.ts:914` (`mapSlackUserToSystemUser`).

### 2026-04-17 — Avatar cache TTL extended to 30 days (400e106)
**Changed.** The HTTP `/api/upload/avatar/:userId` proxy now sets `Cache-Control: public, max-age=2592000, immutable` so avatars are only re-fetched after 30 days even on first load. Previously sub-second cache made avatar flicker on dashboard re-renders.
- Source: `packages/api/src/upload/upload.controller.ts`.

### 2026-04-06 — Initial user model (init commit, Schema: `20260406080645_init`)
**Added.** `users` table with `email` (unique), `name`, `password_hash`, `avatar` (nullable), `is_superuser` (default false). Profile read/update via `/api/auth/profile`. Avatar upload via `/api/auth/upload-avatar` which writes to S3 and stores a proxy URL (`/api/upload/avatar/<userId>`) in `users.avatar`.
- Source: `packages/api/src/auth/auth.service.ts:119` (`updateProfile`), `packages/api/src/upload/upload.service.ts:80` (`uploadAvatar`).

## Open questions / known issues

- **R7 — Avatar `getAvatar` brute-forces 4 extensions on cache miss.** `users.avatar` stores a proxy URL like `/api/upload/avatar/<userId>`, and the resolver tries `.jpeg`, `.jpg`, `.png`, `.webp` in sequence against S3. Up to 4 S3 GETs per cold avatar fetch. Fix is to store the full S3 key in `users.avatar`. See [`docs/ARCHITECTURE.md` §13](../ARCHITECTURE.md#13-risk-register).
- **No multi-account / SSO support.** All users authenticate via email+password.
