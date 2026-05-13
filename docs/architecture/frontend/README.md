# Frontend Architecture — `packages/web`

> A React 19 / Vite / TypeScript SPA organised as a **6-layer Feature-Based architecture** with strict one-way dependency direction enforced by `eslint-plugin-boundaries`. All HTTP access flows through Repository-pattern wrappers; every page is a thin composition root over feature hooks and presentation components.

> Related backend docs: [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md) · [`../../changelogs/`](../../changelogs/) · [`../../PRD.md`](../../PRD.md)

---

## Index

| File | Scope |
|---|---|
| [`overview.md`](./overview.md)               | The 6 layers, dependency direction, what lives where, and the reasoning behind the split. |
| [`patterns.md`](./patterns.md)               | Design patterns applied: Repository, Custom Hooks, Strategy, Container/Presentational, Compound Component, with concrete file pointers. |
| [`folder-structure.md`](./folder-structure.md) | Per-folder responsibilities, naming conventions, and the ESLint boundary rules table. |
| [`repository-pattern.md`](./repository-pattern.md) | How the Repository layer wraps `xxxApi` clients, typed filter inputs, when to add a new repo method vs reach for `xxxApi` directly. |
| [`hooks-catalog.md`](./hooks-catalog.md)     | Every custom hook the app ships, grouped by feature, with one-line intent. Useful when you're tempted to write `useXxxData` and want to check if it already exists. |
| [`refactor-2026-05-changelog.md`](./refactor-2026-05-changelog.md) | The history of the May 2026 re-architecture (flat → 6-layer, god component split, Repository pattern). |

---

## Snapshot

```
packages/web/src/
├── app/         Composition root — providers, router, lazy routes
├── pages/       Route components (each < 230 LOC, thin orchestrators)
├── widgets/     Cross-feature composition (AppLayout)
├── features/    Domain features (auth, issue, project, dashboard, …)
├── entities/    Shared business entities (user)
└── shared/      Reusable infrastructure (ui/, lib/, api/, config/, types/)
```

**Stack** — React 19, Vite 8, TypeScript 6, TanStack Query 5, Zustand 5, Tailwind v4, React Router 7, Sonner (toasts), shadcn/ui primitives, hello-pangea/dnd, TipTap (markdown editor).

**Verification commands**

```sh
pnpm --filter @bb-pm/web typecheck   # tsc --noEmit
pnpm --filter @bb-pm/web build       # vite build
pnpm --filter @bb-pm/web lint        # eslint . — includes boundaries plugin
```

---

## Reading order for new contributors

1. [`overview.md`](./overview.md) — understand the 6 layers and where your code belongs.
2. [`folder-structure.md`](./folder-structure.md) — find the right folder before touching anything.
3. [`patterns.md`](./patterns.md) — learn the idioms before reinventing them.
4. [`repository-pattern.md`](./repository-pattern.md) — when adding a new API call, do it here.
5. [`hooks-catalog.md`](./hooks-catalog.md) — when writing a new hook, scan this first.

## When to update each doc

- **Added a layer-crossing import or a new top-level folder**  → update `overview.md` + `folder-structure.md`.
- **Introduced a new design pattern in production code** → add a section in `patterns.md` with one concrete file pointer.
- **Added a Repository method or a new repository** → update `repository-pattern.md`.
- **Added a custom hook reused across ≥ 2 files** → add a row in `hooks-catalog.md`.
- **Refactored a page > 50 LOC or split a component** → append an entry to `refactor-2026-05-changelog.md` (or start a new dated changelog if a fresh phase).
