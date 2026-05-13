# Folder Structure & Boundary Rules

> The canonical layout for `packages/web/src/`. Every contributor should be able to answer "where does this code go?" in under 10 seconds by consulting this file.

---

## 1. Top-level

```
packages/web/src/
├── App.tsx                  ← composition root entry; wires AppProviders + AppRouter
├── main.tsx                 ← ReactDOM.createRoot mount
├── index.css                ← Tailwind v4 directives + global selectors
├── assets/                  ← static images (only used via import, not /public)
│
├── app/                     ← LAYER 1
│   ├── providers/index.tsx  QueryClientProvider, future ThemeProvider
│   └── router/index.tsx     <AppRouter> with React.lazy() per page + AuthGuard
│
├── pages/                   ← LAYER 2 — route components, < 230 LOC each
│   ├── LoginPage.tsx
│   ├── RegisterPage.tsx
│   ├── ProjectsPage.tsx
│   ├── NewProjectPage.tsx
│   ├── BoardPage.tsx
│   ├── IssuesPage.tsx
│   ├── TimelinePage.tsx
│   ├── SpecificationsPage.tsx
│   ├── DashboardPage.tsx
│   ├── GlobalDashboardPage.tsx
│   ├── CredentialsPage.tsx
│   ├── SettingsPage.tsx
│   ├── StandupSettingsPage.tsx
│   ├── AdminPage.tsx
│   ├── TeamDashboardPage.tsx
│   ├── TeamIssuesPage.tsx
│   ├── MemberTasksPage.tsx
│   ├── ProfilePage.tsx
│   └── ApiDocsPage.tsx
│
├── widgets/                 ← LAYER 3 — cross-feature composition blocks
│   └── AppLayout/AppLayout.tsx
│
├── features/                ← LAYER 4 — domain features
│   ├── auth/
│   ├── project/
│   ├── issue/
│   ├── dashboard/
│   ├── timeline/
│   ├── specification/
│   ├── standup/
│   ├── notification/
│   ├── credentials/
│   ├── template/
│   ├── search/
│   ├── report/
│   ├── admin/
│   ├── api-docs/
│   └── integrations/
│       ├── slack/
│       └── github/
│
├── entities/                ← LAYER 5 — shared business entities
│   └── user/
│       ├── api.ts
│       ├── repository.ts
│       ├── UserAvatar.tsx
│       ├── UserPicker.tsx
│       └── index.ts
│
└── shared/                  ← LAYER 6 — infrastructure, no domain knowledge
    ├── ui/                  primitives + cross-cutting components
    │   ├── FilterBar.tsx
    │   ├── filterState.ts
    │   ├── ViewToggle.tsx
    │   ├── ShortcutsHelpModal.tsx
    │   ├── ErrorBoundary.tsx
    │   ├── atoms/           InlineField, TabSwitcher, InfoTooltip, ClickableImage, ImagePreviewModal
    │   ├── editor/          TipTapEditor + TipTapToolbar
    │   └── markdown/        MarkdownEditor + MarkdownViewer
    ├── lib/                 useDebouncedValue, useOutsideClick, useEscapeKey,
    │                        useKeyboardShortcuts, useRegisterShortcuts,
    │                        useFilterSearchParams, filter-codec, copyToClipboard,
    │                        utils (cn), time, error, branch-name,
    │                        toast (Sonner bridge), theme, shortcuts, imagePreview
    ├── api/
    │   └── client.ts        singleton axios instance + auth refresh interceptor
    ├── config/
    │   └── constants.ts     STATUS_LABELS, PRIORITY_COLORS, TYPE_ICONS, …
    └── types/
        └── index.ts         ShareContext, etc.
```

---

## 2. Inside a feature folder

Every feature follows the same shape (only the parts it needs):

