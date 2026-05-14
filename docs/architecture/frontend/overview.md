# Frontend Architecture Overview

> 6-layer Feature-Based architecture for `packages/web`. Strict one-way dependency direction, enforced by `eslint-plugin-boundaries` v6. Each layer has a single responsibility; pages are thin orchestrators over feature hooks and presentation components.

---

## 1. The 6 layers

```
┌─────────────────────────────────────────────────────────────┐
│  app/         Composition root — providers, router         │ ← can import everything
├─────────────────────────────────────────────────────────────┤
│  pages/       Route components, < 230 LOC each             │
├─────────────────────────────────────────────────────────────┤
│  widgets/     Cross-feature composition (AppLayout, …)     │
├─────────────────────────────────────────────────────────────┤
│  features/    Domain features (auth, issue, project, …)    │
├─────────────────────────────────────────────────────────────┤
│  entities/    Shared business entities (user)              │
├─────────────────────────────────────────────────────────────┤
│  shared/      ui/, lib/, api/, config/, types/             │ ← imports from nothing internal
└─────────────────────────────────────────────────────────────┘
```

Dependency direction: a higher layer may import from any lower layer; the reverse is forbidden.

| Layer | Can import from | Cannot import from |
|---|---|---|
| `app/`      | everything                                 | — |
| `pages/`    | `widgets`, `features`, `entities`, `shared`, other `pages` | `app` |
| `widgets/`  | `features`, `entities`, `shared`, other `widgets`          | `app`, `pages` |
| `features/` | other `features`, `entities`, `shared`                    | `app`, `pages`, `widgets` |
| `entities/` | `entities`, `shared`                                       | everything above |
| `shared/`   | only `shared`                                              | everything above |

Enforced by [`packages/web/eslint.config.js`](../../../packages/web/eslint.config.js) (`boundaries/dependencies` rule). Violations fail `pnpm lint`.

---

## 2. What lives where

### `app/` — Composition root
- **`app/providers/`** — `<AppProviders>` wraps the tree with QueryClientProvider (and future Sentry, ThemeProvider, etc.). One file, no domain knowledge.
- **`app/router/`** — `<AppRouter>` registers every route with `React.lazy()` so each page becomes its own bundle chunk. Also owns `<AuthGuard>` (redirects to `/login` when no token).

### `pages/`
- One file per route. **< 230 LOC** is the soft cap (current max: `BoardPage.tsx` 228).
- A page **does not** contain business logic. It composes:
  - feature data hooks (`useIssueDetailData`)
  - feature mutation hooks (`useBoardMutations`)
  - feature sub-components (`<BoardToolbar />`, `<IssuesTable />`)
  - shared UI primitives (`<TabSwitcher>`, `<UserAvatar>`)
- Common page shape:
  ```tsx
  export default function FooPage() {
    const { projectId } = useParams<{ projectId: string }>()
    const { data, mutate } = useFooData(projectId)
    if (!projectId) return null
    if (data === undefined) return <Loading />
    return <FooLayout data={data} onAction={mutate} />
  }
  ```

### `widgets/`
- Components that compose **multiple features** in a single block.
- Today: `AppLayout` (sidebar + topbar + notifications + theme toggle + shortcut palette).

### `features/`
- One folder per BPM domain feature: `auth`, `project`, `issue`, `dashboard`, `timeline`, `specification`, `standup`, `notification`, `credentials`, `template`, `search`, `report`, `admin`, `api-docs`, `integrations/{slack,github}`.
- Standard subfolder layout inside a feature:
  ```
  features/issue/
  ├── api.ts                 HTTP-only client (raw axios calls, types)
  ├── repository.ts          Domain-named wrapper (findEpicsInProject, …)
  ├── lib/                   Pure functions / strategy tables (linkType, copyIssueLink)
  ├── hooks/                 useXxx — data, mutations, derivations
  ├── components/            UI specific to this feature
  └── index.ts               Public API — only what cross-feature consumers may import
  ```
- Features may import other features **only through their `index.ts`** (the public API).

### `entities/`
- Cross-feature business entities. Today: just `user`.
- An entity owns:
  - `api.ts` — the HTTP client (here: `userApi.list / get / admin.*`)
  - `repository.ts` — domain methods (`userRepository.search / .admin.list / …`)
  - Primitive components — `UserAvatar`, `UserPicker` (used in 6+ places across `features/`)

