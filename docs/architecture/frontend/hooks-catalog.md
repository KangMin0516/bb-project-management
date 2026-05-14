# Custom Hooks Catalog

> Every reusable `useXxx` hook in `packages/web`, grouped by location. Scan this before you write a new hook — chances are the one you want already exists.

---

## `shared/lib/` — generic, no domain knowledge

| Hook | Source | Intent |
|---|---|---|
| `useDebouncedValue<T>(value, delayMs)`     | `useDebouncedValue.ts`        | Returns `value` debounced. Used by AdminPage search input. |
| `useOutsideClick(ref, enabled, onOutside)` | `useOutsideClick.ts`          | Calls `onOutside` when a mousedown lands outside `ref`. Used by InlineField, popovers. |
| `useEscapeKey(onEscape)`                   | `useEscapeKey.ts`             | Global Escape keypress → callback. Caller's handler is ref-held to defeat stale closures. |
| `useKeyboardShortcuts()`                   | `useKeyboardShortcuts.ts`     | Top-level listener that dispatches into the shortcuts registry. Mounted in AppLayout. |
| `useRegisterShortcuts(scope, shortcuts)`   | `useRegisterShortcuts.ts`     | Pages register their shortcut bindings (`a` to focus assignee, `j`/`k` to navigate). Scope is pushed/popped on mount/unmount. |
| `useFilterSearchParams()`                  | `useFilterSearchParams.ts`    | Reads + writes shared `FilterState` to URL search params. Debounced search write. |

Plus three Zustand stores exported as `useXxxStore` (technically not hooks, but invoked the same way):

| Store | Source | Holds |
|---|---|---|
| `useThemeStore`        | `theme.ts`        | `theme: 'light' \| 'dark' \| 'system'` + `initTheme()`. |
| `useShortcutsStore`    | `shortcuts.ts`    | Shortcut registry + active scopes + sequence buffer. |
| `useImagePreviewStore` | `imagePreview.ts` | Lightbox URL + alt. |
| `useToastStore`        | `toast.ts`        | Thin facade over Sonner with `addToast` + `showActionToast` (undo pattern). |

---

## `features/auth/`

| Hook | Source | Intent |
|---|---|---|
| `useAuthStore`           | `store.ts`                          | Zustand: `user`, `token`, `login`, `logout`, `loadUser`, `setTokens`, `uploadAvatar`. The single source of session state. |
| `useProfileMutations()`  | `hooks/useProfileMutations.ts`      | Bundles `authApi.updateProfile` + `authApi.changePassword` mutations. |

---

## `features/project/`

| Hook | Source | Intent |
|---|---|---|
| `useProjectMembers(projectId)`     | `hooks/useProjectMembers.ts`    | Members list + add/remove/updateRole mutations. |
| `useProjectLabels(projectId)`      | `hooks/useProjectLabels.ts`     | Labels list + create + seed defaults. |
| `useProjectComponents(projectId)`  | `hooks/useProjectComponents.ts` | Components list + CRUD. |
| `useJoinRequests(projectId, enabled)` | `hooks/useJoinRequests.ts`   | Pending join requests + approve/reject. Admin-gated by `enabled`. |
| `useCreateJoinRequest(onSuccess?)` | `hooks/useCreateJoinRequest.ts` | Requester-side: send a join request from the projects list. |
| `useProjectMutations(projectId, onDeleted?)` | `hooks/useProjectMutations.ts` | Project-level update + delete. |

---

## `features/issue/`

The heaviest feature — has 15+ hooks. Organised by purpose.

### Data queries

| Hook | Source | Intent |
|---|---|---|
| `useBoardData(projectId, showArchived)`       | `hooks/useBoardData.ts`           | Project + board query bundle. |
| `useIssueDetailData(projectId, issueId, skipEpics)` | `hooks/useIssueDetailData.ts` | 5 queries: detail, members, labels, components, epics. |
| `useIssueListData({ projectId, listParams })` | `hooks/useIssueListData.ts`       | List page bundle: project + members + labels + components + issues + 2 mutations. |
| `useOpenIssueFromUrl(issues, onSelect, opts)` | `hooks/useOpenIssueFromUrl.ts`    | Reads `?open=:id` and triggers `onSelect` once issues load. |

### Derivations

| Hook | Source | Intent |
|---|---|---|
| `useBoardDerivations(board)`                  | `hooks/useBoardDerivations.ts`    | One-pass index over board producing: `allIssuesById`, `childrenMap`, `parentOnlyBoard`, `assignedMembers`, `boardLabels`, `boardComponents`, `boardEpics`, `flatBoardIssues`. |
| `useLinkedIssuesDisplay(sourceLinks, targetLinks)` | `hooks/useLinkedIssuesDisplay.ts` | Flips inbound `targetLinks` via the LinkType strategy table to one outbound perspective. |

### Mutations

