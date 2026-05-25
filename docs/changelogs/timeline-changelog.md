# Timeline View Changelog

> Gantt-style per-project timeline that groups issues by parent EPIC with collapsible task subtrees. Displays `startDate` → `dueDate` bars on a horizontal date ruler, with synced vertical scrolling between the left (issue list) and right (bar canvas) panes.

## Owns

- **Frontend-only feature** (no dedicated backend module — reuses `GET /api/projects/:projectId/issues` with `archivedAt=null` and sorts client-side).
- **Page**: `packages/web/src/pages/TimelinePage.tsx`
- **Related data**: `issues.start_date`, `issues.due_date`, `issues.parent_id`, `issues.type` (used to identify EPIC parents)

## Surface

- Route: `/projects/:projectId/timeline`
- Sidebar link: visible on every project (after `8f61f09`).

## Timeline

### 2026-05-25 — Resizable left "Issues" column
**Added.** Previously the Issues column toggled between 280 px (expanded) and 48 px (collapsed) and had no in-between. PMs on wider screens wanted more room for long issue titles; on smaller monitors they wanted to claw back chart real estate without fully collapsing. Now the right edge of the expanded column is a drag handle (4 px hit area, primary-coloured on hover). Drag horizontally to set the width between 160–640 px; the choice persists to `localStorage['timeline-labels-width']` and survives page reloads. The collapse toggle still snaps to 48 px → restoring shows the last-dragged width. `SharedTimelinePage` does not receive the resize callback so the public read-only view keeps fixed widths (no UX surprise for guests).

- Source: `packages/web/src/features/timeline/components/TimelineLabelColumn.tsx` (`onResizeStart` / `isResizing` props + absolute-positioned right-edge handle), `packages/web/src/pages/TimelinePage.tsx` (`labelWidthExpanded` state, document-level mousemove/up wiring, `clampLabelWidth`, body cursor lock during drag).

### 2026-05-24 — Free-form drag-to-schedule + bar body move (PM-65 follow-up #3)
**Changed.** Drag-to-set-dates used to anchor to today (`create-from-today`) and only resize/extend from bar edges. PMs couldn't paint a future-only range like `[Jun 1, Jun 5]` in one gesture, and there was no way to shift a both-dates bar without two separate edge drags. Now:

- Empty rows accept mousedown **anywhere** → `[mousedown date, mouseup date]` as the new range (`create-free` mode).
- Bars with both dates accept mousedown on the **body** → both dates shift by the cursor delta (`move-bar` mode), cursor changes to `grab` / `grabbing`.
- Edge handles continue to resize one side only (`set-start` / `set-due`).
- Floating preview label tracks the cursor instead of staying glued to the anchor edge.

Today aiming aid removed — the row itself is now the affordance. See [`ui-changelog.md`](./ui-changelog.md#2026-05-24--timeline-drag-free-form-ranges--bar-body-move-pm-65-follow-up-3) for the full mode taxonomy.

- Source: `packages/web/src/features/timeline/hooks/useTimelineDateDrag.ts`, `packages/web/src/features/timeline/components/TimelineChart.tsx`.

### 2026-05-21 — Exclude DOMAIN from Calendar + Timeline planning views (PM-56 follow-up)
**Changed.** `useFilteredIssues` (shared by Calendar and Timeline) now hides `DOMAIN` (Module) rows by default — they're organisational containers, not work items, and shouldn't appear as Timeline bars / Calendar chips. Verified Timeline page renders 0 DOMAIN rows on the PITB project. Users who explicitly add `DOMAIN` to the `type` filter still see them (opt-in).
- Source: `packages/web/src/features/timeline/hooks/useFilteredIssues.ts`.

### 2026-05-12 — Hide CANCELED by default (d2f3ed0)
**Changed.** Timeline (along with Board and Lists) now filters out `CANCELED` issues by default. Toggle to include them via the toolbar.
- Source: `packages/web/src/pages/TimelinePage.tsx`.

### 2026-05-12 — Sync left/right vertical scroll (51afae5)
**Fixed.** Wheel-scrolling the right (bar canvas) pane left the left (issue list) pane stationary, breaking the visual row alignment. Wired a shared `scrollTop` so both panes scroll in lock-step. Both directions.
- Source: `packages/web/src/pages/TimelinePage.tsx`.

### 2026-05-11 — `Issue.startDate` for planned start (10c6920)
**Added.** Surfaces `start_date` on the Timeline ruler. A bar now spans `[startDate, dueDate]` rather than `[today, dueDate]` if start is set. Issues without `startDate` fall back to the previous behavior.
- Source: `packages/web/src/pages/TimelinePage.tsx`; see also [`issue-changelog.md`](./issue-changelog.md#2026-05-11--issuestartdate-for-planned-start-10c6920-schema-20260511135935_add_issue_start_date).

### 2026-05-11 — Group by EPIC with collapsible subtrees (53cdbbb)
**Added.** The left pane now groups every non-EPIC issue under its parent EPIC (one level only — sub-tasks of a task still group under that task's EPIC). Each EPIC row has a chevron to collapse its subtree. Orphan tasks (no EPIC parent) cluster under a synthetic "(no epic)" group at the bottom.
- Source: `packages/web/src/pages/TimelinePage.tsx`.

### 2026-05-11 — Timeline link in project sidebar (8f61f09)
**Added.** Sidebar nav entry to `/projects/:projectId/timeline`. Previously only reachable via direct URL.
- Source: `packages/web/src/components/layout/`.

## Open questions / known issues

- **Hard ruler granularity.** Day-level. No week/month zoom yet.
- **Dependency visualization.** `issue_links` of type `BLOCKS` are stored but not rendered as arrows between bars yet — feature flagged for a later iteration.
- **No auto-scroll during drag.** Cursor stops at the chart edge; users have to release + re-grab to extend past the visible range. Plan §6 marked this as Phase 2 polish.
- **Cross-view cache invalidation.** Drag mutations invalidate the `['issues', projectId, 'timeline']` query key only. Board / Calendar / Lists query keys remain stale until their next fetch.
