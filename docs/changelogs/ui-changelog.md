# Frontend / UI Changelog

> Cross-cutting frontend changes that don't belong to a single feature domain: dark mode + theme tokens, keyboard-shortcut system and command palette, axios refresh-token queue, the in-app API docs page, accessibility and breadcrumb polish.

## Owns

- **App shell**: `packages/web/src/App.tsx`, `packages/web/src/components/layout/AppLayout.tsx`, `packages/web/src/main.tsx`, `packages/web/src/index.css`
- **Theme**: `packages/web/src/stores/theme.ts`, Tailwind v4 config (`@tailwindcss/vite`)
- **Shortcuts**: `packages/web/src/hooks/useKeyboardShortcuts.ts`, `packages/web/src/hooks/useRegisterShortcuts.ts`, `packages/web/src/stores/shortcuts.ts`, `packages/web/src/components/shortcuts/`
- **Cross-cutting components**: `packages/web/src/components/ui/`, `packages/web/src/components/ErrorBoundary.tsx`, `packages/web/src/components/ToastContainer.tsx`
- **API client**: `packages/web/src/api/client.ts` (axios + refresh-token queue)
- **Lib**: `packages/web/src/lib/constants.ts`, `error.ts`, `time.ts`, `utils.ts`

## Surface

- Route: `/api-docs` — JWT-gated reader-friendly view of the OpenAPI spec from `/api/docs-json`.
- Global shortcuts: `Cmd+K` (command palette), `Cmd+N` (quick-issue), `Cmd+B` (toggle sidebar), `Cmd+/` (cheat-sheet modal), and per-page shortcuts registered via `useRegisterShortcuts`.

## Timeline

### 2026-05-22 — Timeline drag affordance: always expose both edges (PM-65 follow-up)
**Fixed.** Initial PM-65 commit (`beecdf6`) only rendered the **missing-date** edge handle for one-sided issues, so an issue with `dueDate` set but no `startDate` showed only a *left* handle (for setting the missing startDate) — there was no way to grab the visible right edge to adjust the existing dueDate. User reported it via hover on a dueDate-only bar.

Collapsed the mode taxonomy to three: `create-from-today`, `set-due`, `set-start`. Every visible bar now renders **both** edge handles unconditionally — left-edge = `set-start`, right-edge = `set-due` — and the hook's `resolveDates` preserves whichever date isn't being dragged (or fills it in if missing). `resize-left` / `resize-right` are gone; they were redundant with set-start/set-due. Direction for `create-from-today` is picked at commit time from cursor-vs-anchor instead of being baked into the mode, which also drops the `create-left` / `create-right` split.

- Source: `packages/web/src/features/timeline/hooks/useTimelineDateDrag.ts`, `packages/web/src/features/timeline/components/TimelineChart.tsx`.

### 2026-05-22 — Timeline: collapsible labels + drag-to-set-dates + bar edge resize (PM-65)
**Added.** Three gestural improvements to the project Timeline view, bundled because they share the same `useTimelineDateDrag` hook and TimelineChart edit window. Spec + decisions: [`docs/plans/timeline-drag-dates.md`](../plans/timeline-drag-dates.md).

1. **Collapsible label column.** The fixed 280 px "Issues" column ate ~25 % of horizontal screen real estate on a 13" laptop. A new `PanelLeftClose` / `PanelLeftOpen` chevron in the column header collapses it to 48 px (status dot + type icon only; full title in a `title` tooltip). Persisted to `localStorage['timeline-labels-collapsed']`; respected by both `TimelinePage` and `SharedTimelinePage` (public share view) so client guests see the same option.
2. **Drag-to-set-dates.** Hovering a chart row reveals an affordance — `MoveHorizontal` icon at today's column for issues with no dates, or a tiny edge handle on bars with one date — and dragging horizontally commits the date pair on release. From-today drags set the missing pair (`startDate = today, dueDate = cursor` for right-drag; reverse for left). From-edge drags on one-sided issues set the missing date with the existing date as anchor. A 3 px click-vs-drag threshold suppresses noisy clicks; `Escape` cancels the drag mid-gesture; `window.blur` cancels too. The real bar dims to 30 % during drag and a small floating label near the cursor shows the would-be range. Optimistic update via TanStack `setQueryData` so the bar materialises before the network round-trip; on 4xx/5xx the previous payload is restored and a toast surfaces the error.
3. **Bar edge resize.** Issues with both dates set show edge handles on both sides; dragging an edge moves only that date (`resize-left` → startDate; `resize-right` → dueDate), with the other date anchored. Clamped so `startDate ≤ dueDate - 1 day` — drag visual stops at the clamp.

