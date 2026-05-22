# Issue Changelog

> The heart of the system. Issues with hierarchy (`EPIC` → `TASK`/`BUG` → `SUB_TASK`), kanban ordering, dependency links, components, labels, comments, attachments, activity log, multiple dates (`startDate`, `dueDate`, `focusDate`), auto-archive, and the `isRecheck` decorator. This is the longest changelog by design — it's where most of the product lives.

## Owns

- **Modules**: `packages/api/src/issue/` (controller, service, module, scheduler, DTOs), `packages/api/src/issue-link/`, `packages/api/src/issue-spec-link/`, `packages/api/src/comment/`, `packages/api/src/activity/`, `packages/api/src/label/`, `packages/api/src/component/`, `packages/api/src/template/`
- **Frontend**: `packages/web/src/api/issues.ts`, `packages/web/src/pages/BoardPage.tsx`, `packages/web/src/pages/IssuesPage.tsx`, `packages/web/src/pages/TeamIssuesPage.tsx`, `packages/web/src/components/board/`, `packages/web/src/components/issue/`, `packages/web/src/components/comment/`, `packages/web/src/components/activity/`
- **Tables**: `issues`, `issue_labels`, `issue_components`, `issue_links`, `activities`, `comments`, `attachments`, `issue_templates`, `labels`, `components`

## Surface

- `GET|POST /api/projects/:projectId/issues` — list (paginated) / create
- `GET /api/projects/:projectId/issues/board` — kanban grouped by status, capped per column
- `GET|PATCH|DELETE /api/projects/:projectId/issues/:issueId`
- `PATCH /api/projects/:projectId/issues/:issueId/reorder` — drag-drop on board, body `{status, order}`
- `PATCH|POST /api/projects/:projectId/issues/bulk` / `bulk-delete`
- `GET /api/projects/:projectId/issues/:issueId/activities` / `/comments` / `/links` / `/spec-links`
- `GET /api/projects/:projectId/activities` — project-wide activity feed
- `GET /api/projects/:projectId/issues/dependencies` — flat list of `BLOCKS` links for graph rendering
- **Scheduler**: `0 0 3 * * *` (daily 03:00) — `ArchiveScheduler.archiveOldIssues`

## Timeline

### 2026-05-22 — Issue detail children list adapts to the parent's hierarchy level (PM-74)
**Changed.** `IssueSubtasks` (the children list rendered in `IssueDetailPanel` for every non-SUB_TASK issue) always said "Sub-tasks (N)" and always created a `SUB_TASK` from the inline `+ Add` button — regardless of whether the parent was a DOMAIN (Module), EPIC, or TASK. Opening an Epic that contained 9 TASK children showed them under the label "Sub-tasks (9)", which was wrong terminology and miscued the mental model.

Now the component takes a `parentType` prop and derives both the section heading and the created type from it: `DOMAIN → "Epics" + create EPIC`, `EPIC → "Tasks" + create TASK`, `TASK/BUG → "Sub-tasks" + create SUB_TASK` (unchanged). The inline input placeholder and Add-button text follow ("Task title", "+ Add task", etc.). `IssueDetailPanel` passes `parentType={issue.type}` on every render.

Tree expansion (each TASK row expanding to show its own SUB_TASK rows beneath) is deferred — Phase 1 ships a flat list at the right level. If PMs ask for the drill-down after using the panel, the existing Board-card expand pattern (`useQuery(['issue', id, 'children'])`) ports over cleanly.

- Source: `packages/web/src/features/issue/components/detail/IssueSubtasks.tsx` (new `parentType` prop + `deriveChildSpec` helper), `packages/web/src/features/issue/components/IssueDetailPanel.tsx` (pass `parentType={issue.type}`).

### 2026-05-22 — Delete module + unlink epic from module on Table of Content
**Added.** `TableOfContentPage` now exposes two missing destructive-ish actions PMs were asking for: a trash icon on every `ModuleCard` header to delete the module, and an `Unlink` icon on each `EpicRow` (visible on hover) to remove that epic from its current module. Both go through `confirmDialog()` so the user knows what happens before they click — module-delete shows the epic count and explicitly says they will be kept under "Unassigned Epics", and epic-unlink mentions the epic itself is not deleted, only re-parented to `null`.

The BE didn't need a new endpoint: `DELETE /projects/:projectId/issues/:issueId` already works on `DOMAIN` rows, and the Prisma schema declares `parent.onDelete: SetNull` for `Issue.parent`, so child Epics' `parentId` flips to `null` automatically when the parent Domain row is deleted — they fall straight into the existing Unassigned Epics section of the same page on next refetch. Epic-unlink reuses `bulkSetParent(projectId, [epicId], null)` which already powered the orphan-→-module flow in the reverse direction. Toast on success names how many epics moved so the user can verify the cascade visually.

- Source: `packages/web/src/pages/TableOfContentPage.tsx` (new `handleDeleteModule` / `handleRemoveEpicFromModule` use cases, new `Trash2` button on `ModuleCard` header, new hover-revealed `Unlink` button on `EpicRow`).

