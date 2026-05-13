# Design Patterns in `packages/web`

> Every pattern below is in production use, anchored to a concrete file. Use these as templates when adding new code so the codebase stays internally consistent.

---

## 1. Repository pattern

**What.** Each feature ships an `xxxRepository` object that wraps the low-level `xxxApi` HTTP client with **domain-named methods** and **typed filter inputs**.

**Why.** Call sites read like business intent (`issueRepository.findEpicsInProject(p)`) instead of infrastructure (`issueApi.list(p, { type: 'EPIC', limit: '200' })`). Adding a new query is a one-line addition to the repository; existing callers don't move.

**Where.** Every feature with HTTP access — `features/issue/repository.ts`, `features/project/repository.ts`, `entities/user/repository.ts`, `features/notification/repository.ts`, `features/specification/repository.ts`.

**Rule.** Components and hooks import `xxxRepository`, never `xxxApi`. The only files allowed to reference `xxxApi` are the repository itself and the api.ts module.

See: [`repository-pattern.md`](./repository-pattern.md) for full reference.

---

## 2. Custom Hooks pattern

**What.** Every page delegates data fetching, mutations, and derived state to dedicated `useXxx` hooks.

**Why.** Pages stay <230 LOC. Hooks are independently testable and reusable. The same `useBoardData` powers BoardPage and (in future) any other view that needs the board layout.

### 2.1 Data hooks
Bundle related queries into one return value.

```ts
// features/issue/hooks/useIssueDetailData.ts
export function useIssueDetailData(projectId: string, issueId: string, skipEpics: boolean) {
  const detailQuery   = useQuery({ queryKey: ['issue', projectId, issueId], queryFn: () => issueRepository.findOne(projectId, issueId) })
  const membersQuery  = useQuery({ queryKey: ['members', projectId], queryFn: () => projectRepository.listMembers(projectId) })
  const labelsQuery   = useQuery({ queryKey: ['labels', projectId], queryFn: () => projectRepository.listLabels(projectId) })
  const componentsQuery = useQuery({ queryKey: ['components', projectId], queryFn: () => componentApi.list(projectId) })
  const epicsQuery    = useQuery({ queryKey: ['issues', projectId, 'epics'], queryFn: () => issueRepository.findEpicsInProject(projectId), enabled: !skipEpics })
  return { detail: detailQuery.data, members: membersQuery.data, projectLabels: labelsQuery.data, projectComponents: componentsQuery.data, epics: epicsQuery.data }
}
```

### 2.2 Mutation hooks
Bundle related mutations with their cache invalidation.

```ts
// features/issue/hooks/useIssueMutations.ts
export function useIssueMutations(projectId: string, issueId: string, onDeleted?: () => void) {
  const queryClient = useQueryClient()
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['board', projectId] })
    queryClient.invalidateQueries({ queryKey: ['issues', projectId] })
    queryClient.invalidateQueries({ queryKey: ['issue', projectId, issueId] })
  }
  const update = useMutation({ mutationFn: (d: UpdateIssuePayload) => issueRepository.update(projectId, issueId, d), onSuccess: invalidateAll, onError: ... })
  const deleteIssue     = useMutation({ ... })
  const uploadAttachment = useMutation({ ... })
  const deleteAttachment = useMutation({ ... })
  const createSubtask    = useMutation({ ... })
  return { update, deleteIssue, uploadAttachment, deleteAttachment, createSubtask, invalidateAll }
}
```

### 2.3 Derivation hooks
Compute one-pass index structures from raw data.

```ts
// features/issue/hooks/useBoardDerivations.ts
export function useBoardDerivations(board) {
  return useMemo(() => {
    // single pass that produces:
    //   allIssuesById, childrenMap, parentOnlyBoard,
    //   assignedMembers, boardLabels, boardComponents,
    //   boardEpics, flatBoardIssues
  }, [board])
}
```

### 2.4 URL-state hooks
Encapsulate `useSearchParams` for one page's URL contract.

```ts
// features/issue/hooks/useIssueListUrlState.ts
export function useIssueListUrlState() {
  // owns sortBy, sortOrder, viewMode, showArchived in URL params
  return { sortBy, sortOrder, viewMode, showArchived, setViewMode, setShowArchived, toggleSort }
}
```

See [`hooks-catalog.md`](./hooks-catalog.md) for the full inventory.

---