### `shared/`
- Pure infrastructure with **no** domain knowledge.
  - `ui/` — Tailwind-styled primitives: `atoms/` (Button-shaped pieces), `editor/` (TipTap), `markdown/`, `FilterBar.tsx`, `ViewToggle.tsx`, `ShortcutsHelpModal.tsx`, `ErrorBoundary.tsx`
  - `lib/` — generic hooks + helpers: `cn`, `time`, `error`, `branch-name`, `copyToClipboard`, `useDebouncedValue`, `useOutsideClick`, `useEscapeKey`, `useKeyboardShortcuts`, `useRegisterShortcuts`, `useFilterSearchParams`, `filter-codec`, `toast`, `theme`, `shortcuts`, `imagePreview`
  - `api/` — `client.ts` (the singleton axios instance + auth refresh interceptor)
  - `config/` — `constants.ts` (STATUS_LABELS, PRIORITY_COLORS, …)
  - `types/` — `ShareContext` and other cross-cutting types

---

## 3. Why this architecture?

| Goal | How it's enforced |
|---|---|
| **Find code quickly.** "Where does the assignee dropdown live?" → `features/issue/components/detail/IssueMetadata.tsx` | Folder structure follows screen vocabulary, not technology vocabulary. |
| **Change one feature without breaking another.** | Features only know about each other via `index.ts` re-exports. Deleting a feature folder leaves the app buildable (modulo the route registration). |
| **Onboard new contributors fast.** | The 6-layer table is small enough to memorise. The "page is a composition root" rule means new contributors can read one file end-to-end and understand it. |
| **Optimise bundle size.** | `React.lazy()` on every route makes each page its own chunk (10–40 KB). Main bundle is 285 KB before gzip (89 KB after). |
| **Make architectural drift catch fire at PR time.** | ESLint boundaries plugin fails the build if a `shared/` file ever imports from `features/`. |

---

## 4. Data flow

```
        ┌──────────┐   useFooMutations()   ┌─────────────┐
 page ──┤ feature  ├──── fooRepository ────┤ shared/api/ │── axios ──► /api/* (Nest)
        │  hooks   │                       │  client.ts  │
        └────┬─────┘                       └─────────────┘
             │ useFooData()
             ▼
        TanStack Query cache  ◄──── invalidation on mutate
```

- **Queries** are owned by feature hooks (`useBoardData`, `useIssueDetailData`, `useProjectMembers`, …). Components consume the hook return value.
- **Mutations** are bundled with their invalidation logic in the same hook (`useIssueMutations` invalidates `['board', projectId]`, `['issues', projectId]`, and `['issue', projectId, issueId]` on success).
- **Server state** = TanStack Query. **Client state** = Zustand (theme, shortcuts, image-preview lightbox) + local `useState`.
- **Toasts** = Sonner, accessed via a `useToastStore.getState().addToast(…)` shim in `shared/lib/toast.ts` so callers don't import sonner directly.

---

## 5. URL state

The board, issues, and timeline views encode their filter state in the URL search params via `useFilterSearchParams` + `filter-codec`. Reload, back/forward, "Copy link" — all preserve the view. Each page has a small `useXxxUrlState` hook that wraps `useSearchParams` so consumers stay declarative.

See: `shared/lib/filter-codec.ts`, `shared/lib/useFilterSearchParams.ts`.

---

## 6. Known constraints

- **No SSR.** The app is a pure SPA. SEO is not a goal — this is an internal tool.
- **No real-time push.** All freshness is poll-driven via TanStack Query (`refetchInterval` on the team dashboard, default `refetchOnWindowFocus: false` elsewhere). Two users on the same board may diverge until one reloads — see backend pain point P8 in [`docs/ARCHITECTURE.md`](../../ARCHITECTURE.md).
- **`/api-docs` direct URL collides with Vite proxy `/api/*`.** Click-through from the sidebar works (SPA navigation); hitting the URL directly returns the OpenAPI 404 JSON. To be fixed by changing the route name or scoping the proxy more precisely. Pre-existing.
- **TipTap chunk is 593 KB.** Lazy-loaded, but still the largest non-vendor chunk. Future optimisation: split the markdown editor lower into the page/modal that uses it.

---

## 7. Where this lives in git

| File | Source |
|---|---|
| Eslint boundaries config | [`packages/web/eslint.config.js`](../../../packages/web/eslint.config.js) |
| Path aliases | [`packages/web/tsconfig.app.json`](../../../packages/web/tsconfig.app.json), [`packages/web/vite.config.ts`](../../../packages/web/vite.config.ts) |
| App router (lazy routes) | [`packages/web/src/app/router/index.tsx`](../../../packages/web/src/app/router/index.tsx) |
| App providers | [`packages/web/src/app/providers/index.tsx`](../../../packages/web/src/app/providers/index.tsx) |
| Refactor PR | [#57 refactor(web): full frontend re-architecture](https://github.com/seo-burning/bb-project-management/pull/57) |