### 2026-05-21 — Public timeline endpoint + `ShareLink` model (PM-60 PR1)
**Added.** New module `packages/api/src/share-link/` exposes a Timeline view of any project under a passcode-gated public URL. The model `ShareLink` (table `share_links`, migration `20260521100415_add_share_link`) stores `token` (32 hex, unique), bcrypt-hashed `passcodeHash`, `scopes ShareScope[]` (Phase 1 only `TIMELINE`), optional `expiresAt`, and the brute-force counters (`failedAttempts`, `lockedUntil`). One Project can have many ShareLinks (PM creates one per external client), each `createdBy` a user — relations cascade on Project delete, restrict on User delete (auditing).

Clean-Architecture layout matches `IssueModule`: `domain/share-link.entity.ts` carries the lockout state machine (`canUnlock`, `recordFailure`) as pure functions; `application/ports/share-link.repository.ts` is the port; `infrastructure/share-link.prisma.repository.ts` is the Prisma impl; five use cases (`create`, `unlock`, `revoke`, `rotate-passcode`, `get-public-timeline`) sit between. The public read path goes through `IssueQueryService.findAll` (reused from internal Timeline) then maps every row through `toPublicTimelineIssue` — a hand-curated whitelist with `id`, `number`, `title`, `type`, `status`, `priority`, `startDate`, `dueDate`, `parentId`, `assignee: {name, avatar}` (**no email, no userId**) and `labels: {name, color}`. Description, comments, activities, attachments, reviewer, source, `_count` are dropped at the boundary — derived from `IssueQueryService` shapes is rejected so a new internal field doesn't silently become public.

Admin controller `share-link.controller.ts` (mounted at `/api/projects/:projectId/share-links`, behind `ProjectMemberGuard` + `RolesGuard(ADMIN, PM)`) handles create/list/revoke/rotate; hard-delete is `ADMIN` only. Public controller `share-link.public.controller.ts` (`/api/public/share/:token/*`, `@Public()` + `ShareAuthGuard` on reads, `@Throttle 5/min/IP` on unlock) re-fetches the link row on every read and re-checks revoke/expiry — a valid share JWT is necessary but not sufficient, so revoke takes effect immediately rather than waiting for JWT TTL.
- Source: `packages/api/prisma/schema.prisma`, `packages/api/prisma/migrations/20260521100415_add_share_link/`, `packages/api/src/share-link/**`, `packages/api/src/app.module.ts`.

### 2026-05-21 — `hasDueDate` filter on issue list query (PM-58)
**Added.** `QueryIssueDto.hasDueDate?: boolean` and the matching branch in `IssueQueryService.findAll`:
- `hasDueDate=false` → `where.dueDate: { equals: null }`
- `hasDueDate=true` → `where.dueDate: { not: null }`
- omitted → unconstrained (backward-compat)

Mutually exclusive with `dueDateFrom` / `dueDateTo` (range wins if somehow both arrive). Drives the new Calendar "Unscheduled" panel — the FE queries every active dueDate-less ticket once and narrows the status set client-side (no need to expand the DTO to multi-status just for this view; cap of 200 rows is comfortable).
- Source: `packages/api/src/issue/dto/query-issue.dto.ts`, `packages/api/src/issue/application/issue-query.service.ts`.

### 2026-05-21 — Dedupe symmetric RELATES_TO rows in Linked Issues panel (PM-57)
**Fixed.** Linking issue A → B with `RELATES_TO` showed the target B as **two identical rows** in the "Linked Issues" section of A's detail panel, and the counter read `(2)` for a single logical relationship. Clicking delete on one of the two rows removed both (data-correct, UX confusing — looked like "delete one, lose both"). Only `RELATES_TO` was affected; asymmetric pairs (`BLOCKS` / `IS_BLOCKED_BY`, `DUPLICATES` / `IS_DUPLICATED_BY`) rendered correctly under two distinct groups already.

Root cause: `IssueLinkService.create` (`packages/api/src/issue-link/issue-link.service.ts:71`) stores both directions of every link inside one transaction. For symmetric types, `REVERSE_TYPE[RELATES_TO] = RELATES_TO`, so both rows ended up with the same `(type, issueId-pair)`. `findByIssue` returned them as one row in `sourceLinks` and the mirrored one in `targetLinks`. The frontend `useLinkedIssuesDisplay` hook flipped the inbound row's type via `getInverseLinkType` (no-op for RELATES_TO) and then emitted both into the display list, hence the duplicate.

Fixed at the frontend dedupe layer per the bug ticket's Option A — minimal blast radius, no schema / API change. The hook now keeps a `Map<"${type}::${issueId}", display>` and ignores the second hit. Asymmetric types are unaffected because `getInverseLinkType` differentiates inbound (e.g. BLOCKS) from outbound (IS_BLOCKED_BY), so the composite key stays unique. Deletion still works via either linkId — the service deletes both directions atomically.
- Source: `packages/web/src/features/issue/hooks/useLinkedIssuesDisplay.ts`.