## 3. Strategy pattern

**What.** Behaviour that varies by an enum value is captured in a lookup table, not a switch statement spread across the codebase.

### 3.1 Issue link types
`features/issue/lib/linkType.ts` — `LINK_TYPE_STRATEGY` table maps each `IssueLinkType` to its display label and its inverse (for flipping inbound links to the issue's own perspective).

```ts
export const LINK_TYPE_STRATEGY: Record<IssueLinkType, { label: string; inverse: IssueLinkType }> = {
  BLOCKS:           { label: 'blocks',           inverse: 'IS_BLOCKED_BY' },
  IS_BLOCKED_BY:    { label: 'is blocked by',    inverse: 'BLOCKS' },
  RELATES_TO:       { label: 'relates to',       inverse: 'RELATES_TO' },
  DUPLICATES:       { label: 'duplicates',       inverse: 'IS_DUPLICATED_BY' },
  IS_DUPLICATED_BY: { label: 'is duplicated by', inverse: 'DUPLICATES' },
}
```

Consumers call `getLinkTypeLabel(type)` / `getInverseLinkType(type)` — no inline switches.

### 3.2 Team member status
`features/dashboard/lib/teamStatus.ts` — the `STATUS_CONFIG` table drives the team-dashboard pill colours, tooltip text, and sort order.

```ts
export const STATUS_CONFIG: Record<StatusIndicator, { dot: string; label: string; order: number; tooltip: string }> = {
  overloaded: { dot: 'bg-orange-500', label: 'Overloaded', order: 0, tooltip: '...' },
  active:     { dot: 'bg-green-500',  label: 'Active',     order: 1, tooltip: '...' },
  light:      { dot: 'bg-yellow-500', label: 'Light',      order: 2, tooltip: '...' },
  idle:       { dot: 'bg-red-500',    label: 'Idle',       order: 3, tooltip: '...' },
}
```

### 3.3 User admin actions
`features/admin/components/UserActions.tsx` — visible action buttons are derived from `user.status` (PENDING shows approve/reject; ACTIVE shows suspend; etc.), with destructive actions auto-hidden when the row is the current user.

---

## 4. Container / Presentational

**What.** Smart parents own state + side effects; dumb children render props.

**Where.** Every page is a container; the section-level components under `features/*/components/` are presentational.

**Example.** `pages/SettingsPage.tsx` (116 LOC) owns the hooks and passes data down. The section components (`GeneralSection`, `MembersSection`, `LabelsSection`, …) just render and call back via props.

```tsx
// pages/SettingsPage.tsx
const projectMutations = useProjectMutations(resolvedId, () => navigate('/'))
...
<GeneralSection project={project} onSave={(data) => projectMutations.update.mutate(data)} />
<MembersSection members={members.members} onAdd={members.add.mutate} ... />
```

The section components don't know about TanStack Query, projectId resolution, or navigation. They receive a `project` and an `onSave` callback.

---

## 5. Compound-form pattern (unified create + edit)

**What.** When a "create" form and an "edit" form share 80%+ of their fields, ship one component with a `mode` discriminator instead of two copies.

**Where.** `features/standup/components/ConfigForm.tsx`.

```tsx
interface ConfigFormProps {
  mode: 'create' | 'edit'
  initial?: Partial<StandupConfigFormData>
  ...
  onSubmit: (data: StandupConfigFormData) => void
  onCancel?: () => void
}
```

The form is the same in both modes; `mode === 'edit'` reveals two extra fields (greeting, goodbye) and switches the submit button label. This collapsed ~250 lines of duplicated form code into ~105.

---

## 6. Modal scaffold

**What.** A `<ModalShell>` component owns the backdrop, header, close button, and stop-propagation glue. Individual modals just render their content.

**Where.** `features/issue/components/links/ModalShell.tsx`, `features/admin/components/ModalDialog.tsx`.

Two scaffolds today; intentionally separate because the links modal supports an optional back-arrow (for the two-step spec picker) while the admin modal does not.

---

## 7. Generic UI primitives

**What.** Strongly-typed reusable atoms with single responsibility.

| Primitive | Path | Use |
|---|---|---|
| `<UserAvatar />`   | `entities/user/UserAvatar.tsx`               | Avatar image w/ initials fallback; 4 size variants. Replaces 6+ inline implementations. |
| `<UserPicker />`   | `entities/user/UserPicker.tsx`               | Dropdown for assignee/reviewer. |
| `<InlineField />`  | `shared/ui/atoms/InlineField.tsx`            | Click-to-edit row primitive used across IssueMetadata fields. |
| `<TabSwitcher />`  | `shared/ui/atoms/TabSwitcher.tsx`            | Segmented tab toggle, generic over the tab id type. |
| `<InfoTooltip />`  | `shared/ui/atoms/InfoTooltip.tsx`            | Multi-language hover tooltip. |
| `<StatusBadge />`  | `features/issue/components/badges/StatusBadge.tsx`   | Issue status pill. |
| `<PriorityBadge />`| `features/issue/components/badges/PriorityBadge.tsx` | Issue priority pill. |
| `<IssueTypeIcon />`| `features/issue/components/badges/IssueTypeIcon.tsx` | Type emoji. |

---

## 8. Undo-toast (deferred mutation)

**What.** Optimistic update + 10-second toast with an "Undo" button that flips the mutation back. Pattern used for assignee + reviewer changes so Slack DM notifications don't fire on accidental clicks.

**Where.** `features/issue/hooks/useAssignmentWithUndo.ts` (the hook), `shared/lib/toast.ts` (the Sonner bridge with key-based de-dup).

```ts
useToastStore.getState().showActionToast({
  key: `${opts.field}:${issueId}`,      // re-assigning replaces the previous toast
  message: `Set ${name} as ${role}. Notifying Slack soon.`,
  durationMs: ASSIGNMENT_UNDO_DURATION, // matches the backend's debounce window
  action: { label: 'Undo', onAction: revertMutation },
})
```

The backend defers Slack DMs by the same window, so an Undo cancels the DM before it fires (see `packages/api/src/notification/notification.service.ts`).

---

## 9. Pure-fn predicates in `lib/`

**What.** Filter predicates and serialisers are extracted to `<feature>/lib/*.ts` and unit-test-friendly.

| File | Purpose |
|---|---|
| `features/issue/lib/boardFilter.ts`       | `matchesFilters` predicate + `filterBoard` over columns. |
| `features/issue/lib/issueClientFilter.ts` | `applyClientFilters` (re-applies multi-select filters the server can't enforce) + `buildListParams` (URL → server params). |
| `features/timeline/lib.ts`                | `computeBarStyle`, `formatDate`, `startOfDay`, types. |
| `features/dashboard/lib/teamStatus.ts`    | `getMemberStatus` decision tree + `STATUS_CONFIG` strategy table. |
| `features/dashboard/lib/activityFormat.ts`| `formatFieldChange` + `formatDateLabel` for the recent-activity feed. |
| `shared/lib/filter-codec.ts`              | `serializeFilter` / `deserializeFilter` for URL roundtripping. |
| `shared/lib/branch-name.ts`               | `deriveBranchName(issue)` for the copy-branch button. |
| `shared/lib/copyToClipboard.ts`           | `copyToClipboard(text)` with `execCommand` fallback for non-secure contexts. |

---

## 10. Code-splitting (lazy routes)

**What.** Every page is `React.lazy()`'d in the router. The main bundle stays at 285 KB (89 KB gzip); each page becomes a chunk loaded on demand.

**Where.** `app/router/index.tsx`.

```tsx
const BoardPage = lazy(() => import('@/pages/BoardPage'))
...
<Route element={<AuthGuard />}>
  <Route element={<AppLayout />}>
    <Route path="/projects/:projectId/board" element={<BoardPage />} />
    ...
  </Route>
</Route>
```

A top-level `<Suspense fallback={<Spinner />} />` in `App.tsx` covers the transition.

---

## 11. Shim layer for toast / store

**What.** `shared/lib/toast.ts` exposes `useToastStore.getState().addToast(...)` — but underneath it bridges to Sonner. Callers don't import Sonner directly; the bridge guarantees consistent dedup-by-key semantics for undo toasts and lets us swap the toast library again without touching every call site.

**Where.** `shared/lib/toast.ts`.

```ts
// Looks like a Zustand store from the call-site perspective
export const useToastStore = {
  getState: () => ({ addToast, showActionToast }),
}
```

Internally `addToast` calls `sonner.toast.success/.error/(message)`, and `showActionToast` calls `sonner.toast(message, { id: key, action: ..., onAutoClose: ... })`.
