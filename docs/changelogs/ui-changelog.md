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
