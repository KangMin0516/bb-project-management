# Stage 2: Implementation Report

- **Plan file**: [`docs/plans/table-of-content-domain-level.md`](../../docs/plans/table-of-content-domain-level.md) — "Table of Content — bổ sung cấp **Domain** trên Epic" (PR1: API/DB/MCP-surface; PR2: Web)
- **Branch**: `main` (working tree, uncommitted per user instruction)
- **Files changed**: 13 API + 14 Web + 5 docs + 1 migration
- **Migration**: yes (`20260521024422_add_domain_issue_type`)

> ⚠️ **Note on stage-1 artifact**: `.claude/outputs/stage-1-plan.md` on disk is stale from a previous session. The canonical plan lives at [`docs/plans/table-of-content-domain-level.md`](../../docs/plans/table-of-content-domain-level.md).

---

## PR1 — API / DB / MCP-facing surface

### Files modified

**Domain + validation**
- `packages/api/src/issue/domain/issue-type.vo.ts` — `ISSUE_TYPES` now includes `'DOMAIN'`; `HierarchyError` swapped `EPIC_CANNOT_HAVE_PARENT` for `DOMAIN_CANNOT_HAVE_PARENT` + `EPIC_PARENT_MUST_BE_DOMAIN`; `validateTypeWithParent` enforces the 4-level rule.
- `packages/api/src/issue/domain/issue.entity.ts` — `hierarchyMessage` switch updated.

**Use cases / ports / repository**
- `packages/api/src/issue/application/create-issue.use-case.ts` — `parentType` union extended to include `'DOMAIN'`; local `hierarchyMessage` updated.
- `packages/api/src/issue/application/update-issue.use-case.ts` — local `hierarchyMessage` updated.
- `packages/api/src/issue/application/ports/issue.repository.ts` — `IssueTypeLiteral` adds `'DOMAIN'`; new `BulkParentTargetRow` type + three new port methods.
- `packages/api/src/issue/application/issue-query.service.ts` — `findTableOfContent(projectId)` reads `DOMAIN`+`EPIC` rows and aggregates child counts.
- `packages/api/src/issue/infrastructure/issue.prisma.repository.ts` — implements the three new port methods; `fetchParentType` return type widened.
- `packages/api/src/issue/issue.controller.ts` — `GET /issues/table-of-content` (member) and `PATCH /issues/bulk-set-parent` (PM↑) endpoints.
- `packages/api/src/issue/issue.module.ts` — registered `BulkSetParentUseCase`; exported `IssueQueryService` + `BulkSetParentUseCase`.

**External (MCP-facing)**
- `packages/api/src/external/external.service.ts` — `getTableOfContent` + `bulkSetEpicModule` methods.
- `packages/api/src/external/external.controller.ts` — `GET /external/projects/:projectKey/table-of-content` + `PATCH /external/projects/:projectKey/issues/bulk-set-module`.

**Schema + migration**
- `packages/api/prisma/schema.prisma` — `IssueType` enum gained `DOMAIN`.
- `packages/api/prisma/migrations/20260521024422_add_domain_issue_type/migration.sql` — single `ALTER TYPE "IssueType" ADD VALUE 'DOMAIN';`.

**Tests**
- `packages/api/src/issue/domain/issue.entity.spec.ts` — DOMAIN top-level + Epic-under-Domain + Epic-without-parent cases.
- `packages/api/src/issue/application/create-issue.use-case.spec.ts` — renamed old case, added DOMAIN-with-parent + Epic-under-Domain.
- `packages/api/src/external/external.service.spec.ts` — extended stub-constructor arg list (pre-existing-broken at 6/8; now 10/10).

### Files created

- `packages/api/src/issue/application/bulk-set-parent.use-case.ts` — validates inputs (Epic-only, DOMAIN parent in same project), delegates to repo.
- `packages/api/src/issue/application/bulk-set-parent.use-case.spec.ts` — 8 unit tests.
- `packages/api/src/issue/dto/bulk-set-parent.dto.ts` — `BulkSetParentDto`.

---

## PR2 — Web

### Files modified

