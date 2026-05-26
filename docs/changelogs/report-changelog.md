# Slack Reports Changelog

> Two scheduled Slack messaging surfaces: (1) **per-project daily reports** at user-configured morning/lunch/evening times, and (2) the **management digest** twice daily to a fixed channel summarizing activity across every project.

## Owns

- **Modules**: `packages/api/src/report/` (`report.service.ts`, `report.scheduler.ts`, `mgmt-digest.service.ts`, `formatters/`)
- **Frontend**: `packages/web/src/api/reports.ts`, daily-report config UI in `packages/web/src/pages/SettingsPage.tsx`
- **Tables**: `daily_report_configs` (one per project)
- **Env**: `MGMT_DIGEST_ENABLED`, `MGMT_DIGEST_CHANNEL_ID`, `FRONTEND_URL`
- **Schedulers**:
  - `0 * * * * *` (every minute) — `ReportScheduler.checkAndSendReports`
  - `0 30 7 * * 1-5` Asia/Seoul — `ReportScheduler.sendMorningDigest`
  - `0 30 17 * * 1-5` Asia/Seoul — `ReportScheduler.sendEveningDigest`

## Surface

- `GET|PATCH /api/projects/:projectId/report-config` — JWT, the per-project config row (one per project)
- `POST /api/projects/:projectId/report-config/test/:slot` — JWT, manually fire one slot now (morning/lunch/evening) for debugging

## Timeline

### 2026-05-26 — Overdue alerts: exclude Epic + show status inline
**Changed.** A PM reviewing the morning Overdue block in `#safari_general` flagged that the 18-item list was 11 items of noise (6 Epic containers + 5 already-in-`REVIEW_QA`) versus 7 actual stalled tasks. Two adjustments to make the alert actionable:

1. **`type = EPIC` excluded from all overdue queries.** Epic-typed issues are containers whose `dueDate` rolls up the latest child due. Treating the Epic itself as overdue is double-counting — the child tasks already surface. Applied to:
   - `report.service.ts` morning + evening project reports
   - `mgmt-digest.service.ts` `getOverdueIssues`
2. **Status surfaced inline on every overdue row.** `REVIEW_QA`/`RECHECK` items are *technically* overdue (dev hand-off was supposed to be by the due date) but the dev doesn't have action left — the QA does. Rather than filtering these out (which would hide the QA backlog), we now print the status next to each line so the reader can tell "untouched" (`BACKLOG`/`TODO`) from "with QA" (`REVIEW_QA`/`RECHECK`) at a glance. Applied to morning, evening, and mgmt-digest overdue blocks; `OverdueIssue` view-model gained a `status: string` field.

- Source: `packages/api/src/report/report.service.ts` (two `findMany` where clauses), `packages/api/src/report/mgmt-digest.service.ts` (`getOverdueIssues` filter + view-model carries `status`), `packages/api/src/report/formatters/morning.formatter.ts`, `evening.formatter.ts`, `mgmt-digest.formatter.ts` (status in the rendered line).

### 2026-04-24 — Management digest morning + evening (e5402a6)
**Added.** Twice-daily Slack message to `MGMT_DIGEST_CHANNEL_ID` (configurable, defaults disabled with `MGMT_DIGEST_ENABLED=false`). Sends at:
- `0 30 7 * * 1-5` Asia/Seoul — morning recap of yesterday + today's outlook.
- `0 30 17 * * 1-5` Asia/Seoul — evening wrap.

Aggregates across **every** project: active issues, in-progress, completed today, created today, overdue items (assigned, no status filter, due in the past), stalled items (no activity > 3 days), unassigned count, missing-standup count. Each entry is hyperlinked back to `${FRONTEND_URL}/projects/<id>/...` for quick navigation.
- Source: `packages/api/src/report/mgmt-digest.service.ts`, `packages/api/src/report/report.scheduler.ts:165`, `:177`.
- Formatters: `packages/api/src/report/formatters/mgmt-digest.formatter.ts`.

### 2026-04-15 — Daily per-project reports (Schema: `20260415094639_add_slack_reports`)
**Added + Schema.** Per-project `daily_report_configs` row (1:1 with `projects`) holds:
- `enabled` boolean.
- `timezone` (default `Asia/Seoul`).
- Three slots — morning / lunch / evening — each with its own `time HH:mm`, `channel_id`, `channel_name`, and `last_sent` timestamp for dedupe.
- `skip_weekends` boolean (default `true`).
- FK to `slack_integrations` (the workspace this report uses).

`ReportScheduler.checkAndSendReports` runs every minute: for each enabled config, format the current local time with `Intl.DateTimeFormat`, compare to each slot's `time`. On match, fire `ReportService.sendReport(projectId, slot)` then stamp the slot's `last_sent` so a same-minute retry no-ops. `ReportService` aggregates issues by status, by assignee, plus today's deltas (newly DONE / newly created) and ships them to the configured channel as Slack `blocks`.
- Migration: `20260415094639_add_slack_reports`.
- Source: `packages/api/src/report/report.service.ts`, `packages/api/src/report/report.scheduler.ts`.

## Open questions / known issues

- **R1 — schedulers run inside the API container.** Daily reports + mgmt digest would double-send if a second replica were ever deployed. See [`docs/ARCHITECTURE.md` §13](../ARCHITECTURE.md#13-risk-register).
- **P4 — per-minute polling cost scales with config count.** Not a problem today (one or two configs); flagged for future extraction.
- **Mgmt digest channel is global.** A future iteration might want per-org or per-team digest channels.
- **No "missed" recovery.** If the API container is down at exactly `09:00`, the morning report for that day is lost. The minute-level granularity of the cron + the `last_sent` dedupe means there's no auto-catchup if the container recovers at `09:01`.