### 2026-05-21 — Add `DOMAIN` issue type + Table of Content view (PR1: BE, schema `20260521024422_add_domain_issue_type`)
**Added.** New top-level grouping above Epic. The 4-level tree is now `Domain → Epic → Task/Bug → Sub-task`. Driven by the *Table of Content* feature (plan: [`docs/plans/table-of-content-domain-level.md`](../plans/table-of-content-domain-level.md)) — projects had grown to 30+ flat Epics on the Board (Dhuman, PITB), and PMs were maintaining the module list in a Google Sheet. The enum is named `DOMAIN` in code/DB/API; the UI labels it "Module" so it doesn't collide with the "domain layer" in clean-architecture. **Hierarchy validation:** `EPIC_CANNOT_HAVE_PARENT` was replaced by `EPIC_PARENT_MUST_BE_DOMAIN` — an Epic without a parent is still valid (backward-compat), but an Epic with a non-`DOMAIN` parent now 400s. `DOMAIN_CANNOT_HAVE_PARENT` is the analogous top-level rule. **New endpoints:** `GET /api/projects/:projectId/issues/table-of-content` returns `{ domains: [{ id, title, epics: [{ id, title, status, taskCount, doneCount }] }], orphanEpics: [...] }`. `PATCH /api/projects/:projectId/issues/bulk-set-parent` (PM↑) batch-re-parents Epics under a Module — used by the upcoming Web bulk-assign UI. **No data backfill** — migration adds the enum value only; PMs assign Modules manually after the FE ships.
- Source: `packages/api/prisma/schema.prisma`, `packages/api/prisma/migrations/20260521024422_add_domain_issue_type/migration.sql`, `packages/api/src/issue/domain/issue-type.vo.ts`, `packages/api/src/issue/domain/issue.entity.ts`, `packages/api/src/issue/application/create-issue.use-case.ts`, `packages/api/src/issue/application/update-issue.use-case.ts`, `packages/api/src/issue/application/bulk-set-parent.use-case.ts`, `packages/api/src/issue/application/issue-query.service.ts`, `packages/api/src/issue/application/ports/issue.repository.ts`, `packages/api/src/issue/infrastructure/issue.prisma.repository.ts`, `packages/api/src/issue/issue.controller.ts`, `packages/api/src/issue/issue.module.ts`, `packages/api/src/issue/dto/bulk-set-parent.dto.ts`.

### 2026-05-20 — Move DueBadge to bottom row to unbreak IssueCard header (aa00790, PM-54)
**Fixed.** Card header on the Board had 5 chips fighting for space inside a 224px swimlane column: TypeIcon + KEY-NUMBER + `EpicChip` (`max-w-[120px]` truncate) + `SourceBadge` + `DueBadge` (`ml-auto`). When all three conditional chips were present (near-due deadline + Epic + non-WEB source — e.g. PM-52 with dueDate 5/22, Epic "Bugs", source MCP), the EpicChip got squeezed to "B..." and the header looked broken. Moved `DueBadge` out of the header into the bottom metadata-pill row, right after PRIORITY. Header now reads `🐛 PM-52 ⚡Bugs ✨MCP` with the Epic name in full; bottom row reads `MEDIUM D-1 Bug` with the due chip living next to its pill cousins.
- Source: `packages/web/src/features/issue/components/board/IssueCard.tsx`.

### 2026-05-20 — Swimlane column cap with Show more / Show less (e232adf, PM-49)
**Added.** Group-by-Epic Board mode capped each (epic × status) cell at 5 visible cards. Anything beyond renders a `Show N more` button that flips to `Show less` when expanded. Thu's complaint: epics with 15+ items in the Done column (or any long-tail status) stretched the swimlane into a wall — users had to scroll past one fat epic to reach the next. Now every column starts compact and only the cells the user explicitly opens grow. Row-local state (`expandedColumns: Set<string>` keyed by status) so each swimlane manages its own. Drag-and-drop indices stay correct because `SwimlaneBoardView.handleDragEnd` always operates on the full underlying list via `calculateDropOrder` — slicing only affects rendering, not order math.
- Source: `packages/web/src/features/issue/components/board/SwimlaneRow.tsx`.

### 2026-05-20 — `dueDateFrom` / `dueDateTo` query params + `[projectId, dueDate]` index (4942c75, PM-53, Schema: `20260520092215_add_issue_due_date_index`)
**Added.** `QueryIssueDto` accepts two new optional ISO-8601 timestamps. `IssueQueryService.findAll` composes them into a `where.dueDate.gte / lte` filter when either is present. Calendar uses these to fetch only the issues with deadlines in the visible month grid — fixing the silent data-loss path where `limit=200` (cap) would return the first 200 status-sorted rows and miss any deadlines beyond that. Backed by a new composite index `@@index([projectId, dueDate])` on `issues` so the range scan stays cheap on large projects. Migration is additive — safe to run on live tenants.
- Source: `packages/api/src/issue/dto/query-issue.dto.ts`, `packages/api/src/issue/application/issue-query.service.ts`, `packages/api/prisma/schema.prisma`.