**Foundations**
- `packages/web/src/features/issue/api.ts` — `TableOfContent` + `TableOfContentDomain` + `TableOfContentEpic` types; `issueApi.tableOfContent` + `issueApi.bulkSetParent`.
- `packages/web/src/features/issue/repository.ts` — `findTableOfContent` + `bulkSetParent` exports.
- `packages/web/src/shared/config/constants.ts` — `TYPE_ICONS.DOMAIN = '📁'`; new `TYPE_LABELS` map ("Module" label for `DOMAIN`).
- `packages/web/src/shared/ui/filterState.ts` — `FilterState.domainId` + `INITIAL_FILTER.domainId` + `hasActiveFilters` update.
- `packages/web/src/shared/lib/filter-codec.ts` — `?domain=<uuid>` URL param.

**Sidebar + route**
- `packages/web/src/widgets/AppLayout/AppLayout.tsx` — "Table of Content" item with `ListTree` icon, between Specs and Board.
- `packages/web/src/app/router/index.tsx` — lazy import + route at `/projects/:projectId/table-of-content`.

**Page + create flow**
- `packages/web/src/pages/TableOfContentPage.tsx` — Module → Epic outline, counts + progress bars, "Add Module" + "Add Epic" + Unassigned Epics inline-move dropdown, empty state.
- `packages/web/src/features/issue/components/CreateIssueModal.tsx` — `defaultType` prop; `DOMAIN` option in type select; conditional Parent field (DOMAIN → none; EPIC → Module combobox; TASK/BUG → Epic combobox; SUB_TASK → non-SUB_TASK/non-DOMAIN).

**Board filter**
- `packages/web/src/pages/BoardPage.tsx` — TOC query for module list; wires `boardModules` + `domainFilter` to toolbar / swimlane view.
- `packages/web/src/features/issue/components/board/BoardToolbar.tsx` — inline `Module:` Select chip (only shows when modules exist).
- `packages/web/src/features/issue/components/board/SwimlaneBoardView.tsx` — `domainFilter` prop; swimlanes filtered by `epic.parentId === domainFilter`.

**Bulk-assign**
- `packages/web/src/features/issue/components/BulkActionBar.tsx` — `selectedTypes` prop; "Module" dropdown (enabled only when all selected are EPIC); TOC query for module list; mutation calls `bulkSetParent`.
- `packages/web/src/pages/IssuesPage.tsx` — passes `selectedTypes` derived from `displayItems` filtered by `selection.selectedIds`.

### Files created

- `packages/web/src/pages/TableOfContentPage.tsx`.

### Skipped from plan (deferred)

