# Plan: Persist Board / Issues / Timeline filters across reload

> **Status**: Proposed
> **Domain**: `ui`, frontend cross-cutting (see [`docs/changelogs/ui-changelog.md`](../changelogs/ui-changelog.md))
> **Tracks**: original `docs/IMPLEMENTATION_PLAN.md` Phase 2 Step 2.4 — "URL-based filter persistence (back / refresh)" — never shipped.

---

## Requirement summary

- **What**: filter state on `BoardPage`, `IssuesPage`, `TimelinePage` must survive page reload, browser back/forward, and be shareable as a URL.
- **Why**: today a user who narrows the board to "assigned to me, priority HIGH" loses everything on F5. Reported friction. The existing pattern in `TeamIssuesPage.tsx:22-25` (single-field, `useSearchParams`) already proves the approach works.
- **For whom**: every project member; the team dashboard already works this way, so muscle memory is built.

---

## Affected services

- **Services**: `web` only. No API or DB change.
- **Files to modify**:
  - `packages/web/src/components/filter/FilterBar.tsx` — already defines `FilterState` + `INITIAL_FILTER`. Touch to export a codec (see new file below).
  - `packages/web/src/pages/BoardPage.tsx:75-85` — replace nine `useState` hooks with a single state managed by the new hook.
  - `packages/web/src/pages/IssuesPage.tsx:38, :40-41, :45` — replace `useState<FilterState>`, `sortBy`/`sortOrder`, `showArchived` with the new hook.
  - `packages/web/src/pages/TimelinePage.tsx:36-37, :43-47` — replace per-field `useState` (search, status, priority, type, assignees, groupBy, collapsedEpics) with the new hook.
- **New files**:
  - `packages/web/src/hooks/useFilterSearchParams.ts` — one hook used by all three pages; encapsulates `useSearchParams` ↔ `FilterState` conversion and a debounced URL write for the `search` field.
  - `packages/web/src/lib/filter-codec.ts` — pure functions `serializeFilter(state) → URLSearchParams` and `deserializeFilter(URLSearchParams) → FilterState`. Easier to unit-test than embedding inside the hook.
- **DB / Prisma**: none.

---

## Proposed implementation

### Step 1 — Define the URL encoding (in `lib/filter-codec.ts`)

| Field | URL param | Encoding |
|---|---|---|
| `assignees` (Set<string>) | `assignees` | comma-separated UUIDs |
| `labels`, `components` | `labels`, `components` | comma-separated UUIDs |
| `status`, `priority`, `type` (Set<enum>) | `status`, `priority`, `type` | comma-separated enum values |
| `epicId` (string \| null) | `epic` | UUID; omitted when null |
| `search` (string) | `q` | URL-encoded; omitted when empty |
| `showArchived` (boolean) | `archived` | `"1"`; omitted when false |
| `groupByEpic` (Board) | `swimlane` | `"1"` / omitted |
| `viewMode` (Issues) | `view` | `"list"` / `"tree"` |
| `sortBy`, `sortOrder` (Issues) | `sort`, `order` | as-is |
| `groupBy` (Timeline) | `group` | `"epic"` / `"flat"` |

Rules:
- Default (empty / null / false / `"all"`) → field is **omitted** from the URL — keeps URLs short.
- Unknown params (e.g., a typo, or a field from a future version) are ignored; do not throw.
- Codec is symmetric: `deserialize(serialize(state))` ≡ state.

### Step 2 — Build the hook `useFilterSearchParams`

Signature:
```ts
function useFilterSearchParams<S extends Partial<FilterState>>(
  defaults: S
): [S, (next: Partial<S>) => void]
```

Behavior:
- Reads `useSearchParams()` once on mount, runs `deserializeFilter`, merges with `defaults` to fill anything not in the URL.
- The setter merges the patch into the current state and writes back to URL via `setSearchParams(serialize(merged), { replace: true })` — `replace` so the back button doesn't fill with one entry per keystroke.
- **Debounce `search` writes by 300ms** to avoid history spam while typing. Other fields write immediately.
- `useEffect` syncs back if the URL changes externally (browser back/forward).

### Step 3 — Migrate each page

