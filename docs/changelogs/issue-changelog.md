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
