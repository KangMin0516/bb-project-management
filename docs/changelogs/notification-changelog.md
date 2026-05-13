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