### 2026-05-20 — IssueDetailHeader keeps action icons anchored right (d3ea14d)
**Fixed.** Header used `flex justify-between` with `<SourceBadge>` as the left child. When an issue had no non-WEB source (no MCP / Slack / Webhook tag), `SourceBadge` returned `null` and the flex container collapsed to a single child — `justify-between` falls back to flex-start, so the action icons (branch, copy link, expand, delete, close) slid to the left edge, above a left-aligned breadcrumb. Switched to `flex` + `ml-auto` on the icon group so the buttons stay on the right regardless of whether the SourceBadge renders.
- Source: `packages/web/src/features/issue/components/detail/IssueDetailHeader.tsx`.

### 2026-05-19 — Assignee picker becomes a searchable Combobox in CreateIssueModal (PM-42 follow-up)
**Changed.** Assignee select swapped from Radix `Select` to the same `Combobox` the Parent Issue field uses, so members are searchable by name **or email**. Each option still shows avatar + name + email; the `searchValue` concatenates both so typing the local-part of an email also matches.
- Source: `packages/web/src/features/issue/components/CreateIssueModal.tsx`.

### 2026-05-19 — CreateIssueModal: parent pre-fill from swimlane "+" + richer Assignee items (PM-42)
**Fixed.** Clicking "+" on a swimlane lane (e.g. the "Bugs" epic) now pre-fills Parent Issue with that epic instead of leaving it `None`. Threaded `parentId` through `SwimlaneRow → SwimlaneBoardView → BoardPage` (`onAddClick(status, parentId)`); `BoardPage.createModal` state moved from a bare status string to `{ status, parentId }` so the dialog can pre-select. Assignee items now render `UserAvatar` + name + email, so members with similar names are distinguishable. Wheel-scroll on the Assignee dropdown + the Parent Issue Combobox is unblocked by the shared overlay-portal change (see `ui-changelog.md`).
- Source: `packages/web/src/features/issue/components/CreateIssueModal.tsx`, `packages/web/src/features/issue/components/board/SwimlaneBoardView.tsx`, `packages/web/src/features/issue/components/board/SwimlaneRow.tsx`, `packages/web/src/features/issue/components/board/BoardColumn.tsx`, `packages/web/src/pages/BoardPage.tsx`.

### 2026-05-19 — Board columns pinned to 260px (PM-43 follow-up)
**Changed.** The previous `min-w-[240px] flex-1` left `flex-1` free to stretch columns whenever the viewport had room, so on wider screens each column ballooned to 350–400px and only 4 of the 7 statuses fit before the scrollbar kicked in. Pinned to `w-[260px] shrink-0` — columns now keep a stable width regardless of viewport, and a 1920px screen shows all 7 columns at once. Swimlane mode (already `w-56` / 224px) is unchanged.
- Source: `packages/web/src/features/issue/components/board/BoardColumn.tsx`.

### 2026-05-19 — Board columns tighter + drag-scroll cursor honest (PM-43)
**Changed.** Plain-board column min-width dropped from `300px` to `240px`, matching the swimlane column feel (`w-56`) so a 1440px screen now shows 5 columns instead of 4. Also removed `cursor-grab` from the board scroll container — the card surface is the @hello-pangea/dnd drag-handle, so a mouse drag picks up the card rather than scrolling the board; advertising "grab" was lying. Trackpad swipe and the scrollbar keep working. A real click-to-scroll behaviour would require a dedicated drag-handle column on each card — flagged on PM-43 for a follow-up if the team feels the loss.
- Source: `packages/web/src/features/issue/components/board/BoardColumn.tsx`, `packages/web/src/pages/BoardPage.tsx`.

### 2026-05-19 — Multi-field sort stack editor — ClickUp-style chip list (PM-41, Sort Phase 2)
**Added.** SortMenu's popover is now a chip list editor: every active sort rule renders as a row with its own direction toggle, `↑/↓` precedence buttons, and `×` remove. A `+ Add sort field` button opens an inline picker of unused fields (capped at 4 in the stack — past that, each extra rule barely adds any disambiguation). Trigger compactly shows the primary field + `+N` when more than one rule is stacked. URL codec and BE Prisma `orderBy` already accept the comma-separated stack from Phase 1, so this is a pure UI upgrade.

