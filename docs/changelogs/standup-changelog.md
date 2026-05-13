# Standup Bot Changelog

> Slack-DM-driven 1-question-at-a-time standup bot. Schedules per-config standups by timezone-aware cron, DMs each non-away member, walks them through configured questions, and posts a formatted summary to the channel. Also hosts the natural-language quick-issue capture from DMs.

## Owns

- **Modules**: `packages/api/src/standup/`, `packages/api/src/quick-issue/`
- **Frontend**: `packages/web/src/api/standup.ts`, `packages/web/src/api/quick-issue.ts`, `packages/web/src/pages/StandupSettingsPage.tsx`, `packages/web/src/components/dashboard/` (standup card on team dashboard)
- **Tables**: `standup_questions`, `standup_configs`, `standup_config_questions`, `standup_config_members`, `standup_reports`, `standup_answers`
- **Schedulers**:
  - `0 * * * * *` (every minute) — `StandupScheduler.checkAndTriggerStandups`
  - `0 */5 * * * *` (every 5 minutes) — `StandupScheduler.checkReminders`

## Surface

- `GET|POST|PATCH|DELETE /api/standup/questions` and `/api/standup/configs`
- `POST /api/standup/configs/:id/trigger` — manual trigger from the UI
- `GET /api/standup/configs/:id/reports?limit=50` — recent reports for a config
- `POST /api/quick-issue/parse` and `POST /api/quick-issue/create` — natural-language → issue (used by `Cmd+N` and the Slack `/issue` DM command)
- **Webhooks** (verified by `StandupWebhookController`):
  - `POST /api/webhooks/slack/events` — DM messages + edits + the `/issue` command
  - `POST /api/webhooks/slack/interactions` — block_actions for cancel/confirm/select buttons

## Timeline

### 2026-04-23 — Today's completed issues in standup DM list (c267374)
**Added.** The "Your Issues" block at the start of a DM now appends `✅ DONE TODAY` items (issues the user marked DONE since UTC midnight). Helps remind them what they shipped before they answer "what did you do".
- Source: `packages/api/src/standup/standup.service.ts:973`.

### 2026-04-23 — Group active issues by project + status in DM (4416b20)
**Changed.** Previously the DM listed all assigned issues in a flat array. Now grouped: `Project A → IN_PROGRESS → [issues]; TODO → [issues]`. Focus-date items get the `🎯` prefix.
- Source: `packages/api/src/standup/standup.service.ts:961` (`sendIssueListBlock`).

### 2026-04-23 — Quick-issue from Slack DM (`/issue ...`) + Web (46c3029)
**Added.** A DM that starts with `/issue ` or `!issue ` is routed to `handleQuickIssue` instead of the standard standup answer flow. Flow:
1. Rule-parser extracts hints (project key prefix, priority keywords, `@mentions`) — `packages/api/src/quick-issue/parsers/rule-parser.ts`.
2. LLM enricher (Anthropic `claude-haiku-4-5-20251001`, max 300 tokens, JSON-only output) fills in `title`, `description`, `type`, `priority`, `status`, `assigneeId` — `packages/api/src/quick-issue/parsers/llm-enricher.ts`. Validates `assigneeId` against project members to block hallucination.
3. Preview block in DM with `qi_confirm` / `qi_cancel` buttons.
4. On confirm, creates the issue via `IssueService.create`. Web equivalent: the `Cmd+N` modal posts the same `parse` → `create` pair.
- Source: `packages/api/src/quick-issue/quick-issue.service.ts`, `packages/api/src/standup/standup.service.ts:690` (`handleQuickIssue`).

### 2026-04-23 — Auto-expire stale ACTIVE reports (e2e9777)
**Fixed.** A user who never answered yesterday's standup left an `ACTIVE` report blocking today's. `triggerStandup` now sweeps `ACTIVE` reports older than 24 hours and marks them `UNANSWERED` before deciding who to DM.
- Source: `packages/api/src/standup/standup.service.ts:214`.

