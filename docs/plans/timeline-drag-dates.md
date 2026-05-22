# Plan: Timeline — collapsible label column + drag-to-set-dates + bar edge resize

> **Status**: 🟡 Draft — 2026-05-22. Ticket: PM-65.
> **Domain**: `ui` (TimelinePage + new drag hook), `issue` (no API change — reuses existing `PATCH /projects/:projectId/issues/:issueId`).
> **Tracks**: PMs need faster date editing on the Timeline view. Today, scheduling a previously-undated issue requires: hover-tooltip → click bar → wait for IssueDetailPanel → scroll to dates → open calendar → pick start → pick due → save. That's 6–8 clicks for a single date pair. This plan collapses that into a single mouse gesture.

> **Decisions locked (2026-05-22, user confirmed)**:
> 1. **One-sided issues**: drag from the **bar edge** of the existing date, not from today. Keeps the "drag extends one direction" semantics consistent — anchor is whichever date is already set, free end is the cursor.
> 2. **Click behaviour unchanged**: clicking a bar still opens `IssueDetailPanel`. Drag is a *shortcut*, never a replacement for the panel (which is needed for description / comments / assignee anyway).
> 3. **Single ticket** for A + B + C — gestural primitives shared, splitting them would mean a half-built feature for an interim release.
> 4. **Resize bar edges** (C) included in scope. Marginal cost over B is small (same hook, same mutation, same preview shape).

---

## 1. Requirement summary

### A. Collapsible label column

The left "Issues" column is fixed at `LABEL_WIDTH = 280` (`TimelinePage.tsx:25`). For deep projects on a 13" laptop, this consumes ~25 % of horizontal screen real estate; PMs want to see further into the future. Add a toggle that collapses the column to ~48 px (icon-only) and remembers the choice across sessions.

### B. Drag-to-set-dates (the headline)

For an issue with no `startDate` AND no `dueDate`:
- Hover the chart row → a `MoveHorizontal` icon appears at the **today** column position (≤ 60 % opacity, fades in 100 ms).
- Mouse-down on the icon and drag **right** → ghost bar grows from today to cursor.
- Release → `startDate = today`, `dueDate = cursor day`.
- Mouse-down and drag **left** → ghost bar grows from cursor to today.
- Release → `startDate = cursor day`, `dueDate = today`.

For an issue with only `startDate` set (no `dueDate`) or only `dueDate` set:
- Hover the existing bar → a small handle (`└─` style cap) appears at the **free edge** of the bar (the side without a date).
- Drag that handle → ghost extends/contracts. Release → fills in the missing date with cursor day. The set date stays anchored.

For an issue with both dates set:
- Hover the bar → two handles appear on left and right edges.
- Drag a handle → resize that side only. Release → updates the corresponding date (left → startDate, right → dueDate). The other date stays anchored.
- Dragging the bar **body** (not an edge) is **out of scope** for Phase 1 (would move both dates by N days — different gesture, save for later if PMs ask).

### C. Bar edge resize

This is just the third case of B — same hook, same gesture math, same mutation. Listed as its own letter so the changelog audit trail is explicit.

### Why

- Schedules drift constantly; click-into-panel-to-edit-dates is a fast-burning UX tax on every Timeline review session.
- Gantt-like tools (Plane, Notion timeline, Linear cycles view) have set the expectation.
- The data model already supports it — no BE work, just the gesture.

### For whom

- **PM↑** mostly — only role allowed to edit other people's dates (will reuse the same permission check as click-into-panel: backend `RolesGuard` already in place).
- **Engineers** can drag their own issue's dates (same as detail-panel behaviour today).

---

## 2. Affected services & files

### Web (`@bb-pm/web`) — all changes here

**State + plumbing:**
- `packages/web/src/pages/TimelinePage.tsx` — add `labelsCollapsed` state + localStorage IO; pass to `TimelineLabelColumn`; mount new drag overlay.

**Label column (Feature A):**
- `packages/web/src/features/timeline/components/TimelineLabelColumn.tsx` — accept `collapsed` prop, render compact rows (~48 px) when true.
- New chevron-toggle button rendered at the right edge of the label column header (looks like the `PanelLeftClose/Open` icons used in `AppLayout.tsx`).