- **`IssueCard` Module badge** (§5 row #6): rendering the parent Module label on Task/Bug cards. Would require plumbing a `epicId → moduleName` map through `BoardColumn` / `SwimlaneRow` / `IssueCard`. The TOC page + IssueDetailPanel breadcrumb already cover the navigation need; low ROI for the delta size. Tracked in deferred suggestions.

### Breadcrumb on issue detail

No code change needed — `IssueDetailHeader.tsx:192` already renders `parent.parent → parent`, and the backend `findOne` selects the grandparent. A Task under Epic under Module shows `📁 #N Module / ⚡ #N Epic / ✅ #N Task` automatically.

---

## Docs

- `docs/PRD.md` — Issue hierarchy block (§4.2) shows the 4-level tree.
- `docs/changelogs/issue-changelog.md` — new top entry (2026-05-21, PR1 BE).
- `docs/changelogs/external-api-changelog.md` — new top entry (2026-05-21, PR1 BE).
- `docs/changelogs/mcp-changelog.md` — new top entry (2026-05-21, PR1 BE).
- `docs/changelogs/ui-changelog.md` — new top entry (2026-05-21, PR2 Web).
- `docs/plans/table-of-content-domain-level.md` — status "🟢 In Progress" (both PRs done locally).

---

## Verified

### PR1 (API)
- `pnpm --filter @bb-pm/api exec prisma migrate dev --name add_domain_issue_type` → migration applied; client regenerated with `DOMAIN: 'DOMAIN'` in `generated/prisma/enums.ts`.
- `pnpm --filter @bb-pm/api test` → 26/26 suites, 201/201 tests pass (13 new).
- `pnpm --filter @bb-pm/api build` → `nest build` succeeds.
- `pnpm --filter @bb-pm/api exec tsc --noEmit -p tsconfig.json` → only pre-existing errors.

### PR2 (Web)
- `pnpm --filter @bb-pm/web exec tsc -b --noEmit` → **clean, 0 errors**.
- `pnpm --filter @bb-pm/web build` → vite build succeeds, all chunks emitted.
- `pnpm --filter @bb-pm/web lint` → **clean, 0 errors / 0 warnings** (one warning surfaced during dev and was fixed: `domains` wrapped in `useMemo` in `TableOfContentPage.tsx`).
- `curl -s -X GET 'http://localhost:3002/api/projects/<uuid>/issues/table-of-content'` → returns `401` (route is registered; needs auth). The new TOC endpoint is live on the running dev API.
- Dev servers running: Vite on `:5173`, NestJS on `:3002`.

---

## Not verified

- **Browser smoke** (clicking through TOC page, Create Module modal, Board Module filter, Bulk-assign Module). The dev servers are up and the user has a Chrome tab on `:5173` — best done manually since I don't have valid login credentials and the user is already iterating live.
- **DI smoke E2E** (`pnpm --filter @bb-pm/api test:e2e`) — not run; `app.e2e-spec.ts` failure is pre-existing scaffold cruft per `CLAUDE.md` §9.
- **MCP server tool exposure** — `bbpm-internal-mcp` npm package needs a separate PR to add `DOMAIN` to `create_issue` / `update_issue` / `list_issues` schemas and register `get_project_table_of_content` + `bulk_set_epic_module` tools. The API routes are live.

---

## Pre-existing (untouched)

- `external.service.spec.ts:23` constructor stub count was 6-of-8 pre-existing; my change made it 6-of-10. I bumped to 10/10 — the gap is now zero again.
- `create-issue.use-case.spec.ts` constructor calls (11 sites) pass 1-of-2 args (notifications missing). Pre-existing.
- `update-issue.use-case.ts:37` unused `TrackedField` + `:322` `[object Object]` stringification. Pre-existing.

---

## Deferred suggestions

1. **`IssueCard` Module badge.** Render the parent Module name as a small chip on Task/Bug cards (next to the Epic badge). Needs a `Map<epicId, moduleName>` plumbed through `BoardColumn` / `SwimlaneRow` / `IssueCard`. Low ROI given TOC + breadcrumb already exist.
2. **`bbpm-internal-mcp` schema PR.** Add `DOMAIN` to the type enums on `create_issue` / `update_issue` / `list_issues`; register `get_project_table_of_content` and `bulk_set_epic_module` tools.
3. **Domain-level dashboard / burndown aggregation.** Module-level progress/burndown view (out of scope per plan §7).
4. **Drag-and-drop Epic between Modules on the TOC page.** Currently the only re-parent path is the Unassigned-Epics dropdown + bulk-assign on Issues page. DnD on TOC would be nicer UX (plan §7 out-of-scope).
5. **Bulk-`source = 'BULK'` activity coalescing.** Each Epic moved by `bulk-set-parent` emits its own activity row. Plan §3 step 7 floated a `BULK` source; today every row uses the caller's `source` (typically `WEB`).
6. **DTO lint debt.** `BulkSetParentDto`'s `@ValidateIf((o) => o.parentId !== null)` triggers `@typescript-eslint/no-unsafe-member-access` (same pattern as `BulkUpdateIssueDto`). Project-wide refactor would clear all such call sites.
7. **Pre-existing test/lint cleanup.** `@jest/globals` type-resolution + `create-issue.use-case.spec.ts` constructor calls are pre-existing across the API and outside this feature's blast radius. A `chore/api-test-types` PR would clean these up.

---

**Next step**: → `/3-review` (or commit PR1 + PR2 when ready; nothing has been committed per user's earlier instruction).