**Tweak (same day).** Empty state now renders the field list inline instead of an "Add sort field" placeholder, so a single-field sort is still a one-click choice (matching Phase 1 ergonomics). The chip editor + add-picker only appear once the stack is non-empty.
- Source: `packages/web/src/shared/ui/SortMenu.tsx` (full rewrite — Phase 1's single-select layout is gone).

### 2026-05-19 — Remove `isRecheck` toggle from IssueMetadata, RECHECK status is the source of truth (PM-39)
**Removed.** The IN_PROGRESS-only recheck flag toggle was redundant with the existing `RECHECK` status column on the Board and confused users into thinking an issue could be in two statuses at once (`In Progress` + `Recheck` chip). Took the toggle out entirely; the `isRecheck` column stays on the Issue model for now (no migration needed, no caller reads it on the FE after this change) but can be dropped in a follow-up cleanup if it isn't useful elsewhere.
- Source: `packages/web/src/features/issue/components/detail/IssueMetadata.tsx`.

### 2026-05-19 — Sort issues on Board / Lists / Timeline, ClickUp-style scaffold (PM-34, PM-35→38)
**Added.** All three views now expose a `<SortMenu>` next to the filter chips. Phase 1 ships single-field selection but the wire format is the multi-field stack that Phase 2 will expand to. URL is shared (`?sort=field:dir,…`) so column-header click on Lists and the menu pick on Board stay in sync, and refresh / share-link keeps the chosen sort.
- BE: `QueryIssueDto.sort` parses `field:dir,…` into a Prisma `orderBy` array (`nulls: 'last'` for date fields). Legacy `sortBy`/`sortOrder` kept as fallback. Board endpoint (`findByStatus`) also accepts `sort` so each column orders consistently. Enum order relies on the Postgres declaration order — `priority desc` puts HIGH first, `status asc` follows the workflow (no custom collator).
- FE state: new `FilterState.sortStack: SortRule[]` + filter-codec serialize/deserialize. `hasActiveFilters` intentionally ignores sort — it's a view setting, not a filter.
- UI: `packages/web/src/shared/ui/SortMenu.tsx` (single-select with direction toggle + "Reset to manual" footer). Wired into `BoardToolbar`, `IssuesToolbar` (column-header click migrated to write the same `sort=field:dir` URL via `useIssueListUrlState`), and `TimelineHeader` (restricted field list).
- Board manual-mode guard: when `sortStack` is non-empty the page shows an amber banner and `handleDragEnd` short-circuits, so a drag can't overwrite `Issue.order` while the server-side sort owns the column.
- Source: `packages/api/src/issue/dto/query-issue.dto.ts`, `packages/api/src/issue/application/issue-query.service.ts`, `packages/api/src/issue/issue.controller.ts`, `packages/web/src/shared/ui/filterState.ts`, `packages/web/src/shared/lib/filter-codec.ts`, `packages/web/src/shared/ui/SortMenu.tsx`, `packages/web/src/features/issue/api.ts`, `packages/web/src/features/issue/repository.ts`, `packages/web/src/features/issue/hooks/useBoardData.ts`, `packages/web/src/features/issue/hooks/useIssueListUrlState.ts`, `packages/web/src/features/issue/lib/issueClientFilter.ts`, `packages/web/src/features/issue/components/board/BoardToolbar.tsx`, `packages/web/src/features/issue/components/list/IssuesToolbar.tsx`, `packages/web/src/features/timeline/components/TimelineHeader.tsx`, `packages/web/src/pages/BoardPage.tsx`.

### 2026-05-19 — Delete label from Settings (with "in use" guard) (PM-33)
**Added.** Project Settings → Labels now has a small `×` button on every chip. Clicking confirms via dialog when the label is unused; when it has issues attached it short-circuits to a toast (`"Bug" is used by 5 issue(s). Remove it from those issues first.`) instead of cascading the delete. The FK was `ON DELETE CASCADE`, so without the guard a stray click would have silently stripped the label from every issue and orphaned the activity log.
- BE: `LabelService.remove` includes `_count.issues` and throws `ConflictException` (409) when in use.
- FE: `Label` type carries `_count?.issues`; `projectRepository.removeLabel` + `useProjectLabels.remove` mutation invalidates `['labels']` + `['board']`.
- UI: hover tooltip shows usage count (`"In use by N issue(s)"` / `"Unused — safe to delete"`).
- Source: `packages/api/src/label/label.service.ts`, `packages/web/src/features/project/api.ts`, `packages/web/src/features/project/repository.ts`, `packages/web/src/features/project/hooks/useProjectLabels.ts`, `packages/web/src/features/project/components/settings/LabelsSection.tsx`, `packages/web/src/pages/SettingsPage.tsx`.

### 2026-05-19 — Comment + activity avatars use real image instead of initial-only (PM-32)
**Fixed.** `ActivityTimeline` was rendering its own initials-only `UserAvatar` and a raw `<div>` for the main-row avatar; `CommentItem` had the same pattern. All three call sites now use the shared `@/entities/user/UserAvatar` component (image when present, initials fallback when not). Resolver split in `ActivityTimeline`: `resolveUser` returns `{ name, avatar }`, `resolveUserName` keeps the existing string-only callers happy.
- Source: `packages/web/src/features/issue/components/activity/ActivityTimeline.tsx`, `packages/web/src/features/issue/components/comment/CommentItem.tsx`.

### 2026-05-19 — Filter issues by source on Board / Lists / Timeline (PM-31)
**Added.** Filters panel + dropdown row now have a **Source** section (WEB / MCP / SLACK / WEBHOOK / API / SYSTEM), so a PM can isolate "everything an agent created" without scrolling. Single-value selection is pushed to the server (`GET /api/projects/:projectId/issues?source=MCP`); multi-value falls back to the client filter, same pattern as Status/Priority/Type.
- New: `source: Set<string>` on `FilterState` + URL codec param (shared across Board/Lists/Timeline, sync via `useFilterSearchParams`).
- New: `Source` section in `FiltersPopover` (Board) using the existing `SourceBadge` chip for visual consistency; matching `Source` dropdown in `DropdownFilters` (Lists/Timeline).
- BE: `QueryIssueDto.source` (`@IsIn(ISSUE_SOURCES)`) + Prisma `where: { source }` in `IssueQueryService.findAll`.
- Wired through: `BoardToolbar` / `IssuesToolbar` / `TimelineHeader` (`setFilters({ source })`), `issueClientFilter.applyClientFilters` + `buildListParams`, `boardFilter.matchesFilters`.
- Source: `packages/web/src/shared/ui/filterState.ts`, `packages/web/src/shared/lib/filter-codec.ts`, `packages/web/src/shared/ui/FilterBar.tsx`, `packages/web/src/features/issue/lib/issueClientFilter.ts`, `packages/web/src/features/issue/lib/boardFilter.ts`, `packages/web/src/features/issue/components/board/BoardToolbar.tsx`, `packages/web/src/features/issue/components/list/IssuesToolbar.tsx`, `packages/web/src/features/timeline/components/TimelineHeader.tsx`, `packages/api/src/issue/dto/query-issue.dto.ts`, `packages/api/src/issue/application/issue-query.service.ts`.

### 2026-05-19 — Activity log resolves parentId UUID → `#number title` (PM-30, bcb2296)
**Fixed.** Activity entries for parent changes used to render a raw UUID truncated to 8 chars (e.g. `9b090110…`), so users couldn't tell which epic an issue moved under without clicking through. `ActivityTimeline` now scans `parentId`-field activities, collects unique parent UUIDs from `oldValue`/`newValue`, batch-fetches them via `useQueries` (react-query, `staleTime: 60s`, cache reused across panels), and renders `{TYPE_ICON} #{number} {title}`. Falls back to the UUID prefix while in-flight or on fetch failure. `projectId` is threaded from `ActivityTab` down (new optional prop).
- Source: `packages/web/src/features/issue/components/activity/ActivityTimeline.tsx`, `packages/web/src/features/issue/components/ActivityTab.tsx`.

### 2026-05-19 — Source badge moved to header top-left (PM-28 follow-up)
**Changed.** Reviewer feedback: badge crowded the title. Action-button row flipped to `justify-between` and the `SourceBadge` now lives in the previously-empty top-left slot, mirroring the icon-button group on the right. Same hide-for-`WEB` behaviour.
- Source: `packages/web/src/features/issue/components/detail/IssueDetailHeader.tsx`.

### 2026-05-19 — Source badge on IssueDetailHeader (PM-28, a21624e)
**Added.** `IssueDetailHeader` now renders the existing `SourceBadge` so an agent-created (MCP) / Slack / API issue is visible at a glance without scrolling to the activity log. Badge hides itself for the `WEB` default to keep noise down. Reuses the same primitive used by `IssueCard`, `ActivityTimeline`, and `CommentItem` — visual consistency, no new styles.
- Source: `packages/web/src/features/issue/components/detail/IssueDetailHeader.tsx`.

### 2026-05-13 — `notifyAssignment` resolves actor name for Slack DM
**Changed.** `IssueService.notifyAssignment` is now `async` and fetches the actor's display name (single `users.findUnique` on `actorId`) before calling `NotificationService.create`. The name is forwarded via `meta.actorName` so the new Slack DM (see [`notification-changelog.md`](./notification-changelog.md)) reads "Assigned by Alice" instead of a UUID. Failures fall through silently — the in-app notification path is unaffected.

- Source: `packages/api/src/issue/issue.service.ts` `notifyAssignment` (now `private async`).

### 2026-05-12 — Hide CANCELED issues by default across views (d2f3ed0)
**Changed.** Timeline, Board, and Lists pages now filter out `CANCELED` issues unless the user explicitly toggles "Include canceled". Reduces noise on projects with high cancellation rates.
- Source: `packages/web/src/pages/TimelinePage.tsx`, `BoardPage.tsx`, `IssuesPage.tsx`.

### 2026-05-11 — `Issue.startDate` for planned start (10c6920, Schema: `20260511135935_add_issue_start_date`)
**Added + Schema.** New nullable `start_date` column on `issues`. Tracked in `TRACKED_FIELDS` so changes generate an `Activity` row. Surfaced on the Timeline view's left ruler (planned vs actual).
- Migration: `20260511135935_add_issue_start_date`.
- Source: `packages/api/src/issue/issue.service.ts:46`, `packages/api/prisma/schema.prisma:142`.

### 2026-05-04 — Raise board column issue limit to 200 (6cd03e0)
**Changed.** `ISSUE_MAX_PER_COLUMN` raised from 50 to 200 in `common/constants.ts`. Long BACKLOG columns were truncated. Increased ceiling because the per-column query is indexed and cheap.
- Source: `packages/api/src/common/constants.ts`.

### 2026-05-04 — Include archived sub-tasks in board response (5762acd)
**Fixed.** Board rendering inlines SUB_TASKs on their parent's card. When a sub-task was archived (after 3 days `DONE`), the parent's child count went stale and the inline list dropped a row. The board query now explicitly includes archived SUB_TASKs even when `includeArchived=false`.
- Source: `packages/api/src/issue/issue.service.ts:315` (`findByStatus`).

### 2026-05-04 — Parent type-aware label/icon for SUB_TASK (a994751)
**Fixed.** A sub-task whose parent was an EPIC was showing the wrong icon/label combination in the breadcrumb. Now `parent.type` drives both icon and label.
- Source: `packages/web/src/components/issue/IssueBreadcrumb.tsx`.

### 2026-05-05 — Detail panel polish: full ancestor breadcrumb (d2ca8cb, 1805027, d679e2f)
**Fixed.** Three sequential fixes to the detail panel breadcrumb:
- `d2ca8cb`: show full ancestor chain (`EPIC › TASK › SUB_TASK`) with the right icons.
- `1805027`: truncate long titles at 60 char with ellipsis + native `title` tooltip.
- `d679e2f`: move the `BBPM-123` number inline with the title rather than on a separate line.
- Source: `packages/web/src/components/issue/IssueDetailPanel.tsx`.

### 2026-04-23 — Cmd+N global shortcut for quick issue creation (0d3667f)
**Added.** Web-side keyboard shortcut: `Cmd+N` (macOS) / `Ctrl+N` opens the quick-issue capture modal from any page. Submits via `POST /api/quick-issue/create` after rule-parser + LLM enrichment.
- Source: `packages/web/src/hooks/useKeyboardShortcuts.ts`, `packages/web/src/hooks/useRegisterShortcuts.ts`. See also [`standup-changelog.md`](./standup-changelog.md) for the Slack-DM variant.

### 2026-04-23 — Activity-log readability (5b45088)
**Fixed.** `Activity.field` is a `VARCHAR(50)` slug (e.g., `status`, `assigneeId`, `github_pr_linked`). The UI was rendering them verbatim. Added a human-readable label map: `status → "Status"`, `assigneeId → "Assignee"`, `github_pr_linked → "PR linked"`, etc.
- Source: `packages/web/src/components/activity/ActivityFeed.tsx`.

### 2026-04-23 — Show assignee avatar in issues list + tree view (7891aa0)
**Fixed.** Lists view was rendering only the assignee name; the board card already had the avatar. Aligned both surfaces.
- Source: `packages/web/src/pages/IssuesPage.tsx`, `packages/web/src/components/issue/`.

### 2026-04-23 — Hide sub-task creation UI when issue is itself a SUB_TASK (27fb0c2)
**Fixed.** A SUB_TASK cannot itself have children — enforced server-side in `validateHierarchy`, but the UI was still showing the "+ Sub-task" button on SUB_TASK detail panels.
- Source: `packages/web/src/components/issue/IssueDetailPanel.tsx`.

### 2026-04-21 — Reviewer assignee field (09d6d20, Schema: `20260423052600_add_reviewer_assignee_to_issues`)
**Added + Schema.** New nullable `reviewer_assignee_id` on `issues` plus the corresponding User relation `ReviewerIssues`. UX use case: track who reviews a PR / QA-checks a task separately from who implements it. Tracked in `TRACKED_FIELDS`.
- Migration: `20260423052600_add_reviewer_assignee_to_issues`.
- Source: `packages/api/prisma/schema.prisma:156`.

### 2026-04-21 — Add issue create button to epic swimlane view (ec96fb9)
**Fixed.** Board's epic-swimlane variant was missing the "+ Issue" button at the bottom of each swimlane.
- Source: `packages/web/src/pages/BoardPage.tsx`.

### 2026-04-20 — Default board view: epic swimlane (ac9db46)
**Changed.** Board page now defaults to the epic-swimlane variant (one swimlane per EPIC, kanban columns within) rather than the flat kanban. The flat view is still available via toggle.
- Source: `packages/web/src/pages/BoardPage.tsx`.

### 2026-04-17 — Auto-set `isRecheck` on backflow to IN_PROGRESS (18ddfc6)
**Changed.** When an issue moves from `REVIEW_QA | DONE | CANCELED` back to `IN_PROGRESS` (either via PATCH or board drag), `isRecheck` is auto-set to `true`. Reset to `false` when leaving `IN_PROGRESS`. Surfaces as a "🔁 Recheck" badge on the board card.
- Source: `packages/api/src/issue/issue.service.ts:503` (in `update`), `:617` (in `reorder`).

### 2026-04-17 — Replace `RECHECK` status with `isRecheck` decorator (89baba1, Schema: `20260417113700_remove_recheck_add_is_recheck`)
**Removed + Schema.** Previous design had `RECHECK` as a distinct `IssueStatus`. That broke the linear status flow because RECHECK was a *modifier* on IN_PROGRESS, not a separate stage. Refactored: drop `RECHECK` from the enum, add a boolean `is_recheck` column on `issues`. Status flow now stays clean (BACKLOG → TODO → IN_PROGRESS → REVIEW_QA → DONE/CANCELED).
- Migration: `20260417113700_remove_recheck_add_is_recheck`.
- Source: `packages/api/prisma/schema.prisma:145`.

### 2026-04-17 — Auto-archive DONE/CANCELED after 3 days (08b0d42, Schema: `20260417093739_add_issue_archived_at`)
**Added + Schema.** Daily 03:00 cron sets `archived_at = now()` on issues with `status IN ('DONE','CANCELED')` and `updated_at < now-3d`. Archived issues are hidden from board/lists by default (`includeArchived=false`). When the issue is later moved out of a terminal status, `archived_at` is auto-cleared.
- Migration: `20260417093739_add_issue_archived_at` — adds `archived_at TIMESTAMP NULL`, indexes `(status, archived_at)`.
- Source: `packages/api/src/issue/archive.scheduler.ts`, `packages/api/src/issue/issue.service.ts:494` (clear on un-archive).

### 2026-04-08 — `focusDate` (Schema: `20260408034207_add_issue_focus_date`)
**Schema.** Nullable `focus_date @db.Date` (UTC midnight). Per-user "I want to work on this today" flag. Used by the dashboard's "Today's Focus" widget and the standup DM's issue-list block (🎯 prefix on focused items).
- Migration: `20260408034207_add_issue_focus_date`.
- Source: `packages/api/src/issue/issue.service.ts:46`, `packages/api/src/standup/standup.service.ts:967` (`sendIssueListBlock`).

### 2026-04-07 — Notification model (Schema: `20260407125832_add_notification`)
**Schema.** `notifications` table — `(userId, isRead, createdAt)` index. Created from `IssueService` on assignee change (and from comment mentions in a later pass). See [`notification-changelog.md`](./notification-changelog.md).
- Migration: `20260407125832_add_notification`.

### 2026-04-07 — Components + assignee defaulting (Schema: `20260407142217_add_components`)
**Schema + Added.** `components` table + `issue_components` join. A component has an optional `lead` and `default_assignee` user. On issue create, if no assignee is specified and one of the selected components has a `default_assignee`, that user is auto-assigned. Resolves the "who should pick this up" question for area-of-code-based assignment.
- Migration: `20260407142217_add_components`.
- Source: `packages/api/src/issue/issue.service.ts:194`.

### 2026-04-07 — Issue links (Schema: `20260407141904_add_issue_links`)
**Schema + Added.** Inter-issue relationships via `issue_links` table. `IssueLinkType` enum: `BLOCKS`, `IS_BLOCKED_BY`, `RELATES_TO`, `DUPLICATES`, `IS_DUPLICATED_BY`. Unique `(source, target, type)`. Detail panel surfaces both `sourceLinks` and `targetLinks` with the project key prefix.
- Migration: `20260407141904_add_issue_links`.
- Source: `packages/api/src/issue-link/issue-link.service.ts`.

### 2026-04-07 — Issue templates (Schema: `20260407104939_add_issue_template`)
**Schema + Added.** Per-user reusable templates (`issue_templates` table). Apply a template at create time to pre-fill `title`, `description`, `type`. Owned by the creator.
- Migration: `20260407104939_add_issue_template`.

### 2026-04-07 — Attachments (Schema: `20260407060000_add_attachment`)
**Schema.** `attachments` table — can attach to either an `issue` (`issueId`) or a `comment` (`commentId`). Owner is `uploader`. See [`upload-changelog.md`](./upload-changelog.md).

### 2026-04-06 — Due-date column (Schema: `20260406150145_add_issue_due_date`)
**Schema.** Nullable `due_date` on `issues`. Used by overdue indicator (`due_date < now() AND status NOT IN DONE/CANCELED`) on board cards and dashboard.
- Migration: `20260406150145_add_issue_due_date`.

### 2026-04-06 — Comment model + SET NULL on user delete (Schema: `20260406133905_add_comment_model`, `20260406134814_comment_user_set_null`)
**Schema.** `comments` table. `user_id` is `ON DELETE SET NULL` so deleted users don't take their comments with them — the comment shows "(deleted user)" but the thread survives.
- Migrations: `20260406133905_add_comment_model`, `20260406134814_comment_user_set_null`.

### 2026-04-06 — Initial issue model (init commit, Schema: `20260406080645_init`)
**Added.** `issues` table with `(projectId, number)` unique, status/priority/type/order, parent/children self-relation, assignee/creator/reviewer FKs. `IssueStatus` enum, `IssuePriority`, `IssueType`. `ORDER_GAP = 1000` for fractional ordering on the board. Hierarchy rules enforced in `validateHierarchy`: EPIC has no parent, SUB_TASK must have a parent, parent cannot be SUB_TASK, cycles forbidden. `TRACKED_FIELDS` defines which mutations generate `Activity` rows.
- Migration: `20260406080645_init`.
- Source: `packages/api/src/issue/issue.service.ts`.

## Open questions / known issues

- **R5 — `Issue.number` allocation races.** Two simultaneous creates can both compute `MAX(number)+1` and one will hit the unique-constraint violation. No `pg_advisory_xact_lock` today. Rare in practice; logged as R5 in [`docs/ARCHITECTURE.md` §13](../ARCHITECTURE.md#13-risk-register).
- **No issue-level permission gates.** Any project member can mutate any issue. ADMIN-only operations are not yet defined for issues.
- **Activity-log `field` is a free-string slug, not an enum.** Adding a new event type costs nothing but harms searchability. Logged as P7 in `docs/ARCHITECTURE.md` §2.
- **Fire-and-forget notify paths** (`.catch(() => {})` after `notificationService.create`). Failures swallow silently. Logged as P2 / R9.
