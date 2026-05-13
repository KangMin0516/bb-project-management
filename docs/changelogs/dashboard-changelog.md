# Dashboard Changelog

> Three dashboards: **Global** (landing page after login, cross-project for the current user), **Project** (per-project KPIs, burndown, member workload), and **Team** (admin/superuser view across all projects with KPI cards and per-member drill-down).

## Owns

- **Modules**: `packages/api/src/dashboard/` (`dashboard.service.ts` — 33KB aggregator, `dashboard.controller.ts`, `global-dashboard.controller.ts`, `team-dashboard.controller.ts`)
- **Frontend**: `packages/web/src/api/dashboard.ts`, `packages/web/src/pages/DashboardPage.tsx` (per-project), `packages/web/src/pages/GlobalDashboardPage.tsx`, `packages/web/src/pages/TeamDashboardPage.tsx`, `packages/web/src/pages/MemberTasksPage.tsx`, `packages/web/src/pages/TeamIssuesPage.tsx`, `packages/web/src/components/dashboard/`
- **Tables**: read-only over `issues`, `activities`, `project_members`, `standup_reports`, `notifications`

## Surface

- `GET /api/dashboard/projects/:projectId` — per-project stats (status/priority/type breakdowns, overdue, recent activity, my-issues, focus issues, burndown 30d)
- `GET /api/dashboard/global` — current user's cross-project snapshot
- `GET /api/dashboard/team` — superuser/admin, every project's headline metrics + per-member workload

## Timeline

### 2026-04-23 — Issue detail panel on team issues page (8c170c5)
**Added.** Clicking a row in the team-wide issues table opens the same `IssueDetailPanel` used elsewhere, including comments and activity. Removes the round-trip back to the project page just to read an issue.
- Source: `packages/web/src/pages/TeamIssuesPage.tsx`.

### 2026-04-23 — Clickable KPI cards → team issues list page (be66179)
**Added.** Each KPI card on the team dashboard (`Active`, `Overdue`, `Unassigned`, `Stalled`, ...) is now a link to a pre-filtered `/admin/issues?filter=overdue` etc. Removes a separate "where do I see overdue stuff" question.
- Source: `packages/web/src/pages/TeamDashboardPage.tsx`, `packages/web/src/pages/TeamIssuesPage.tsx`.

### 2026-04-23 — Standup integration on team dashboard cards (83c5156)
**Added.** Each member's card on team dashboard now embeds today's standup status (Answered / Pending / Away) and clicking through opens `MemberTasksPage` with their issues + answers visible.
- Source: `packages/web/src/pages/TeamDashboardPage.tsx`, `packages/web/src/pages/MemberTasksPage.tsx`.

### 2026-04-21 — Member tasks page (a967958)
**Added.** New route `/admin/members/:userId` — superuser-only — drilling into one member's workload across every project they belong to. Lists assigned issues, today's standup answers, and recent activity.
- Source: `packages/web/src/pages/MemberTasksPage.tsx`.

### 2026-04-18 — Standup section added to team dashboard (4e31e82)
**Added.** First iteration of the standup widget on `TeamDashboardPage`: counts (Answered / Pending / Away).
- Source: `packages/web/src/pages/TeamDashboardPage.tsx`.

### 2026-04-17 — Dark mode color fixes for KPI cards (9d9b9c7)
**Fixed.** Team Dashboard KPI tiles had hard-coded white backgrounds that bled through in dark mode. Replaced with Tailwind `bg-card` + `text-card-foreground` semantic tokens.
- Source: `packages/web/src/components/dashboard/`.

### 2026-04-06 — Initial dashboards (init commit)
**Added.** Three controllers + one massive aggregator service. Per-project dashboard computes (in parallel):
- counts by status/priority/type (Prisma `groupBy`)
- per-assignee workload + status breakdown
- burndown (30-day rolling using `activities` rows where `field=status` transitioning to/from DONE)
- overdue list (capped 50, sorted by oldest due date)
- recent activities (last 10 with user + issue context)
- my-issues split into "focus today" (`focusDate = today UTC`) and other

Global dashboard reuses the per-project core but iterates the user's projects. Team dashboard reuses + adds cross-project rollups.
- Source: `packages/api/src/dashboard/dashboard.service.ts`.

## Open questions / known issues

- **33KB service file** is a known smell (P3-adjacent). The aggregator should be split into per-section composables. Logged informally; no plan today.
- **Heavy aggregator queries** have no caching — every page load runs every aggregation fresh. P95 target is <800ms (see `docs/ARCHITECTURE.md` §14); not yet measured in prod.
- **Burndown uses `activities`** rather than a snapshot table, so changing project history (deleting an activity row) silently mutates the graph. Acceptable for now.
