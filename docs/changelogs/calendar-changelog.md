# Calendar View Changelog

> Month-grid per-project calendar that pins issues onto their `dueDate`. Click any chip to open the standard issue detail panel; navigate months with Prev/Next/Today; filter by Assignee / Type / Status / Priority / Search. Frontend-only feature — backend stays untouched.

## Owns

- **Frontend-only feature** (no dedicated backend module — reuses `GET /api/projects/:projectId/issues` with `limit=500`).
- **Page**: `packages/web/src/pages/CalendarPage.tsx`
- **Feature module**: `packages/web/src/features/calendar/` (`lib.ts`, `hooks/useCalendarData.ts`, components `CalendarHeader.tsx`, `MonthGrid.tsx`, `DayCell.tsx`, `IssueChip.tsx`)
- **Related data**: `issues.due_date` for bucketing; `issues.assignee_id`, `issues.status`, `issues.type`, `issues.priority` for filter.

## Surface

- Route: `/projects/:projectId/calendar` (under `ProjectRouteGate`, so non-members hit the Request-to-Join placeholder).
- Sidebar link: visible on every project page (between Lists and Timeline).

## Timeline

### 2026-05-20 — Cap Calendar issue fetch at 200 (9c5e287, PM-51 follow-up)
**Fixed.** Calendar page rendered an empty grid even when issues had `dueDate` set. Root cause: `useCalendarData` passed `limit=500` to `GET /api/projects/:projectId/issues`, but `QueryIssueDto` enforces `@Max(200)`. Backend's ValidationPipe rejected with `400 { "message": ["limit must not be greater than 200"] }`, React Query stored the error, `data` stayed `undefined`, and `issues: data?.items ?? []` became `[]`. No issue ever made it to `groupIssuesByDueDay`, so every DayCell got an empty array — looking exactly like a "no issues with deadlines" empty state but actually a contract violation. Capped the constant at 200 to match Timeline's existing pattern (the BE enforces the same limit there).
- Source: `packages/web/src/features/calendar/hooks/useCalendarData.ts`.

### 2026-05-20 — Phase 1: Month grid with dueDate pinning (d076961, PM-51)
**Added.** Initial Calendar view. Month grid Mon → Sun with adjacent-month padding so every week is a full row. Issues bucket into a single day by `localDayKey(dueDate)` — local-time interpretation, so a user picking 23:30 ICT lands on the day they intended even though the DB stores UTC. DONE / CANCELED issues render dimmed + strikethrough (visible historical record, but visually muted). Each cell shows max 3 chips; the rest collapse behind a `+N more` Popover that lists all of them. Clicking any chip opens the standard `IssueDetailPanel` (`?open=<id>` deep link compatible). Filter toolbar reuses the shared `SearchInput` / `DropdownFilters` / `AssigneeAvatars` primitives, so the UX matches Board / Lists / Timeline. Pulled `useFilteredIssues` from `features/timeline/` rather than duplicating — it's project-agnostic and filter-state-shaped. Issues without `dueDate` are excluded from the calendar entirely (they show up on Board / Lists / Timeline as usual).
- Source: `packages/web/src/features/calendar/{lib.ts, hooks/useCalendarData.ts, components/*}`, `packages/web/src/pages/CalendarPage.tsx`, `packages/web/src/app/router/index.tsx`, `packages/web/src/widgets/AppLayout/AppLayout.tsx`.
- Ticket: [PM-51](https://pm.burningbros.kr/projects/PM/board?open=ebf76542-02f4-4d82-adad-087354245bee) (TASK, parent PM-16 Feature request).
- Phase 2 deferred: Week / Day view toggle, "No deadline" lane, weekend collapse.
- Phase 3 deferred: drag-to-reschedule, multi-project overlay, ICS export.