```
features/<feature-name>/
├── api.ts            HTTP-only client (axios calls + types). No business logic.
├── repository.ts     Domain-named wrapper over api.ts. The thing consumers import.
├── lib/              Pure functions / strategy tables / non-component helpers.
├── hooks/            useXxx — data hooks, mutation bundles, derivations.
├── components/       UI specific to this feature.
│   ├── ComponentA.tsx
│   ├── ComponentB.tsx
│   └── detail/       (Optional) sub-folder grouping related components
├── store.ts          (Optional) Zustand store, e.g. features/auth/store.ts
└── index.ts          Public API — re-exports what cross-feature consumers may use.
```

**Examples** of real features:

```
features/issue/              ← the heaviest feature
├── api.ts
├── quick-issue-api.ts
├── repository.ts
├── lib/
│   ├── boardFilter.ts        matchesFilters + filterBoard pure functions
│   ├── issueClientFilter.ts  applyClientFilters + buildListParams
│   ├── linkType.ts           Strategy table for IssueLinkType
│   └── copyIssueLink.ts
├── hooks/
│   ├── useBoardData.ts
│   ├── useBoardMutations.ts
│   ├── useBoardDerivations.ts
│   ├── useBoardKeyboardNav.ts
│   ├── useIssueDetailData.ts
│   ├── useIssueDetailShortcuts.ts
│   ├── useIssueMutations.ts
│   ├── useAssignmentWithUndo.ts
│   ├── useIssueLinkMutations.ts
│   ├── useSpecLinkMutations.ts
│   ├── useIssueListData.ts
│   ├── useIssueListSelection.ts
│   ├── useIssueListUrlState.ts
│   ├── useLinkedIssuesDisplay.ts
│   └── useOpenIssueFromUrl.ts
├── components/
│   ├── IssueDetailPanel.tsx    composition root, 184 LOC
│   ├── IssueActionMenu.tsx
│   ├── ActivityTab.tsx
│   ├── AttachmentItem.tsx
│   ├── BulkActionBar.tsx
│   ├── CreateIssueModal.tsx
│   ├── IssueTreeView.tsx
│   ├── LinkedIssues.tsx        composition root, 29 LOC
│   ├── LinkedPullRequests.tsx
│   ├── QuickIssueModal.tsx
│   ├── activity/ActivityTimeline.tsx
│   ├── badges/{StatusBadge,PriorityBadge,IssueTypeIcon}.tsx
│   ├── board/{BoardColumn,IssueCard,SwimlaneBoardView,SwimlaneRow,BoardToolbar,types}.*
│   ├── comment/{CommentInput,CommentItem}.tsx
│   ├── detail/{IssueDetailHeader,IssueMetadata,IssueDescription,IssueAttachments,
│   │           IssueSubtasks,IssueLabelsPicker,IssueComponentsPicker,IssueDetailTabs}.tsx
│   ├── links/{LinkedIssuesSection,SpecRefsSection,LinkedIssueRow,SpecLinkRow,
│   │          LinkIssueModal,LinkSpecModal,ModalShell}.tsx
│   └── list/{IssuesTable,IssueRow,SortableHeader,IssuesToolbar}.tsx
└── index.ts
```

```
features/project/
├── api.ts
├── component-api.ts          components are project-scoped, sub-resource
├── repository.ts
├── hooks/
│   ├── useProjectMembers.ts
│   ├── useProjectLabels.ts
│   ├── useProjectComponents.ts
│   ├── useJoinRequests.ts
│   ├── useCreateJoinRequest.ts
│   └── useProjectMutations.ts
├── components/
│   ├── ProjectCard.tsx
│   ├── JoinRequestPrompt.tsx
│   └── settings/             section components for SettingsPage
│       ├── SettingsSection.tsx
│       ├── GeneralSection.tsx
│       ├── MembersSection.tsx
│       ├── JoinRequestsSection.tsx
│       ├── LabelsSection.tsx
│       ├── ComponentsSection.tsx
│       └── DangerZoneSection.tsx
└── index.ts
```

---

## 3. Naming conventions

