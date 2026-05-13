# Frontend Refactor Changelog — May 2026

> History of the `packages/web` re-architecture that moved the SPA from a flat type-grouped structure to a 6-layer Feature-Based architecture, split every god component, and introduced the Repository pattern.

> Companion PR: [#57 refactor(web): full frontend re-architecture](https://github.com/seo-burning/bb-project-management/pull/57)
> Branch: `refactor/web-architecture`

---

## Headline numbers

| Metric                  | Before                 | After                   |
|-------------------------|------------------------|-------------------------|
| Top-level folder shape  | flat (`api`, `components`, `hooks`, `lib`, `pages`, `stores`) | 6 layers (`app`, `pages`, `widgets`, `features`, `entities`, `shared`) |
| Layer enforcement       | none                   | `eslint-plugin-boundaries` v6 (0 violations) |
| Largest component       | 1030 LOC (IssueDetailPanel) | 228 LOC (BoardPage) |
| Largest page            | 736 LOC (StandupSettings)   | 228 LOC (BoardPage) |
| Components > 500 LOC    | 5                       | 0 |
| Direct `xxxApi.` usages | 50+ files               | 0 outside repo/api files |
| Custom hooks            | ~5                      | ~38 |
| Sub-components          | inline in pages         | 60+ extracted |
| TypeScript errors       | 0                       | 0 |
| `vite build` time       | (n/a)                   | ~280 ms |
| Bundle (gzip, main)     | (n/a)                   | 89 KB |

---

## Per-page LOC reduction

| Page / Component        | Before | After | Reduction |
|-------------------------|-------:|------:|----------:|
| IssueDetailPanel        | 1030   | 184   | **−82 %** |
| StandupSettingsPage     | 736    | 101   | **−86 %** |
| TimelinePage            | 729    | 170   | −77 %     |
| SettingsPage            | 670    | 116   | −83 %     |
| ApiDocsPage             | 592    | 178   | −70 %     |
| IssuesPage              | 566    | 169   | −70 %     |
| LinkedIssues            | 552    | 29    | **−95 %** |
| SpecificationsPage      | 533    | 220   | −59 %     |
| BoardPage               | 512    | 228   | −55 %     |
| DashboardPage           | 453    | 159   | −65 %     |
| GlobalDashboardPage     | 371    | 163   | −56 %     |
| AdminPage               | 360    | 108   | −70 %     |
| TeamDashboardPage       | 347    | 117   | −66 %     |
| MemberTasksPage         | 314    | 80    | −75 %     |
| ProfilePage             | 166    | 23    | **−86 %** |
| ProjectsPage            | 170    | 88    | −48 %     |
| TeamIssuesPage          | 189    | 139   | −26 %     |

---

## Timeline

### 2026-05-13 — Repository consumer migration + Settings 404 fix (`edb4b3c` → `6ef266c`)
**Changed.** Migrated all 33 remaining consumers that imported `xxxApi` directly to use the `xxxRepository` wrapper. Audit confirms zero direct `xxxApi.` references outside the `api.ts` / `repository.ts` module pair.
**Fixed (introduced bug).** The bulk-rename script over-removed import lines when their named items contained a mix of mapped names + orphan names. 9 files left with body references to `issueRepository` but no import → runtime "issueRepository is not defined". Restored.
**Fixed (pre-existing bug, surfaced by E2E).** `pages/SettingsPage.tsx` was passing the URL `:projectId` param (which is the project KEY, e.g. `"PITB"`) to project mutations. The backend's `project.service.update` only accepts UUIDs (its `findOne` accepts either). PATCH `/projects/PITB` returned 404. Fix: resolve the canonical UUID from the loaded `project.id` and pass that to `useProjectMembers / useProjectLabels / useProjectComponents / useJoinRequests / useProjectMutations`.
- Source: `pages/SettingsPage.tsx`, `features/issue/repository.ts`, `features/{issue,project,specification,notification}/repository.ts`, `entities/user/repository.ts`.
- Verified via Playwright: PATCH `/api/projects/{uuid}` now 200.

### 2026-05-13 — Repository pattern wrappers per BPM spec (`9199664`)
**Added.** Five repositories with domain-named methods:
- `issueRepository`: `findInProject(filters)`, `findEpicsInProject(p)`, `findBoardLayout(p, includeArchived)`, `findDependencyGraph`, `findOne`, `create / update / remove / reorder / bulk*`, plus `findActivities`, `findComments`, `findLinks`, `createSpecLink`, `uploadFile`, `removeFile`. Adds typed `IssueListFilters` (replaces `Record<string, string>`).
- `projectRepository`: `findMine`, `findAllWithMembership`, `findOne`, member/label/join-request operations.
- `userRepository`: `search / findOne` + `.admin.*` sub-namespace for superuser-only operations.
- `notificationRepository`: `findMine`, `getUnreadCount`, `markAsRead`, `markAllAsRead`.
- `specRepository`: `findInProject`, `findOne`, CRUD, comments, downloads.

**Why.** Per BPM spec: "wrap API call thành object methods (`taskRepository.findMine()`) thay vì gọi axios trực tiếp."

### 2026-05-13 — ESLint cleanup post-Repository migration (`c832b2d` → `04438ac`)
**Fixed.** ESLint error count 47 → 23.
- Remove unused `wrap` helper in `useAdminUsers.ts` that violated `rules-of-hooks`.
- Replace `next.has(x) ? next.delete(x) : next.add(x)` ternaries with `if/else` (the side-effect-in-expression-position pattern violates `no-unused-expressions`).
- Drop unused imports (LayoutDashboard, useState in SpecHeader, `get` arg in shortcuts store).
- Extract `FilterState / INITIAL_FILTER / hasActiveFilters / toggleSet` from `shared/ui/FilterBar.tsx` to a new `shared/ui/filterState.ts` so the FilterBar file is HMR-friendly (`react-refresh/only-export-components`). Updated 9 consumer files.
- Extract `copyIssueLink` to `features/issue/lib/copyIssueLink.ts` so `IssueActionMenu.tsx` no longer mixes component + utility exports.

The remaining 19 ESLint errors are React 19 strict-mode flagging valid patterns (third-party DnD ref-callbacks, intentional server-data → form-state sync, manual memoisation). Left in place.

### 2026-05-13 — Bloated-page sweep — Team/Member/Profile (`25f994f`)
**Changed.** Split the four remaining mid-size pages:
- `TeamDashboardPage` 347 → 117 LOC. Extracted: `useTeamDashboard`, `teamStatus` lib, `TeamKpiCards`, `MemberCard`, `MemberCardStats`, `StandupAnswers`, `Tooltip`.
- `MemberTasksPage` 314 → 80 LOC. Extracted: `activityFormat` lib, `MemberStatsRow`, `MemberStandupSection`, `MemberActivitySection`, `MemberIssueGroups`.
- `TeamIssuesPage` 189 → 139 LOC. Extracted: `TeamIssueRow`.
- `ProfilePage` 166 → 23 LOC. Extracted: `useProfileMutations`, `ProfileForm`, `ChangePasswordForm`.

### 2026-05-13 — GlobalDashboardPage split (`9cde9f3`)
**Changed.** 371 → 163 LOC. Extracted: `useGlobalDashboard`, `GlobalIssueRow`, `GlobalFocusPanel`, `GlobalOverduePanel`, `ProjectSummaryCards`, inline `FilterTabs` helper.

### 2026-05-13 — DashboardPage split (`57672d1`)
**Changed.** 453 → 159 LOC. Extracted: `useProjectDashboard`, `SummaryCards`, `FocusSection`, `OtherAssignedSection`, `DistributionPanels`, `MyIssueRow`.

### 2026-05-13 — SpecificationsPage split (`82d28b7`)
**Changed.** 533 → 220 LOC. Extracted: `useSpecifications` (5 mutations bundled), `useSpecReorder` (optimistic drag-drop), `SpecSidebar`, `SpecHeader`, `CreateSpecModal`.

### 2026-05-13 — ApiDocsPage → new `features/api-docs/` feature (`8157ae2`)
**Changed.** 592 → 178 LOC. Built a new feature folder for the OpenAPI viewer:
- `features/api-docs/types.ts` — minimal OpenAPI 3 typings.
- `features/api-docs/lib.ts` — `resolveRef`, `resolveSchema`, `getTypeString` + `METHOD_COLORS`.
- `features/api-docs/hooks/useOpenApiSpec.ts` — fetch + group by tag + `filterGroupsBySearch`.
- `features/api-docs/components/{MethodBadge, CopyButton, SchemaProperties, EndpointCard, TagSidebar}.tsx`.

### 2026-05-13 — IssuesPage split (`fdc1c5d`)
**Changed.** 566 → 169 LOC. Extracted: `useIssueListData`, `useIssueListSelection` (bulk select + keyboard nav + auto-scroll), `useIssueListUrlState` (sort/view/archived URL params), `applyClientFilters` + `buildListParams` lib, `IssuesTable`, `IssueRow`, `SortableHeader`, `IssuesToolbar`.

### 2026-05-13 — BoardPage split (`203f871`)
**Changed.** 512 → 228 LOC. Extracted: `useBoardData`, `useBoardMutations`, `useBoardDerivations` (one-pass index → 8 derived shapes), `useBoardKeyboardNav` (j/k/Enter), `boardFilter` lib (pure `matchesFilters` + `filterBoard`), `BoardToolbar`.

### 2026-05-13 — AdminPage split + `useDebouncedValue` (`c54df53`)
**Changed.** 360 → 108 LOC. Extracted: `useAdminUsers` (7 mutations), Strategy-based `UserActions` (visible buttons depend on `user.status` + self-protection), `AdminUserRow`, `UserStatusBadge`, `ModalDialog`, `EditUserModal`, `ResetPasswordModal`. New shared `useDebouncedValue` hook replaces 3 inline setTimeouts.

### 2026-05-13 — ProjectsPage split + `TabSwitcher` (`2aac387`)
**Changed.** 170 → 88 LOC. Extracted: `useCreateJoinRequest`, `ProjectCard`, `JoinRequestPrompt` (tri-state CTA). New `shared/ui/atoms/TabSwitcher` generic over tab id type, replacing inline tab toggles across 3 pages.

### 2026-05-13 — StandupSettingsPage split (`7736b8b`)
**Changed.** 736 → 101 LOC. Extracted: `useStandupQuestions`, `useStandupConfigs` (5 mutations), `useSlackData`, `QuestionsSection`, `ConfigsSection`, `ConfigRow`, `ConfigForm` (unified create/edit), `ScheduleFields`, `QuestionSelector`, `MemberSelector`. The unified `ConfigForm` collapsed ~250 lines of duplicated form code into 105.

### 2026-05-13 — LinkedIssues split with Strategy pattern (`a619f2b`)
**Changed.** 552 → 29 LOC. The original file bundled link-type inversion, two sections, two modals (with their own search state), inline rows, and mutations.
- `features/issue/lib/linkType.ts` — `LINK_TYPE_STRATEGY` table (label + inverse per `IssueLinkType`).
- `features/issue/hooks/{useLinkedIssuesDisplay, useIssueLinkMutations, useSpecLinkMutations}`.
- `features/issue/components/links/{LinkedIssuesSection, SpecRefsSection, LinkedIssueRow, SpecLinkRow, LinkIssueModal, LinkSpecModal, ModalShell}`.

The page-level `LinkedIssues.tsx` is now a 29-line composition root.

### 2026-05-13 — TimelinePage split (`e72696d`)
**Changed.** 729 → 170 LOC. Extracted: `lib.ts` (pure helpers + types), 5 hooks (`useTimelineData`, `useFilteredIssues`, `useTimelineDateRange`, `useTimelineGroups`, `useTimelineRows`), 5 components (`TimelineHeader`, `TimelineLabelColumn`, `TimelineChart`, `TimelineTooltip`, `GroupByToggle`).

### 2026-05-13 — SettingsPage split (`9424db3`)
**Changed.** 670 → 116 LOC. Extracted 5 hooks under `features/project/hooks/` (`useProjectMembers / Labels / Components / JoinRequests / Mutations`) and 7 section components under `features/project/components/settings/` (`SettingsSection / General / Members / JoinRequests / Labels / Components / DangerZone`).

### 2026-05-13 — IssueDetailPanel split — SOLID + Custom Hooks + Container/Presentational (`576cbb8`)
**Changed.** 1030 → 184 LOC. The original file mixed: data fetching for 5 endpoints, 5 mutations, undo-toast state machine, keyboard shortcuts, and 8+ inline UI regions.
- 4 hooks: `useIssueDetailData`, `useIssueMutations`, `useAssignmentWithUndo` (Strategy via `opts.field` so Assignee + Reviewer share the same flow), `useIssueDetailShortcuts`.
- 2 shared hooks: `useOutsideClick`, `useEscapeKey`.
- 7 sub-components under `components/detail/`: `IssueDetailHeader`, `IssueMetadata`, `IssueLabelsPicker`, `IssueComponentsPicker`, `IssueDescription`, `IssueAttachments`, `IssueSubtasks`, `IssueDetailTabs`.
- Domain primitives reusable across the codebase: `entities/user/UserAvatar` + `UserPicker` (replaces 6+ inline avatar implementations in this one file), `shared/ui/atoms/InlineField`, `shared/lib/copyToClipboard` (extracted from the inline branch-copy fn), badges (`StatusBadge`, `PriorityBadge`, `IssueTypeIcon`).

### 2026-05-13 — ESLint boundaries v6 + integrations index (`c7146e3`)
**Changed.** Migrated `boundaries/element-types` → `boundaries/dependencies` with v6 object-form selectors. Added `src/features/integrations/index.ts` namespacing slack + github subfeatures. Zero boundary violations, zero deprecation warnings.

### 2026-05-13 — Remove all backward-compat shims (Phase 5) (`6e95e40`)
**Removed.** Deleted `src/{api, lib, hooks, components}/` (shim directories that re-exported from the new locations during the migration). All imports now use canonical layer paths. `src/{app, pages, widgets, features, entities, shared}/` only.
**Changed.** Bulk-updated 24 stragglers under `pages/` and `widgets/` from `@/hooks/*` / `@/components/*` / `@/api/*` to canonical paths. Moved `filter-codec.ts` and `toast.ts` to `@/shared/lib/`.

### 2026-05-13 — Canonicalise imports + dead-code cleanup (Phase 5 part 1) (`64210fe`)
**Changed.** Updated 43 files in `features/`, `shared/`, `widgets/` from shim alias paths to canonical paths.
**Removed.** Deleted `src/components/ToastContainer.tsx` (fully replaced by Sonner).

### 2026-05-13 — App-layer providers + lazy routes (Phase 4) (`e3a21de`)
**Added.** Extracted `<AppProviders>` (QueryClient) into `src/app/providers/`. Moved all route definitions to `src/app/router/` with `React.lazy()` per page. Simplified `App.tsx` to a composition root.

### 2026-05-13 — Feature migration — all 13 features + entities (Phase 3) (`486a2d6`)
**Changed.** 153 files moved into the feature-based structure. All old paths became thin re-export shims during this phase (deleted in Phase 5).

Feature layer:
- `features/auth` (api + Zustand store)
- `features/project` (api + component-api)
- `features/credentials, features/template, features/search, features/notification`
- `features/integrations/{slack, github}`
- `features/standup, features/specification, features/dashboard, features/report`
- `features/issue` (api + quick-issue-api + all issue/board/comment/activity components)
- `features/timeline`

Shared layer:
- `shared/lib`: utils, time, error, branch-name, filter hooks, keyboard hooks, stores
- `shared/ui`: FilterBar, ViewToggle, editor, markdown, atoms, ErrorBoundary
- `widgets/AppLayout`

Entities layer:
- `entities/user` (`userApi`)

### 2026-05-13 — Shared layer + Toast → Sonner (Phase 2) (`ee618fc`)
**Added.** `class-variance-authority` + `sonner` installed. `components.json` for shadcn. Shared lib/api/config/types structure created.
**Changed.** Toast system migrated from custom Zustand store to Sonner (zero consumer changes via `.getState()` shim). Old paths become thin re-export shims for backward compatibility.

### 2026-05-13 — Architecture skeleton + ESLint boundaries (Phase 1) (`a776234`)
**Added.** Folder skeleton `src/{app, shared, entities, features, widgets, pages}`. Path aliases added to `tsconfig.app.json`. `eslint-plugin-boundaries` installed and configured.

### 2026-05-13 — Refactor spec + discovery plan (`265241d`)
**Added.** `REFACTOR_FROTEND_SPEC.md` + `REFACTOR_PLAN.md` at the repo root. Phase 0 discovery output: inventory of current state, identified 10 issues with severity/impact, target architecture, 5-phase migration plan, 15-feature priority table, risk register.

---

## Patterns introduced

See [`patterns.md`](./patterns.md) for the full catalogue. New idioms this refactor introduced:

- **Repository** — `xxxRepository.findX()` over `xxxApi.X(...)`.
- **Custom Hooks pattern** — data hooks, mutation bundles, derivation hooks, URL-state hooks.
- **Strategy table** — `LINK_TYPE_STRATEGY`, `STATUS_CONFIG`, `UserActions` visibility table.
- **Container/Presentational** — pages are containers, sections are presentational.
- **Compound-form pattern** — single `ConfigForm` powering both create + edit modes.
- **Modal scaffold** — `<ModalShell>`, `<ModalDialog>` for repeated overlays.
- **Undo-toast** — `useAssignmentWithUndo` + `showActionToast(key)` for deferred mutations.

## Patterns retired

- Inline `axios` calls in components — gone.
- Inline `useState` for filter state — replaced by `useFilterSearchParams` / `useIssueListUrlState`.
- Inline `next.has(x) ? next.delete(x) : next.add(x)` ternaries — replaced by `if/else` (ESLint no-unused-expressions).
- Mixed component + utility exports — split into separate files per `react-refresh/only-export-components`.
- The custom Zustand-based `ToastContainer` — Sonner takes over, hidden behind the same `useToastStore.getState().addToast(...)` facade.

---

## Test coverage at refactor

- ✅ Manual + Playwright E2E sweep covered every page + the assign/status/comment/delete flows.
- ❌ No automated test suite. **This is the biggest risk.** Recommended next step is the Playwright smoke-test track that was approved in the original spec but deferred during refactor.

---

## Known issues at refactor close

1. **`/api-docs` direct URL collides with Vite proxy `/api/*`** — SPA navigation works, direct URL access returns the OpenAPI 404 JSON. Pre-existing, not introduced. Fix is a route rename or scoping the proxy more precisely.
2. **TipTap chunk is 593 KB** — lazy-loaded but still the largest non-vendor chunk. Future optimisation: lazy-load TipTap inside the modal/panel that uses it.
3. **19 React 19 strict-mode ESLint warnings** remain. All are intentional patterns (third-party DnD ref-callbacks, server-data sync to form state, manual memoisation). Not fixed because the React 19 lint flags valid code; fixing would require either disabling the rule or restructuring patterns that work correctly.
