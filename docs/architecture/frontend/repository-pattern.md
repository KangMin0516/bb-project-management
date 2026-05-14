# Repository Pattern

> Every HTTP call goes through a feature/entity `xxxRepository`. The raw `xxxApi` clients are an implementation detail consumed only by the repository module and the api.ts module itself.

---

## 1. Why

Per the BPM spec:
> Wrap API call thành object methods (`taskRepository.findMine()`) thay vì gọi axios trực tiếp trong component.

We get three concrete benefits:

1. **Call sites read like business intent.**
   - Before: `issueApi.list(projectId, { type: 'EPIC', limit: '200' })`
   - After: `issueRepository.findEpicsInProject(projectId)`
2. **Typed filter inputs replace stringly-typed dicts.**
   - Before: `Record<string, string>`
   - After: `IssueListFilters` interface (TypeScript catches typos and missing fields).
3. **One place to add a domain query.** Adding `findOverdueInProject` is a one-line repository method that internally builds the right params, instead of duplicating the params dict across screens.

---

## 2. Layering

```
component / page
      │
      ▼
custom hook  ←──  xxxRepository  ←──  xxxApi  ←──  shared/api/client (axios)
                  ▲                   ▲
                  │                   │
       domain-named methods    raw HTTP calls
       + typed filters         + result-data unwrap
```

**Rule.**
- Components and hooks import **only** `xxxRepository`.
- `repository.ts` is the only file (other than the api module itself) allowed to import `xxxApi`.

Verified by grep — currently zero direct `xxxApi.` references outside the api.ts / repository.ts files.

---

## 3. Repositories shipped today

| Repository | Source | Notes |
|---|---|---|
| `issueRepository`        | `features/issue/repository.ts`            | The largest. Adds typed `IssueListFilters`, `findInProjectRaw` escape hatch for IssuesPage's URL-driven params. |
| `projectRepository`      | `features/project/repository.ts`          | Members + labels + join requests grouped on the same object. |
| `userRepository`         | `entities/user/repository.ts`             | `.admin.*` sub-namespace for superuser-only operations (clearer than flat `adminList` / `adminUpdate` names). |
| `notificationRepository` | `features/notification/repository.ts`     | Compact: list, unread count, mark read. |
| `specRepository`         | `features/specification/repository.ts`    | CRUD + comments + Markdown download. |

Other feature `api.ts` modules (slack, github, standup, dashboard, template, search, report, credentials, components) are consumed via their hooks and don't currently have a repository wrapper. They're stable enough that the wrapper hasn't added value yet — add one if you find yourself writing the same param-construction code in three places.

---

## 4. Anatomy of a repository

`features/issue/repository.ts` is the most-evolved example:

```ts
import { issueApi, uploadApi, type Issue, type PaginatedIssues } from '@/features/issue/api'

const DEFAULT_PAGE_SIZE = 50
const EPIC_PAGE_SIZE = 200

export interface IssueListFilters {
  search?: string
  status?: string
  priority?: string
  type?: string
  assigneeId?: string
  includeArchived?: boolean
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

function toQueryParams(filters: IssueListFilters): Record<string, string> {
  // builds the stringly-typed dict the server expects, in one place
}

export const issueRepository = {
  /** All issues in a project matching the given filters. */
  findInProject(projectId: string, filters: IssueListFilters = {}): Promise<PaginatedIssues> {
    return issueApi.list(projectId, toQueryParams(filters))
  },
  /** Low-level list with raw server params. Used by IssuesPage where the URL → params transform already produces server-shaped dicts. */
  findInProjectRaw: issueApi.list,
  /** EPIC-type issues only — used by the parent picker in IssueDetailPanel. */
  findEpicsInProject: (projectId) => issueApi.list(projectId, { type: 'EPIC', limit: String(EPIC_PAGE_SIZE) }).then(r => r.items),
  /** Full board layout (status → issues). */
  findBoardLayout: (projectId, includeArchived = false) => issueApi.board(projectId, includeArchived ? { includeArchived: true } : undefined),
  /** BLOCKS-relationship graph for the dependency view. */
  findDependencyGraph: issueApi.dependencies,
  /** One issue with all nested resources (activities, attachments, links). */
  findOne: issueApi.get,
  // ─── Lifecycle ───────────────────────────────────────────────
  create: issueApi.create,
  update: issueApi.update,
  remove: issueApi.delete,
  reorder: issueApi.reorder,
  bulkUpdate: issueApi.bulkUpdate,
  bulkDelete: issueApi.bulkDelete,
  // ─── Activity feed ───────────────────────────────────────────
  findActivities: issueApi.activities,
  findProjectActivities: issueApi.projectActivities,
  // ─── Comments ────────────────────────────────────────────────
  findComments: issueApi.comments,
  createComment: issueApi.createComment,
  updateComment: issueApi.updateComment,
  deleteComment: issueApi.deleteComment,
  // ─── Issue-to-issue links ────────────────────────────────────
  findLinks: issueApi.getLinks,
  createLink: issueApi.createLink,
  deleteLink: issueApi.deleteLink,
  // ─── Issue-to-spec section links ─────────────────────────────
  createSpecLink: issueApi.createSpecLink,
  deleteSpecLink: issueApi.deleteSpecLink,
  // ─── File attachments ────────────────────────────────────────
  uploadFile: uploadApi.upload,
  removeFile: uploadApi.delete,
}

export type IssueRepository = typeof issueRepository
```