| Kind | Convention | Example |
|---|---|---|
| React component | PascalCase, one default export | `IssueDetailHeader.tsx` |
| Custom hook | camelCase starting with `use`, file = hook name | `useIssueMutations.ts` |
| Pure-fn lib module | camelCase or kebab-case, named exports | `lib/linkType.ts`, `lib/branch-name.ts` |
| Repository | `<entity>Repository` const, exported from `repository.ts` | `issueRepository.findOne` |
| API client (low-level) | `<entity>Api` const, exported from `api.ts` | `issueApi.list` (used inside `repository.ts` only) |
| Zustand store hook | `use<Name>Store`, exported from `store.ts` or `shared/lib/<name>.ts` | `useAuthStore`, `useThemeStore` |
| Types / interfaces | PascalCase, declared near use, exported from same file or `types.ts` | `IssueListFilters`, `FilterState` |

---

## 4. Where to put things — decision tree

**"I'm writing a new HTTP call."**
→ Add the method to the relevant `features/<x>/api.ts`.
→ Expose it via a domain-named method on `features/<x>/repository.ts`.
→ Consumers import `xxxRepository`, never `xxxApi` directly.

**"I'm writing a hook."**
1. Is it generic (debounce, outside-click, keyboard)? → `shared/lib/useXxx.ts`.
2. Is it tied to one feature? → `features/<x>/hooks/useXxx.ts`.
3. Is it user-data-related cross-feature? → `entities/user/` (rare).

**"I'm writing a component."**
1. Is it a pure UI primitive (no domain words)? → `shared/ui/atoms/` or `shared/ui/`.
2. Is it specific to one feature? → `features/<x>/components/`.
3. Does it compose multiple features? → `widgets/<Name>/`.
4. Is it a route? → `pages/<Name>Page.tsx`.

**"I'm writing a utility / pure function."**
1. Generic (cn, date format, debounce)? → `shared/lib/`.
2. Feature-specific (board filter predicate, link-type table)? → `features/<x>/lib/`.

**"I need a Zustand store."**
1. Cross-cutting UI state (theme, shortcuts, lightbox)? → `shared/lib/<name>.ts`.
2. Auth state? → `features/auth/store.ts`.
3. Feature-local state usually doesn't need Zustand — prefer `useState` + lifting.

---

## 5. ESLint boundary rules

Configured in [`packages/web/eslint.config.js`](../../../packages/web/eslint.config.js):

```js
'boundaries/dependencies': ['error', {
  default: 'disallow',
  rules: [
    { from: { type: 'shared' },   allow: { to: { type: 'shared' } } },
    { from: { type: 'entities' }, allow: { to: { type: ['shared', 'entities'] } } },
    { from: { type: 'features' }, allow: { to: { type: ['shared', 'entities', 'features'] } } },
    { from: { type: 'widgets' },  allow: { to: { type: ['shared', 'entities', 'features', 'widgets'] } } },
    { from: { type: 'pages' },    allow: { to: { type: ['shared', 'entities', 'features', 'widgets', 'pages'] } } },
    { from: { type: 'app' },      allow: { to: { type: ['shared', 'entities', 'features', 'widgets', 'pages', 'app'] } } },
  ],
}]
```

The element-type detection comes from path patterns:

```js
'boundaries/elements': [
  { type: 'app',      pattern: 'src/app/**/*' },
  { type: 'pages',    pattern: 'src/pages/**/*' },
  { type: 'widgets',  pattern: 'src/widgets/**/*' },
  { type: 'features', pattern: 'src/features/**/*' },
  { type: 'entities', pattern: 'src/entities/**/*' },
  { type: 'shared',   pattern: 'src/shared/**/*' },
],
```

Violating an import will fail `pnpm --filter @bb-pm/web lint` with `boundaries/dependencies`.

---

## 6. Path aliases

Configured in [`tsconfig.app.json`](../../../packages/web/tsconfig.app.json) and [`vite.config.ts`](../../../packages/web/vite.config.ts):

```
@/app/*       src/app/*
@/pages/*     src/pages/*
@/widgets/*   src/widgets/*
@/features/*  src/features/*
@/entities/*  src/entities/*
@/shared/*    src/shared/*
@/*           src/*           (escape hatch, prefer the layered alias)
```

Always import via the layered alias — `@/features/issue/repository`, not `@/../../features/issue/repository`.