For each of `BoardPage`, `IssuesPage`, `TimelinePage`:
1. Delete the per-field `useState` hooks.
2. Replace with `const [filter, setFilter] = useFilterSearchParams(INITIAL_FILTER)`.
3. Find every read site (`filter.assignees`, `filter.search`, …) — should already match `FilterState` shape because they all use the same `FilterBar` component.
4. Find every write site (`setStatus(...)`, `setSearch(...)`) and replace with `setFilter({ status: ... })`.
5. Page-specific extras (`groupByEpic` on Board, `viewMode` / `sortBy` / `sortOrder` on Issues, `groupBy` / `collapsedEpics` on Timeline) ride the same hook with their own codec entries — except `collapsedEpics` which stays in component state (per-session, not worth in URL).
6. Remove the `localStorage["issues-view-mode"]` block at `IssuesPage.tsx:53-56`; the URL is now the source of truth (with `?view=` default ≠ explicit fallback).

### Step 4 — Visual side effects

- `FilterBar` already shows an "active filters" badge (`hasActiveFilters` helper). After the migration this badge reads from the URL-driven state — no change.
- Add a "Clear filters" button to the right of the search box; it calls `setFilter(INITIAL_FILTER)` which empties the URL (effectively `setSearchParams({})`).
- "Copy view URL" button — small enhancement: copies `window.location.href` so users can share filtered views in Slack/PR. Optional, mark as nice-to-have.

### Step 5 — Tests

No frontend test runner today (per [`docs/changelogs/ui-changelog.md`](../changelogs/ui-changelog.md) open questions). Manual verification covers:
1. Open `/projects/<KEY>/board?status=TODO,IN_PROGRESS&priority=HIGH` directly → board renders filtered.
2. Apply a filter → reload → filter persists.
3. Apply a filter → browser back → URL clears + filter clears.
4. Type in search → wait 300ms → URL gains `?q=...` (not one entry per keystroke).
5. "Clear filters" → URL params disappear.
6. Click "Copy view URL" → paste in incognito + login → same filtered view.

---

## API changes

**None.** This is a pure-frontend change. The existing `GET /api/projects/:projectId/issues` filter query params are unchanged.

---

## UI / UX changes

- Filter state visible in URL (as documented above).
- New "Clear filters" button beside `FilterBar`'s search input.
- (Optional) "Copy view URL" button next to "Clear filters".
- `localStorage["issues-view-mode"]` is removed — replaced by `?view=list|tree`. **One-time UX impact**: existing users will see their saved `viewMode` reset to the default once.

---

## Risks & considerations

| # | Risk | Mitigation |
|---|---|---|
| 1 | Long URLs when many filters active (e.g., 10 assignees × 10 labels). | Comma-separated UUIDs are still under typical browser URL limits (2KB+). If we hit issues, switch to a JSON-compressed `f=` param. |
| 2 | Per-keystroke search writes pollute history. | Debounce 300ms + `replace: true` (no history entry per write). |
| 3 | URL ↔ state desync when both change in the same tick (rare race). | Use `useSearchParams` as the source of truth; the hook re-reads on URL change. |
| 4 | Existing bookmarks pointing at `/projects/:key/board` without params still work. | Defaults are applied when params are absent — backward compatible. |
| 5 | `viewMode` migration drops user's previous preference once. | One-line release note in CHANGELOG; not customer-facing. |
| 6 | Filter URL leaks UUIDs to anyone with the link, even if they wouldn't see the underlying issue. | UUIDs are not secrets — the API still enforces `ProjectMemberGuard`. |

---

## Out of scope

- **Saved filter presets** (e.g., "My assigned + High priority"). Could be a follow-up, persisted server-side in a `user_filter_presets` table.
- **Sharing filtered views as a notification** (Slack post with the URL). Independent feature.
- Migrating `collapsedEpics` to URL — too noisy, low value.
- Adding a frontend test runner — separate plan.

---

## Estimated effort

- Files modified: **5** (3 pages + 1 FilterBar export + 1 README/changelog).
- Files added: **2** (hook + codec).
- Complexity: **Medium**. Logic is mechanical but spans 3 large pages.
- Reasoning: the FilterBar already centralizes the shape; the codec is pure and unit-testable; the hook is ~40 lines. Most of the time goes into deleting `useState` clutter across the three pages and verifying every reader/writer.

---

## Next step

**Awaiting user approval** → `/2-implement`.

When implemented, update [`docs/changelogs/ui-changelog.md`](../changelogs/ui-changelog.md) with an entry under the date of merge, citing the merge commit SHA.