| Hook | Source | Intent |
|---|---|---|
| `useIssueMutations(projectId, issueId, onDeleted?)` | `hooks/useIssueMutations.ts`       | Update, delete, uploadAttachment, deleteAttachment, createSubtask. Shared cache invalidation. |
| `useBoardMutations(projectId)`                | `hooks/useBoardMutations.ts`       | Reorder + updateIssue (status/parent toggles from sub-task rows). |
| `useAssignmentWithUndo({ projectId, issueId, members, onSuccess? })` | `hooks/useAssignmentWithUndo.ts` | The Gmail-style undo toast for assignee/reviewer changes. |
| `useIssueLinkMutations(projectId, issueId, onCreated?)` | `hooks/useIssueLinkMutations.ts` | Create + delete issue-to-issue link. |
| `useSpecLinkMutations(projectId, issueId, onCreated?)`  | `hooks/useSpecLinkMutations.ts`  | Create + delete issue-to-spec section link. |

### URL state + UI behaviour

| Hook | Source | Intent |
|---|---|---|
| `useIssueListUrlState()`           | `hooks/useIssueListUrlState.ts`   | Sort field, sort order, view mode, archived flag — all encoded in URL params. |
| `useIssueListSelection({ items, onOpen, isDetailOpen })` | `hooks/useIssueListSelection.ts` | Bulk selection state + j/k/Enter/x keyboard nav + auto-scroll. |
| `useBoardKeyboardNav({ flatBoardIssues, onOpenIssue, isDetailOpen })` | `hooks/useBoardKeyboardNav.ts` | j/k/Enter focus traversal over the flat board issue list. |
| `useIssueDetailShortcuts({ panelRef, disabled })` | `hooks/useIssueDetailShortcuts.ts` | `a`/`s`/`p` keys → click the assignee/status/priority InlineField triggers. |

---

## `features/dashboard/`

| Hook | Source | Intent |
|---|---|---|
| `useProjectDashboard(projectId)`   | `hooks/useProjectDashboard.ts`    | Stats query + focus-toggle mutation. |
| `useGlobalDashboard()`             | `hooks/useGlobalDashboard.ts`     | Cross-project "My Dashboard" query + focus-toggle mutation. |
| `useTeamDashboard(enabled)`        | `hooks/useTeamDashboard.ts`       | Team-wide query (60s refetch) + grouped standup-by-userId map. |

---

## `features/timeline/`

| Hook | Source | Intent |
|---|---|---|
| `useTimelineData(projectId)`                  | `hooks/useTimelineData.ts`        | Project + issues query bundle. |
| `useFilteredIssues(allIssues, filters)`       | `hooks/useFilteredIssues.ts`      | Apply the shared `FilterState` to a flat issue list (CANCELED hidden by default). |
| `useTimelineDateRange(issues)`                | `hooks/useTimelineDateRange.ts`   | Derive `[start, end]` window + Monday-aligned week markers. |
| `useTimelineGroups(allIssues, filteredIssues, groupBy)` | `hooks/useTimelineGroups.ts` | Bucket issues by Epic / Type / Assignee. |
| `useTimelineRows(groupBy, epicGroups, groups, collapsedEpics)` | `hooks/useTimelineRows.ts` | Flatten groupings into a linear discriminated-union row list. |

---

## `features/specification/`

| Hook | Source | Intent |
|---|---|---|
| `useSpecifications(projectId, selectedId)` | `hooks/useSpecifications.ts` | List + detail queries + create/update/delete mutations. |
| `useSpecReorder(projectId, specs)`         | `hooks/useSpecReorder.ts`    | Drag-drop reorder within a category, optimistic + per-item PATCH. |

---

## `features/standup/`

| Hook | Source | Intent |
|---|---|---|
| `useStandupQuestions()`  | `hooks/useStandupQuestions.ts` | Question list + create/remove mutations. |
| `useStandupConfigs()`    | `hooks/useStandupConfigs.ts`   | Config list + create/update/remove + trigger/toggleEnabled mutations. |
| `useSlackData()`         | `hooks/useSlackData.ts`        | Slack status + channels + users (lazy on integrationId). |

---

## `features/admin/`

| Hook | Source | Intent |
|---|---|---|
| `useAdminUsers({ status, search, enabled })` | `hooks/useAdminUsers.ts` | Admin user list query + 7 mutations (approve/reject/suspend/activate/update/resetPassword/remove). |

---

## `features/api-docs/`

| Hook | Source | Intent |
|---|---|---|
| `useOpenApiSpec()` | `hooks/useOpenApiSpec.ts` | Fetch + group `/api/docs-json` by tag. |

Plus pure helper `filterGroupsBySearch(groups, search)` in the same module.

---

## Total

≈ **38 hooks**. Pages compose these; few pages declare more than 3 local `useState`s.

When you add a hook here, also bump the relevant table above so the next contributor doesn't reinvent it.
