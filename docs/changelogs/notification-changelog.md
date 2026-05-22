# Notification Changelog

> In-app notifications for assignment, comment activity, mentions, and join-request resolutions. Stored in Postgres; surfaced via a polled query from the web frontend. No push, no email.

## Owns

- **Modules**: `packages/api/src/notification/`
- **Frontend**: `packages/web/src/api/notifications.ts`, `packages/web/src/components/notification/`
- **Tables**: `notifications`

## Surface

- `GET /api/notifications` — JWT, current user's notifications (ordered: unread first, then by `createdAt` desc, limit `NOTIFICATION_LIMIT`)
- `GET /api/notifications/unread-count`
- `PATCH /api/notifications/:id/read`
- `PATCH /api/notifications/read-all`

## Timeline

### 2026-05-22 — Deadline alerts: hourly cron creates in-app notifications for at-risk issues (PM-79, Phase 1)
**Added.** New `DeadlineScheduler` (`packages/api/src/issue/deadline.scheduler.ts`) runs every hour. For each non-terminal (`status NOT IN (DONE, CANCELED)`), non-archived issue with `dueDate <= now + 24h`, it creates a `DEADLINE_WARNING` notification (or `DEADLINE_OVERDUE` if `dueDate < now`) addressed to the assignee — or falls back to the creator if the issue is unassigned.

Idempotency: before insert, the scheduler queries existing notifications by `(userId, issueId, type)` and skips if a row already exists. This keeps the hourly cron from re-firing the same warning every tick. Trade-off: if the assignee bumps the dueDate, no new warning fires for the new date because the original row still blocks — refine in Phase 2 by also matching `meta.dueAt`.

`NotificationType` gained two new variants `DEADLINE_WARNING | DEADLINE_OVERDUE`. The in-app `NotificationBell` already renders any new notification row, so no FE change is required for the receiving surface.

**Out of scope (Phase 2):**
- Slack DM dispatch for deadlines — the existing per-notification-type formatter only handles ASSIGNED / REVIEWER_ASSIGNED / COMMENTED / MENTIONED. Adding DEADLINE_* requires the Slack block builder + the `sendDM` opt-in path. Phase 1 ships in-app only.
- Multi-tier warnings (e.g. 7d / 3d / 1d / overdue). Phase 1 is 24h + overdue.
- User-level preference toggle (`User.preferences.deadlineAlerts.enabled`). Phase 1 enables for everyone.

- Source: `packages/api/src/issue/deadline.scheduler.ts` (new), `packages/api/src/issue/issue.module.ts` (register provider), `packages/api/src/notification/notification.service.ts` (add `DEADLINE_*` to `NotificationType`).

### 2026-05-13 — Slack DM on `ASSIGNED` notifications
**Changed.** `NotificationService.create()` now triggers a fire-and-forget Slack DM via `SlackService.sendDirectMessage` whenever `type === 'ASSIGNED'` and the recipient has `users.slack_user_id` populated. The in-app `notifications` row remains the authoritative record — Slack is enrichment, not a replacement. Users without a linked Slack identity continue to see only the in-app notification.

- `CreateNotificationInput` gains an optional `meta: { projectKey?, issueNumber?, issueTitle?, actorName? }` field used to build the Slack block payload. `meta` is **not** persisted to the DB.
- `IssueService.notifyAssignment` now fetches the actor's name (single `SELECT users.name`) and forwards it via `meta` so the DM reads "Assigned by <name>" instead of an opaque id.
- `NotificationModule` imports `SlackModule`.
- The DM contains a "View in BB-PM" button linking to `${FRONTEND_URL}/projects/<key>/board?open=<issueId>` (`FRONTEND_URL` env, same one used by `MgmtDigestService`).
- Failures are logged at `warn` level and never bubble up; this preserves the pre-existing fire-and-forget property of `notifyAssignment`.
- Plan: [`docs/plans/slack-assignment-notification.md`](../plans/slack-assignment-notification.md).

### 2026-04-21 — Join-request resolution notifications (a967958)
**Added.** When a project admin approves or rejects a join request, the requester gets a notification (`JOIN_APPROVED` / `JOIN_REJECTED`) with the project name and (on rejection) the `rejection_reason` excerpt.
- Source: `packages/api/src/join-request/join-request.service.ts` (calls `NotificationService.create`).

### 2026-04-06 — Assignment notifications (issue assignee change)
**Added.** When `Issue.assigneeId` changes, a notification of type `ASSIGNED` is created for the new assignee with message `<projectKey>-<number> "<title>" has been assigned to you`. Caller is set via `actor_id`; if `actorId === userId` (self-assignment), the notification is suppressed.
- Source: `packages/api/src/issue/issue.service.ts:72` (`notifyAssignment`).

### 2026-04-07 — Initial notification model (Schema: `20260407125832_add_notification`)
**Schema.** `notifications` table — `type VARCHAR(20)` (free string, intentionally not an enum so adding a new event type doesn't require a migration), `message VARCHAR(500)`, `is_read BOOL`, FKs to `users` (recipient), `issues`, `projectId`, `actorId`. Compound index on `(user_id, is_read, created_at)` so the unread-first query is index-only.
- Migration: `20260407125832_add_notification`.

## Open questions / known issues

- **Polled, not pushed.** The unread-count is fetched by the navbar on a 30s React Query interval. No WebSocket / SSE. Logged as P8 in [`docs/ARCHITECTURE.md` §2](../ARCHITECTURE.md).
- **Fire-and-forget creation** (`.catch(() => {})` from `IssueService`). If `notificationService.create` fails, the failure is swallowed. Logged as R9.
- **Type column is free-string, not enum.** Same trade-off as `Activity.field`: trivial to extend, harder to query exhaustively. Today's types: `ASSIGNED`, `COMMENTED`, `MENTIONED`, `JOIN_APPROVED`, `JOIN_REJECTED`.
- **No notification preferences.** Users cannot opt out of categories or change delivery (because the only delivery channel today is in-app).