**Drag mechanic (Feature B + C):**
- New hook `packages/web/src/features/timeline/hooks/useTimelineDateDrag.ts` — central state machine:
  ```typescript
  type DragState =
    | { kind: 'idle' }
    | { kind: 'hover'; issueId: string; mode: HoverMode }
    | { kind: 'dragging'; issueId: string; mode: DragMode; anchor: Date; cursor: Date }
  type HoverMode = 'create-from-today' | 'extend-from-edge'
  type DragMode = 'set-right' | 'set-left' | 'resize-right' | 'resize-left'
  ```
- `packages/web/src/features/timeline/lib.ts` — add helpers:
  - `pixelToDate(pixelOffset, dateRange, chartWidth): Date` — snaps to day boundary
  - `dateToPixelLeft(date, dateRange, chartWidth): number`
  - `computeDragMode(issue, mouseStartX, chartWidth, dateRange): DragMode | null`
- `packages/web/src/features/timeline/components/TimelineChart.tsx` — wire the hook:
  - `onMouseEnter/Leave` on `ChartRow` toggles hover state
  - `onMouseDown` on edge-handle / today-marker starts drag
  - `mousemove`/`mouseup`/`keydown(Escape)` listeners attached at `document` level during drag (so the cursor can leave the row)
  - Render ghost bar (dashed border, status colour 40 % opacity) at `previewLeft`/`previewWidth`
  - Hide the real bar's `cursor: pointer` during drag (prevents click event on mouseup that would also open the panel — must `preventDefault` / `stopPropagation` on mouseup)

**Mutation:**
- Reuse existing `issueRepository.update(projectId, issueId, { startDate, dueDate })`.
- Optimistic update through TanStack Query — `queryClient.setQueryData(['timeline-data', projectId], ...)` to flip the issue's dates instantly so the bar materialises before the network round-trip lands. On error, revert + toast.

**Tests:**
- No existing Vitest in `packages/web/`. Add the hook's pure helpers (`pixelToDate`, `computeDragMode`) as exported pure functions so a future Vitest suite can cover them without spinning up React. (Don't introduce a test runner in this PR — out of scope.)

### API (`@bb-pm/api`)

- **No changes.** The endpoint already accepts `startDate` / `dueDate` (ISO strings or `null`).

### MCP / external

- **No changes.**

### Tài liệu

- `docs/changelogs/ui-changelog.md` — single entry covering A + B + C with the gesture documented.
- `docs/plans/timeline-drag-dates.md` — this file, committed alongside.

---

## 3. Proposed implementation (step by step)

### Step 1 — Feature A: collapsible label column

1. In `TimelinePage.tsx`, add:
   ```typescript
   const [labelsCollapsed, setLabelsCollapsed] = useState<boolean>(
     () => localStorage.getItem('timeline-labels-collapsed') === 'true',
   )
   const toggleLabels = () => {
     const next = !labelsCollapsed
     setLabelsCollapsed(next)
     localStorage.setItem('timeline-labels-collapsed', String(next))
   }
   const labelWidth = labelsCollapsed ? 48 : 280
   ```
2. `TimelineLabelColumn` accepts a `collapsed: boolean` prop. When true, every `LabelRow` renders just the status dot + type icon + issue number (Issue-7 ≤ 24 px wide). Hover shows a tooltip with the full title.
3. Add chevron toggle button in the column header row (the `<div className="sticky top-0 ...">` block) — `PanelLeftClose` when expanded, `PanelLeftOpen` when collapsed.
4. `transition-[width] duration-200` on the outer `<div>` for the slide.

### Step 2 — pure helpers in `lib.ts`

```typescript
export function pixelToDate(
  pixelOffsetFromChartLeft: number,
  range: TimelineDateRange,
  chartWidthPx: number,
): Date {
  const dayWidth = chartWidthPx / range.totalDays
  const dayOffset = Math.round(pixelOffsetFromChartLeft / dayWidth)
  const target = new Date(range.startDate.getTime() + dayOffset * DAY_MS)
  return startOfDay(target)
}
```

`chartWidthPx` is captured via `ResizeObserver` on the chart inner wrapper. The chart's inner `minWidth: Math.max(800, totalDays * 12)` means we can also compute `chartWidthPx` as `Math.max(800, totalDays * 12)` if we accept that user-resize on the outer container doesn't matter (rows are full-width sticky). Going with ResizeObserver for correctness.

### Step 3 — drag state machine hook

`useTimelineDateDrag.ts` — returned API:

```typescript
interface UseTimelineDateDrag {
  hoverState: HoverState
  dragState: DragState
  // Event handlers wired by TimelineChart per row / per edge:
  onRowMouseEnter: (issueId: string) => void
  onRowMouseLeave: () => void
  onAffordanceMouseDown: (e: React.MouseEvent, issue: Issue, mode: DragMode) => void
}
```

Internal flow on `onAffordanceMouseDown`:
1. Capture `anchor: Date` (the date that stays fixed — today, or the opposite edge's date).
2. Attach `document.addEventListener('mousemove', onMove)` and `mouseup`/`keydown` listeners.
3. On move: compute cursor → date, update `dragState.cursor`. Triggers re-render of the ghost bar.
4. On mouseup: `mutate({ startDate, dueDate })` with the right pair derived from `mode + anchor + cursor`. Optimistic update first. Detach listeners.
5. On Escape: detach listeners without mutating.

### Step 4 — render the affordance + ghost in `TimelineChart`

For each `ChartRow`:
- If `hover state matches this issue` and issue has zero dates:
  - Render an icon at `left: ${todayOffset}%` (only if `todayVisible`). Skip otherwise — that row's fallback is the detail panel.
- If issue has one date:
  - Render a handle at the free edge of the existing bar.
- If issue has both dates:
  - Render two handles, one at each end.
- During `dragState.kind === 'dragging' && dragState.issueId === issue.id`:
  - Render a dashed ghost bar covering `[anchor, cursor]` (or `[cursor, anchor]` depending on direction).
  - Hide the real bar (or dim to 30 %).
  - Tooltip near cursor showing the would-be date in `formatDate`.

### Step 5 — click protection

When mouseup follows a drag, the existing `onClick` on the bar (which opens the panel) will fire on the same DOM target. Two ways to suppress it:
- Track `wasDragged` in the hook; on the next click, if `wasDragged`, `e.preventDefault()` + `e.stopPropagation()` + reset.
- Simpler: use `pointer-events: none` on the bar during drag, set on the ghost overlay instead.

Go with the simpler one. Plus a "movement threshold" of 3 px so a noisy click doesn't auto-start drag.

### Step 6 — optimistic update

```typescript
const updateMutation = useMutation({
  mutationFn: ({ issueId, dates }) => issueRepository.update(projectId, issueId, dates),
  onMutate: async ({ issueId, dates }) => {
    await queryClient.cancelQueries({ queryKey: ['timeline-data', projectId] })
    const previous = queryClient.getQueryData(['timeline-data', projectId])
    queryClient.setQueryData(['timeline-data', projectId], (old: any) => ({
      ...old,
      issues: old.issues.map((i: Issue) => i.id === issueId ? { ...i, ...dates } : i),
    }))
    return { previous }
  },
  onError: (err, _, context) => {
    if (context?.previous) queryClient.setQueryData(['timeline-data', projectId], context.previous)
    useToastStore.getState().addToast(getErrorMessage(err, 'Failed to update dates'), 'error')
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: ['timeline-data', projectId] }),
})
```

(Need to verify the actual query key used by `useTimelineData`. Look it up during implementation.)

### Step 7 — accessibility

- Drag interaction is **mouse-only** (touch + keyboard left to detail panel).
- Add a `title` on the affordance and ghost ("Drag to set dates" / "Drag to resize").
- The detail-panel path remains the canonical "set dates" affordance — drag is a power-user shortcut.

### Step 8 — smoke test plan

Manual (this PR ships without automated drag tests — Playwright doesn't reliably synthesize drag events for our timeline grid, and a unit test for the hook would mock most of the visual surface):

| # | Scenario | Expected |
|---|---|---|
| 1 | Toggle labels collapse | Column animates to 48 px, refresh page → stays collapsed, toggle back |
| 2 | Issue with no dates, drag right 5 days | startDate = today, dueDate = today+5; bar appears with `IN_PROGRESS`-coloured fill |
| 3 | Issue with no dates, drag left 3 days | startDate = today-3, dueDate = today |
| 4 | Issue with no dates, drag < 3 px | no mutation, no ghost |
| 5 | Issue with no dates, drag + ESC | drag cancels, no mutation |
| 6 | Issue with only startDate, drag right edge | dueDate = cursor; startDate unchanged |
| 7 | Issue with only dueDate, drag left edge | startDate = cursor; dueDate unchanged |
| 8 | Issue with both dates, drag right edge | only dueDate moves; startDate unchanged |
| 9 | Issue with both dates, drag left edge past dueDate | clamped — drag stops at dueDate - 1 day |
| 10 | Drag past chart right edge | chart auto-scrolls (optional polish; if too noisy, skip and let user release + re-drag) |
| 11 | Drag with developer role on someone else's issue | server rejects (403); toast appears; optimistic update reverts |
| 12 | Click bar (no drag) | detail panel opens as before |

---

## 4. API changes

**None.** `PATCH /api/projects/:projectId/issues/:issueId` already accepts:
```json
{ "startDate": "2026-05-22T00:00:00.000Z", "dueDate": "2026-05-27T00:00:00.000Z" }
```

Pass null to clear (not needed in this gesture — drag always sets, never clears).

---

## 5. UI / UX changes

| # | Surface | Change |
|---|---|---|
| 1 | TimelineLabelColumn header | New chevron toggle at the right edge (icon: `PanelLeftClose` / `PanelLeftOpen`) |
| 2 | TimelineLabelColumn rows (when collapsed) | Render compact: status dot + type icon + issue number only. Hover tooltip with title. |
| 3 | TimelineChart row, issue with no dates | On row hover: `MoveHorizontal` icon at the today column at 60 % opacity. Cursor changes to `ew-resize` on it. |
| 4 | TimelineChart row, issue with one date | On bar hover: cap handle at the **free** edge. |
| 5 | TimelineChart row, issue with both dates | On bar hover: cap handles on both edges. |
| 6 | TimelineChart during drag | Real bar dims to 30 %; dashed ghost bar shows preview; a small tooltip pinned near cursor reads `→ Jun 15` or `May 10 ←`. |
| 7 | TimelineChart after drop | Optimistic bar appears in final position immediately; toast confirms only on server error. |

---

## 6. Risks & considerations

| # | Risk | Mitigation |
|---|---|---|
| 1 | Drag triggers click → panel opens unexpectedly | 3 px movement threshold + `pointer-events: none` on real bar during drag + `wasDragged` flag suppressing next click |
| 2 | Today not visible (project far past/future) | Hide affordance for empty issues outside today view. Click-into-panel is the fallback. Don't fail silently — log to debug. |
| 3 | User drags past chart edge | Phase 1: cursor pinned to last valid position, no auto-scroll. Polish-later: scroll on edge proximity. |
| 4 | Race with another PM editing dates | Optimistic update reverts on 4xx/5xx. No locking. Last-write-wins (same as today). |
| 5 | DEVELOPER drags someone else's issue | Server rejects (403); toast appears; FE reverts. No client-side role gating — keeps the BE the source of truth. |
| 6 | Mouseup outside the window | `document`-level listeners catch it. Defensive: also a `blur` listener cancels the drag. |
| 7 | Mobile / touch | Out of scope. Timeline is a desktop-PM view; no touch sessions to date. |
| 8 | Date crosses DST boundary | We use `startOfDay()` which respects local timezone — drag math is in day counts, not millisecond offsets, so DST jumps don't affect the chosen day. Verify on a project crossing 2026-03-30 (US spring-forward). |
| 9 | Snap to day boundary feels janky on narrow zooms | At `totalDays * 12` minimum, one day is ≥ 12 px which is past the touch-target floor. Acceptable. |
| 10 | Bar edge resize past the opposite date | Clamp: `startDate ≤ dueDate - 1 day`. Drag visual stops at the clamp; release commits at the clamp. |

---

## 7. Out of scope (Phase 2+)

- **Bar body drag** (move whole bar, both dates shift by N days) — different gesture (cursor: grab, not ew-resize). Add when PMs ask.
- **Multi-select drag** (shift-click two bars + drag → both move together).
- **Touch / mobile** — Timeline isn't intended for mobile.
- **Undo toast** — relies on `Cmd+Z` infra we don't have yet. Out of scope.
- **Keyboard date editing** (arrow keys on a focused bar) — accessibility nice-to-have, defer to a screen-reader pass.

---

## 8. Estimated effort

- A (collapsible labels): ~1 h
- B (drag-to-set-dates): ~4 h
- C (bar edge resize): ~1 h (extension of B's hook + 2 new handles)
- Helpers + tests harness setup: ~0.5 h
- Changelog + plan doc: ~0.5 h (the plan, this file)

**Total**: ~6 h. Single PR.

---

## 9. Next step

Implement A → B → C in order. Each is independently committable; ship as one commit since they share the same TimelineChart edit window.