Backend is unchanged — every gesture calls the existing `PATCH /api/projects/:projectId/issues/:issueId` with the new date pair. The pixel-to-date math lives in a new pure helper `pixelToDate(offset, rangeStart, rangeEnd, chartWidthPx)` in `features/timeline/lib.ts`; the chart's inner wrapper feeds its `getBoundingClientRect()` in so layout reflows (resize, sidebar collapse) don't break the snap.

Smoke plan executed in this PR is documented in the plan doc §3 Step 8; needs manual browser pass before close (Playwright doesn't reliably synthesise drag on the timeline grid yet).

- Source: `packages/web/src/features/timeline/hooks/useTimelineDateDrag.ts` (new), `packages/web/src/features/timeline/lib.ts` (`pixelToDate` + `clampDate` helpers), `packages/web/src/features/timeline/components/TimelineChart.tsx` (affordances + ghost bar + dim-during-drag), `packages/web/src/features/timeline/components/TimelineLabelColumn.tsx` (collapsed render mode + header chevron), `packages/web/src/pages/TimelinePage.tsx` (mount hook + collapsed state), `packages/web/src/features/share-link/pages/SharedTimelinePage.tsx` (collapsed state only — drag intentionally not exposed on the public read-only view).

### 2026-05-22 — Project sidebar UX: popover selector, scrollable nav, "Module" rename
**Changed.** Four small fixes to `AppLayout.tsx` that the existing sidebar had been quietly failing at as the workspace grew:

1. **Project selector → searchable popover.** The "Select Project" dropdown used to expand inline below the trigger button, pushing every nav item (Home/Standup/Admin/…/Dashboard/Board/…/Settings) down the sidebar. Past a dozen projects it pushed real navigation off-screen; past 50 it became unusable. Replaced with a shadcn `Popover` containing a `Command` palette (search input + scrollable list capped at `max-h-72` + "+ New Project" as a separate group). Trigger look is unchanged. The popover floats via Radix Portal so the sidebar layout stays fixed regardless of project count. The old click-outside `useEffect` was removed — Popover handles dismiss natively.
2. **Nav list scrolls within the sidebar.** The `<nav>` was `flex-1` but missing `overflow-y-auto`, so a long list (admin user sees 6+ global items + 9 project items) pushed the bottom user panel (theme toggle / avatar / logout) off-screen. Added `overflow-y-auto [scrollbar-width:thin]` — top and bottom panels now stay fixed; only the nav itself scrolls.
3. **"Table of Content" sidebar label → "Module".** Pure cosmetic — route, page component, BE endpoint (`/issues/table-of-content`), and types (`TableOfContent`, `TableOfContentDomain`, `TableOfContentEpic`) all keep the original name so external bookmarks / MCP tool / Slack unfurl don't break. Only the human-visible label is renamed to match how the domain layer talks about `DOMAIN` rows ("Module") everywhere else.

- Source: `packages/web/src/widgets/AppLayout/AppLayout.tsx`.

### 2026-05-22 — Share-links manage page + sidebar + Settings entry (PM-60 PR3)
**Added.** A dedicated PM-facing page at `/projects/:projectId/share-links` for managing every public share link on a project, plus a "Share Links" entry in the project sidebar (PM↑ only) and a card in Settings linking to it. PR2 already exposed a quick-access "Manage" tab inside the Share dialog on the Timeline toolbar, but that surface is one column of compact rows — fine for a glance, not enough for an audit. The new page is the spec-mandated long form (per `docs/plans/public-share-link.md` §5 row 5) with an 8-column table (Created, Created by, Scopes, Expires, Last accessed, Views, Status, Actions), per-row actions (Copy URL, Rotate passcode, Revoke), a "New share link" CTA that opens the existing `ShareLinkDialog`, and a passcode-rotate modal with one-shot reveal of the new value (AWS-style — bcrypt-hashed server-side, can only be rotated, not retrieved).

Role gating mirrors the BE `RolesGuard` (`@Roles(ADMIN, PM)`): the sidebar entry only renders when `useProjectRole(projectId)` is PM↑ (or the user is a superuser) so DEVELOPERs never see the link; the Settings card is conditionally rendered behind `isAdminOrPm`; and a DEVELOPER who lands on the URL via a direct link sees a "PM↑ only" placeholder with a Back link instead of a 403. Reuses `useProjectRole` from PR2, the same `shareLinkApi` client, and the same `confirmDialog()` flow for the destructive Revoke action (which, on success, makes the public URL return 410 Gone).

- Source: `packages/web/src/pages/ShareLinksPage.tsx` (new), `packages/web/src/features/project/components/settings/ShareLinksSection.tsx` (new), `packages/web/src/pages/SettingsPage.tsx` (wire section behind `isAdminOrPm`), `packages/web/src/widgets/AppLayout/AppLayout.tsx` (sidebar entry gated by `useProjectRole`), `packages/web/src/app/router/index.tsx` (register route under `ProjectRouteGate`).

### 2026-05-21 — Public share-link FE route moves from `/share/:token` to `/s/:token` (PM-60 PR2 follow-up)
**Fixed.** PR2 used `/share/:token` for the public passcode + timeline routes. That collided with the production nginx config (`packages/web/nginx.conf:41`), which rewrites every `/share/*` to `/api/share/*` and proxies to the backend so the existing OG-unfurl `ShareController` can answer Slack/Twitter crawlers on `/share/PITB-12`. Hitting `https://pm.burningbros.kr/share/<32-hex-token>` in prod therefore returned `{ "success": false, "statusCode": 404, "message": "Invalid issue key" }` — the OG controller tried to parse the token as `KEY-NUMBER`.

Renamed the FE routes to `/s/:token` and `/s/:token/timeline`. nginx's `location ~ ^/share/` regex no longer matches, so the request falls through to `location / { try_files $uri /index.html; }` and the SPA picks it up. The OG unfurl route is unchanged; the `/api/public/share/*` BE endpoints are also unchanged (they go through `location /api {}` which is matched before the `^/share/` regex).

Updated all three navigation surfaces:
- `packages/web/src/app/router/index.tsx` — `Route path` changed.
- `packages/web/src/features/share-link/pages/{SharePasscodePage,SharedTimelinePage}.tsx` — every `navigate(\`/share/${token}\`...)` rewritten to `/s/`.
- `packages/api/src/share-link/share-link.controller.ts` `buildUrl()` — generated URLs now contain `/s/`, so the dialog and `GET /share-links` list both hand out the working shape.

Documented in [`docs/architecture/backend/public-share-link.md` §threat model row 12](../architecture/backend/public-share-link.md) so the next contributor doesn't reintroduce the collision.
- Source: `packages/web/src/app/router/index.tsx`, `packages/web/src/features/share-link/pages/SharePasscodePage.tsx`, `packages/web/src/features/share-link/pages/SharedTimelinePage.tsx`, `packages/api/src/share-link/share-link.controller.ts`.

### 2026-05-21 — Public timeline share link UI (PM-60 PR2)
**Added.** Web surface for the passcode-gated Timeline share feature shipped in PR1.

- **Internal side** — `TimelineHeader` exposes a `rightActions` render-slot so `TimelinePage` injects a **Share** button (visible to ADMIN/PM only via `useProjectRole`). Click opens `ShareLinkDialog`, a tabbed shadcn dialog:
  - **Create new** — passcode field with a `crypto.getRandomValues` 10-char generator (`a-z0-9` minus look-alikes), expiry input (default +90 days + "No expiry" checkbox), TIMELINE scope checkbox locked on. Submit → BE creates the row → switches to a one-shot reveal showing URL + passcode together with a `Copy URL + passcode` button. Closing the dialog destroys the passcode, AWS-access-key style.
  - **Manage** — `useQuery(['share-links', projectId])` lists every link with status pill (Active / Expired / Revoked / Locked), accessCount / lastAccessedAt, and per-row icon actions: Copy URL, Rotate passcode (inline form with a fresh one-shot reveal), Revoke (`confirmDialog()`, destructive). Hard-delete is ADMIN-only and intentionally not exposed in the UI; PMs revoke instead.
- **Public side** — two routes mounted **outside `AuthGuard`** in `app/router/index.tsx`:
  - `/share/:token` → `SharePasscodePage`. Centered card with a single passcode input; submit calls `POST /api/public/share/:token/unlock`. Response JWT goes into `sessionStorage` under `bbpm.share.${token}` (per-tab, dies on close, no localStorage so a leaked machine doesn't outlive the tab). Inline `ErrorBanner` covers the full status matrix — wrong passcode (red), gone link (red), session-expired (amber), locked with countdown (amber), network (red). Same red message for "wrong passcode" and "unknown token" so an attacker can't enumerate slugs.
  - `/share/:token/timeline` → `SharedTimelinePage`. Slim header (project name, "Shared by …", expiry hint, Log out) over the same `TimelineLabelColumn` + `TimelineChart` + `TimelineTooltip` leaf components the internal Timeline uses. Reuses the timeline hooks (`useTimelineDateRange`, `useTimelineGroups`, `useTimelineRows`) by piping the whitelisted public payload through `toIssueShape` — internal Timeline isn't refactored, zero regression risk. Click → `PublicIssueModal` (a Dialog showing only title / type / status / priority / dates / assignee `name+avatar` / labels) instead of the internal `IssueDetailPanel`, which would pull comments / activity / linked issues and defeat the whitelist.
- **Axios instance** `features/share-link/api/publicApi.ts` is separate from the main JWT client. Auto-attaches the share JWT from sessionStorage on every request except `/unlock`. On 401 OR 410 the interceptor drops the local JWT — without 410 the passcode page would see a still-valid JWT and bounce back to the timeline, looping. 423 (locked) does NOT clear because the JWT is fine, only the link is paused.
- **Redirect flow** — when `SharedTimelinePage` queries return 401/410 it navigates back to `/share/:token` carrying a `location.state.reason` of `session-expired` / `gone`, and the passcode page seeds the inline banner from that state so the user understands why they landed at a form instead of the timeline. Banner clears the moment the user types — they've acknowledged it.
- **Dark mode** — every chrome rendered inside the user's BB PM session (the dialog + the public pages) carries `dark:` variants. Public pages use the same `bg-gray-900 / text-gray-100` palette as the internal app for consistency.
- **Adapter detail** — `toIssueShape` must pass `createdAt` through (not `''`) because `computeBarStyle` falls back to `createdAt` when `startDate` is null; an empty string parses to `Invalid Date` and bars collapse to 8px dots. `createdAt` is now part of the BE whitelist (timestamp only, no PII).
- Source: `packages/web/src/features/share-link/**`, `packages/web/src/app/router/index.tsx`, `packages/web/src/features/timeline/components/TimelineHeader.tsx`, `packages/web/src/pages/TimelinePage.tsx`, `packages/api/src/share-link/application/get-public-timeline.use-case.ts`.

### 2026-05-21 — Calendar drag-to-schedule: Unscheduled panel + droppable day cells (PM-58)
**Added.** Right-rail companion panel on `/projects/:projectId/calendar` that lists every active ticket without a `dueDate` (status ∈ `{BACKLOG, TODO, IN_PROGRESS}`, archived excluded). Dragging a row onto any `DayCell` patches the issue's `dueDate` to that day's local midnight; the chip then appears on the calendar. Mutation runs through the existing `PATCH /issues/:id` flow so all the standard side effects (activity row, undo path, Slack DM on assignee change) still fire.

UX notes:
- Panel collapses to a 36px chevron via `?unscheduled=0` URL param (mirrors `?toc=` on the Board).
- Sort: `priority` (HIGH → LOW) then `updatedAt desc`.
- Rows inherit the page's filter chips (Priority / Type / Source / Assignee / Status / Search). Status is intersected with the implicit active set so the panel never shows REVIEW_QA / RECHECK / DONE / CANCELED even when the user opens the Status filter wide.
- During drag, all calendar cells (including prev/next-month padding) get a `bg-primary-50` + `ring-primary-300` highlight so the drop target is unambiguous.
- Drop success toast: `Scheduled for {weekday, month day}`. Error path rolls back via React-Query's onError + a toast.
- React-Query invalidation keyed on `['issues', projectId]` so the month grid AND the unscheduled query refresh together.

PMs asked for a single planning surface so a weekly triage doesn't bounce between Board, detail panel, and DatePopover.
- Source: `packages/web/src/features/calendar/components/UnscheduledPanel.tsx` (new), `packages/web/src/features/calendar/hooks/useUnscheduledIssues.ts` (new), `packages/web/src/features/calendar/hooks/useCalendarDnd.ts` (new), `packages/web/src/features/calendar/components/DayCell.tsx`, `packages/web/src/features/calendar/lib.ts`, `packages/web/src/pages/CalendarPage.tsx`.

### 2026-05-21 — Board TOC sidebar (Module → Epic → Task)
**Added.** Left rail on `/projects/:projectId/board` that shows the same Module → Epic outline as the standalone TOC page, **plus** a third level for Task / Bug children of each Epic. Rows are rendered minimally — a coloured **status dot** (from `STATUS_BAR_COLORS`) replaces the BACKLOG/TODO/... text badge, and the assignee is shown as an **avatar only** (no name, no email) using `UserAvatar size="xs"`. Click any row (Epic or Task/Bug) → opens `IssueDetailPanel` for that issue. Module headers and Epic rows additionally toggle their own expand/collapse state. Collapse the whole rail to a 36px chevron with the header button; persisted via `?toc=0/1` URL param so reload keeps the user's choice (matches the existing `?swimlane=` / `?archived=` codec).

PMs asked for a dense, side-by-side "where am I in this project" view that doesn't replace the kanban — the swimlane Epic header (full chip + counter + status badge) is **unchanged**. The sidebar reads the existing `useQuery(['toc', projectId])` already prefetched for the Module filter chip, so no extra network calls.
- Source: `packages/web/src/features/issue/components/board/BoardTocSidebar.tsx` (new), `packages/web/src/pages/BoardPage.tsx`.

### 2026-05-21 — Table of Content page + Module filter + bulk-assign UI (PR2: Web for the DOMAIN feature)
**Added.** Front-end half of the Module (DOMAIN) feature shipped in the issue-changelog PR1 entry. Three user-facing surfaces:
- **`/projects/:projectId/table-of-content` page** (`packages/web/src/pages/TableOfContentPage.tsx`): outline view of `Domain → Epic` with per-Epic task/done counts and progress bars. `+ Add Module` in the header, `+ Add Epic` inline per Module. An "Unassigned Epics" amber-tinted section lets PMs assign Modules one by one via an inline `Move to module…` dropdown — backed by `bulkSetParent([epicId], domainId)`. Empty state CTA guides first-time use. Sidebar entry between Specs and Board (icon: `ListTree`).
- **Board Module filter chip** (`BoardToolbar.tsx` + `SwimlaneBoardView.tsx`): inline `Module:` select. When set, swimlanes are filtered to `epic.parentId === domainId`; "No Epic" lane is also dropped because it can't belong to a Module. The chip only appears when the project has Modules (sourced from `GET /issues/table-of-content`). State persists via the new `?domain=<uuid>` URL param in the shared filter codec.
- **CreateIssueModal**: `Module` option added to the Type select. When type=DOMAIN the parent field is hidden (Modules are top-level). When type=EPIC a "Parent Module" Combobox lists available Modules with `📁` icons and a `None (unassigned)` fallback. TASK/BUG/SUB_TASK behaviour unchanged.
- **Issues page bulk-assign Module**: `BulkActionBar.tsx` gains a "Module" dropdown that is only enabled when every selected issue is type `EPIC`. Tooltip explains why it's disabled otherwise. Calls `bulkSetParent` (PM↑) and toast-confirms the count.

**Breadcrumb already works for free**: `IssueDetailHeader.tsx` renders `parent.parent → parent → current`, and `IssueQueryService.findOne` already selects the grandparent. A Task under an Epic under a Module now shows `📁 #N Module / ⚡ #N Epic / ✅ #N Task` with no code change.

Plan: [`docs/plans/table-of-content-domain-level.md`](../plans/table-of-content-domain-level.md). Skipped from §5 of the plan: per-card Module badge on `IssueCard` — would require plumbing the Module map through `BoardColumn`/`SwimlaneRow`/`IssueCard`, and the TOC page + breadcrumb already cover the navigation need at much lower delta. Tracked as deferred suggestion.
- Source: `packages/web/src/pages/TableOfContentPage.tsx`, `packages/web/src/features/issue/api.ts`, `packages/web/src/features/issue/repository.ts`, `packages/web/src/features/issue/components/CreateIssueModal.tsx`, `packages/web/src/features/issue/components/BulkActionBar.tsx`, `packages/web/src/features/issue/components/board/BoardToolbar.tsx`, `packages/web/src/features/issue/components/board/SwimlaneBoardView.tsx`, `packages/web/src/pages/BoardPage.tsx`, `packages/web/src/pages/IssuesPage.tsx`, `packages/web/src/widgets/AppLayout/AppLayout.tsx`, `packages/web/src/app/router/index.tsx`, `packages/web/src/shared/ui/filterState.ts`, `packages/web/src/shared/lib/filter-codec.ts`, `packages/web/src/shared/config/constants.ts`.

### 2026-05-20 — DatePopover primitive replaces native `<input type="date">` (2bf8a2f, PM-52)
**Added.** New shared primitive `shared/ui/DatePopover.tsx`: button trigger + Radix Popover with month-grid calendar (Mo-Su), Prev/Next month chevrons, "Today" + "Clear" affordances, ring-highlight on today, primary-fill on selected day. Replaced the native `<input type="date">` in `IssueMetadata.tsx`'s `DateField` (used for Start Date + Due Date on the issue detail panel).

**Fixed.** Native `<input type="date">` fired `onChange` on every segment update (year / month / day), so each keystroke triggered an API PATCH and a new `activity` row — typing a single date produced 3+ activity entries and polluted the audit log. `DatePopover` commits exactly once per user action (click a day, click Today, click Clear) → 1 PATCH, 1 activity row per real change.

Reuses the existing `Popover` Radix primitive — no new dependency (no `react-day-picker`, no `date-fns`). Calendar lib helpers (`getMonthGrid`, weekday math) inlined locally; can be extracted later if a third caller needs them.
- Source: `packages/web/src/shared/ui/DatePopover.tsx`, `packages/web/src/features/issue/components/detail/IssueMetadata.tsx`.

### 2026-05-19 — Combobox separates trigger and list rendering (PM-42 follow-up)
**Added.** `ComboboxOption.triggerRender` (optional, falls back to `render` → `label`). Lets a single Combobox show a rich stacked layout in the dropdown (e.g. avatar + name + email on two lines) while keeping the trigger button compact on its 36px row. Without it, the Assignee picker's selected state stretched the trigger to two lines and the inline content drifted into the middle.
- Source: `packages/web/src/shared/ui/combobox.tsx`, `packages/web/src/features/issue/components/CreateIssueModal.tsx`.

### 2026-05-19 — Dialog centred without a permanent transform (PM-42 follow-up)
**Changed.** DialogContent used `translate-x-[-50%] translate-y-[-50%]` for centring, which left a permanent CSS transform on the open dialog. That transform turned the dialog into a containing block for every `position: fixed` descendant — so a Combobox/Select portal'd inside (PM-42) got trapped in the dialog's layout and rendered inline instead of floating above. Swapped centring to `fixed inset-0 m-auto h-fit w-[calc(100%-2rem)] max-w-lg`, which has zero transform at idle, so nested popovers float above the dialog the way users expect.
- Source: `packages/web/src/shared/ui/dialog.tsx`.

### 2026-05-19 — Generalised overlay portal context to Dialog + Select (PM-42)
**Changed.** The PM-27 fix shipped a `SheetPortalContext` so a `Popover` would render inside the enclosing `Sheet` (otherwise the Sheet's `react-remove-scroll` cancelled wheel events on the popover). Same root cause hit `Select`/`Combobox` opened inside the Create Issue **Dialog** — wheel scroll silently dead. Generalised the context to cover both Sheet and Dialog (`useOverlayPortalContainer`, aliased from the existing `useSheetPortalContainer` for back-compat) and taught `Select` to auto-portal into the container too. Combobox already routes through `Popover`, so it inherits the fix for free.
- New: `useOverlayPortalContainer` export from `packages/web/src/shared/ui/sheet-portal-context.ts` (same value, clearer name).
- Source: `packages/web/src/shared/ui/sheet-portal-context.ts`, `packages/web/src/shared/ui/dialog.tsx`, `packages/web/src/shared/ui/select.tsx`.

### 2026-05-19 — Popover auto-portals into the enclosing Sheet (PM-27, bdf8a30)
**Fixed.** Sub-task assignee/status pickers (and any other `Popover` rendered inside an `IssueDetailPanel` Sheet) couldn't mousewheel-scroll: Radix Sheet's `react-remove-scroll` `preventDefault()`-ed wheel events whose target was portal'd to `<body>` outside the Sheet content tree. `SheetContent` now exposes its DOM node via context; `PopoverContent` reads it and uses it as the portal `container`, so the popover lives inside the Sheet's whitelist. Mousewheel works; scrollbar drag unchanged.
- New: `packages/web/src/shared/ui/sheet-portal-context.ts` (context + `useSheetPortalContainer` hook).
- Source: `packages/web/src/shared/ui/sheet.tsx`, `packages/web/src/shared/ui/popover.tsx`.
- Verified with a Playwright wheel-dispatch probe: `defaultPrevented` flipped from `true` (pre-fix, doc-bubble) to `false`; CommandList `scrollTop` 0 → 52.

### 2026-05-13 — Filter persistence via URL searchParams
**Added.** Board / Issues / Timeline pages now sync their filter state (`assignees`, `labels`, `components`, `epicId`, `status`, `priority`, `type`, `search`, plus page-specific toggles like `showArchived`, `groupByEpic`, `viewMode`, `sortBy`/`sortOrder`, `groupBy`) with `useSearchParams`. Reload, browser back/forward, and "Copy URL" share now preserve the view. Search input writes are debounced 300ms with `replace: true` to avoid history spam. `localStorage["issues-view-mode"]` is removed — URL is now the source of truth.

- New: `packages/web/src/lib/filter-codec.ts` — pure `serializeFilter`/`deserializeFilter` plus `setBool`/`getBool`/`setEnum`/`getEnum` helpers.
- New: `packages/web/src/hooks/useFilterSearchParams.ts` — wraps `useSearchParams` with debounced search write and external-URL-change sync.
- Migrated: `packages/web/src/pages/BoardPage.tsx`, `IssuesPage.tsx`, `TimelinePage.tsx`. Each page lost 5–9 ad-hoc `useState` hooks in exchange for one `useFilterSearchParams()` call.
- Plan: [`docs/plans/filter-persistence.md`](../plans/filter-persistence.md).

### 2026-04-23 — `useMemo` ordering fix (060de02)
**Fixed.** A React hooks-order error fired when a page early-returned (`if (loading) return …`) before a `useMemo`. Moved the memo above the early return on every affected page.
- Source: cross-cutting; commit diff lists the pages.

### 2026-04-20 — In-app API docs page (ac9db46)
**Added.** Route `/api-docs` renders a custom reader-friendly view over `/api/docs-json` (the same Swagger spec) — grouped by tag, with collapsible request/response examples and the API-key flow explained. Easier than asking developers to read Swagger UI.
- Source: `packages/web/src/pages/ApiDocsPage.tsx`.

### 2026-04-17 — Issue detail panel cn-import fixes (eeb71ca, 617912b)
**Fixed.** Two cycles of the same root cause: `IssueDetailPanel.tsx` referenced `cn()` without importing it after a partial refactor. Added explicit import.
- Source: `packages/web/src/components/issue/IssueDetailPanel.tsx`.

### 2026-04-17 — Dark mode + theme tokens (141a41a)
**Added.** Full dark-mode coverage. `useThemeStore` (Zustand) holds `theme: 'light' | 'dark' | 'system'`, persists to `localStorage`, and writes `class="dark"` to `<html>`. Every component swapped raw hex colors for Tailwind v4 semantic tokens (`bg-background`, `text-foreground`, `bg-card`, `border-border`, etc.) so the same JSX renders both modes. A toggle lives in the navbar.
- Source: `packages/web/src/stores/theme.ts`, `packages/web/src/index.css` (CSS variable definitions for both themes), every component.

### 2026-04-17 — Keyboard-shortcut system + command palette (f20ea1f)
**Added.** Three pieces:
- `stores/shortcuts.ts` — a Zustand registry where pages call `useRegisterShortcuts(<bindings>)` to declare their keys.
- `hooks/useKeyboardShortcuts.ts` — top-level listener that consults the registry on every keydown.
- `components/shortcuts/` — the command palette modal (`Cmd+K`) listing every registered shortcut + project navigation actions, and the cheat-sheet modal (`Cmd+/`).

Registry is hierarchical: page-level bindings unregister on unmount, so a shortcut defined on the Board page doesn't fire on the Timeline page.
- Source: `packages/web/src/hooks/useKeyboardShortcuts.ts`, `packages/web/src/hooks/useRegisterShortcuts.ts`, `packages/web/src/stores/shortcuts.ts`, `packages/web/src/components/shortcuts/`.

### 2026-04-06 — Initial frontend scaffold (init commit)
**Added.** React 19 + Vite 8 + Tailwind v4 + React Router 7. `AuthGuard` wraps every authenticated route, redirects to `/login` if no token, otherwise calls `loadUser()` once and renders `<AppLayout>`. axios client (`api/client.ts`) injects the bearer token, refresh-on-401 queue prevents concurrent refresh races. React Query `defaultOptions: {retry: 1, refetchOnWindowFocus: false}` to avoid surprise refetches on alt-tab. `ToastContainer` reads from `stores/toast.ts`. `ImagePreviewModal` reads from `stores/imagePreview.ts`.
- Source: `packages/web/src/App.tsx`, `packages/web/src/api/client.ts`, `packages/web/src/stores/`.

## Open questions / known issues

- **P8 — Polling-only data sync.** React Query refetches on cache misses and explicit invalidations, but two users editing the same board diverge until one refreshes. No WebSocket / SSE today.
- **No frontend unit tests.** The web package has no Jest / Vitest setup. Manual E2E (Stage 4 QA agent) is the only safety net.
- **Tiptap editor used in issues, comments, and specs** — three slightly different feature subsets bundled in each invocation; consolidating into one shared config is a future cleanup.
- **`localStorage` token storage** is XSS-readable. Mitigation today: strict CSP via nginx config (frontend dockerfile) + `dompurify` sanitization on all rendered markdown. A future hardening would use `httpOnly` cookies — but that requires changing the SPA `/api` flow to same-origin (which it already is via nginx proxy).