### 2026-04-23 — Debug logging for Slack-user mapping (07fb85b)
**Fixed.** Added warn-level logs in `mapSlackUserToSystemUser` to diagnose why a particular user wasn't getting the issue-list block (root cause was a missing `users:read.email` scope).
- Source: `packages/api/src/standup/standup.service.ts:914`.

### 2026-04-23 — Integrate standup into team dashboard (83c5156)
**Added.** Team dashboard now shows a per-member standup card with today's report status (Answered / Active / Away / Unanswered / Canceled) and the answers when expanded. Member detail page links here.
- Source: `packages/web/src/pages/TeamDashboardPage.tsx`, `packages/web/src/pages/MemberTasksPage.tsx`.

### 2026-04-18 — Standup section on team dashboard (4e31e82)
**Added.** First version of the standup widget on `TeamDashboardPage` — counts (Answered / Pending / Away) for today.
- Source: `packages/web/src/pages/TeamDashboardPage.tsx`.

### 2026-04-18 — Standup formatter cleanup (b0c50be)
**Changed.** Refactored `formatStandupReport` to produce cleaner Slack `attachments`: per-question `*Question*` bold + answer; status-colored side bar; consistent emoji prefixes.
- Source: `packages/api/src/standup/formatters/report.formatter.ts`.

### 2026-04-16 — `reminded_at` for one-shot reminders (Schema: `20260416103303_add_reminded_at`)
**Schema + Added.** `standup_reports.reminded_at TIMESTAMP NULL`. The reminder cron (`0 */5 * * * *`) finds ACTIVE reports older than 30 min with `reminded_at IS NULL`, DMs a `:bell: Reminder` nudge, and stamps `reminded_at` so the same user isn't nudged twice for one report.
- Migration: `20260416103303_add_reminded_at`.
- Source: `packages/api/src/standup/standup.service.ts:642` (`remindUnanswered`).

### 2026-04-16 — Initial standup bot (Schema: `20260416030130_add_standup_bot`)
**Added + Schema.** Five tables and the full DM-driven flow:
- `standup_questions` — reusable question text + `ignore_text` (words like "nothing nope none" that won't trigger a "did you mean to skip" follow-up).
- `standup_configs` — per-config greeting/goodbye templates with `{{username}}` / `${username}` and `{{config_name}}` / `${config_name}` substitution; cron via three `cronHour | cronMinute | cronDayOfWeek` fields parsed manually (`StandupScheduler.matchesCronField` supports `*`, single value, range `1-5`, comma `1,3,5`); `timezone` (default `Asia/Seoul`); `enabled` toggle.
- `standup_config_questions` — many-to-many with `order`.
- `standup_config_members` — Slack user IDs subscribed; `is_away` opts out.
- `standup_reports` + `standup_answers` — one report per (config, slack user, run), one answer per (report, question) created up-front so we can index by `order`.

Flow: scheduler triggers → for each member without an active report, create the report + pre-create answer rows + open DM + send greeting + (after Slack-user mapping) send issue list block + send first question. User replies → match by `currentQuestionOrder` → save answer → send next question → on the last answer, mark `ANSWERED`, send goodbye DM, then post the formatted summary to the config's channel.
- Migration: `20260416030130_add_standup_bot`.
- Source: `packages/api/src/standup/standup.service.ts`, `packages/api/src/standup/standup.scheduler.ts`, `packages/api/src/standup/standup-webhook.controller.ts`.

## Open questions / known issues

- **P4 — Per-minute polling across all configs.** Every minute, the scheduler reads all enabled configs and walks `Intl.DateTimeFormat` per timezone. Wasteful at scale. Future: pre-compute `next_fire_at` on save.
- **Quick-issue LLM cost.** Each `/issue` invocation makes one Anthropic call. Bypass with rule-parser-only when `ANTHROPIC_API_KEY` is unset (warning logged).
- **No reactions API.** Bot responds via `chat.postMessage` only; no `reactions.add` to confirm received DMs.