Two anchor points:
1. **Domain-named methods** at the top (`findInProject`, `findEpicsInProject`, `findBoardLayout`, `findOne`) — these add value by hiding params or composing types.
2. **Pass-throughs** at the bottom (`create`, `update`, `remove`, …) — these are renames only (so consumers never reach for `xxxApi`).

---

## 5. Naming conventions

| Method | Means |
|---|---|
| `findMine()`               | Things owned by the current user. |
| `findOne(id)`              | Single record by id. |
| `findInProject(projectId)` | Filtered list scoped to a project. |
| `findAllWithMembership()`  | Cross-project list with join-state metadata. |
| `findOverdueX()`           | Predicate-based list (when added). |
| `create / update / remove` | Lifecycle. Use `remove` (not `delete`, which is a reserved word). |
| `<verb>Comment`, `<verb>Link` | Sub-resource operations stay on the parent repository when there's no separate feature. |
| `bulkUpdate / bulkDelete`  | Operations over a Set of ids. |

---

## 6. When to extend a repository vs. inline params

Add a repository method when:
- Two or more call sites construct the same params dict.
- The params include domain magic numbers (`limit: 200` for epics).
- The intent is more readable with a name (`findEpicsInProject` beats `list({ type: 'EPIC', limit: '200' })`).

Stay with `findInProjectRaw` / direct api.ts pass-through when:
- The params come from a URL-state transform that already produces server-shaped dicts (`IssuesPage` → `buildListParams`).
- The query is one-off and unlikely to be reused.

---

## 7. The `entities/user/repository.ts` exception

User has two access tiers, so the repository splits them visually:

```ts
export const userRepository = {
  search(query?: string)   { ... },        // any logged-in user
  findOne(id: string)      { ... },        // any logged-in user
  findPendingApproval: userApi.listPending,
  approve: userApi.approve,
  reject: userApi.reject,

  /** Superuser-only operations. Grouped to keep call sites unambiguous. */
  admin: {
    list: userApi.adminList,
    update: userApi.adminUpdate,
    resetPassword: userApi.adminResetPassword,
    suspend: userApi.adminSuspend,
    activate: userApi.adminActivate,
    remove: userApi.adminDelete,
  },
}
```

Callers read `userRepository.admin.suspend(id)` — the `.admin.` segment makes the privilege boundary visible at the call site.

---

## 8. Why we keep `xxxApi` around

The repository **extends**, doesn't replace, the api client. We kept `xxxApi` because:

1. The repository delegates to it. Removing the api module means rebuilding all axios calls inside the repository — more diff for no gain.
2. Test stubs are easier against the lower-level `xxxApi` — stub `axios.get` once, the rest cascades.
3. New developers searching for `axios` in the codebase land on `api.ts`. Easier mental anchor.

The convention: **api = how**, **repository = what**.

---

## 9. Concrete pre-existing bug it fixed

`SettingsPage` GET `/api/projects/PITB` worked (the backend `findOne` resolves either UUID or key), but PATCH `/api/projects/PITB` returned 404 because the backend `update` only accepts UUIDs.

The fix (`pages/SettingsPage.tsx` post-refactor) resolves the canonical UUID from the loaded `project.id` and passes that to mutations. Caught during Playwright E2E sweep, not pre-existing tests.

The Repository pattern made this fix one-line — every mutation in this page funnels through `projectRepository.update`, so swapping the id source from URL param to `project.id` was localised.
