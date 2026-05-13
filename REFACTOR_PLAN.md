# Frontend Refactor Plan — `packages/web`

> Phase 0 (Discovery) output theo `REFACTOR_FROTEND_SPEC.md`.
> Đọc trước khi bắt đầu bất kỳ migration nào. Update sau mỗi phase.

---

## TL;DR

Codebase hiện tại **không có vấn đề về chất lượng code** (TS strict-ish, tooling hiện đại — React 19, Vite 8, TanStack Query, Zustand). Vấn đề là **organization**: cấu trúc folder phẳng theo "component type" thay vì "feature", nên khi codebase scale tiếp sẽ rất khó:

- **Đụng độ khi nhiều người làm song song** — mọi feature đụng vào cùng `src/api/`, `src/components/issue/`, `src/lib/constants.ts`.
- **Onboarding chậm** — không biết logic "assign issue" sống ở đâu (rải qua 4-5 file).
- **Pages quá lớn** — 4 page >500 LOC (lớn nhất 736), chứa cả business logic + UI + state.
- **Duplication ngầm** — Avatar pattern lặp 28+ lần inline, không có Design System.

**Đề xuất**: refactor sang **Feature-Based architecture** + **shadcn/ui** làm design system. Triển khai **incremental theo phase**, không big-bang. Tổng dự kiến **4-6 tuần** part-time (giảm 1-2 tuần nhờ shadcn thay vì build atom from scratch), không break user-facing behavior.

### Decisions đã chốt

| | |
|---|---|
| **Design system** | **shadcn/ui** (Radix primitives + cva + Tailwind). Lý do: a11y miễn phí, owned code, fit hoàn hảo với React 19 + Tailwind 4. |
| **Folder shadcn** | `src/shared/ui/` **flat** (theo shadcn CLI default). Bỏ taxonomy atoms/molecules/organisms — không cần khi đã có shadcn. |
| **Toast** | Swap sang **Sonner** (shadcn-recommended) trong Phase 2. Port undo logic của PR #56 sang. |
| **Architecture** | Feature-Based vertical slicing (app/shared/entities/features/widgets/pages). |

---

## 1. Current State Inventory

### 1.1 Tooling

| | |
|---|---|
| Framework | React **19.2** |
| Router | react-router-dom **7.14** |
| Build | Vite **8.0** + Tailwind **4.2** |
| TS | TypeScript **6.0** (strict-ish, xem mục [1.6](#16-tsconfig)) |
| Server state | **TanStack Query 5.96** (tốt — đã có) |
| Client state | **Zustand 5.0** (tốt — đã có) |
| Forms | Manual `useState` (chưa có react-hook-form) |
| HTTP | Axios **1.14** với client instance |
| UI Primitives | Tailwind utility + lucide-react. **Không có design system** |
| Editor | TipTap **3.22** |
| DnD | @hello-pangea/dnd **18** |
| Test | **❌ Không có test infrastructure** |

### 1.2 Folder structure

```
packages/web/src/
├── api/                17 files — HTTP wrappers + types混
├── components/         44 files trong 18 sub-folder theo domain
│   ├── ui/             3 files (ClickableImage, ImagePreviewModal, InfoTooltip) — design system "trống"
│   ├── issue/          10 files — bao gồm cả container 1030-LOC
│   ├── dashboard/      5 files — chart widgets
│   ├── board/          5 files — chỉ là 1 view của Issue feature
│   ├── settings/       4 files — mỗi file là 1 sub-feature riêng
│   ├── ...
├── pages/              19 page files — 4 file >500 LOC
├── hooks/              4 generic hooks
├── lib/                7 utility files (constants, time, error, …)
├── stores/             5 Zustand stores (auth, theme, toast, imagePreview, shortcuts)
├── App.tsx             Routing inline, eager import tất cả page
└── main.tsx
```

### 1.3 Pages — quy mô và độ phức tạp

| Page | LOC | Hooks (`use*`) | Vấn đề |
|---|---|---|---|
| `StandupSettingsPage.tsx` | **736** | 25 | Form + API + sub-tab state, mix everything |
| `TimelinePage.tsx` | **729** | 27 | Gantt logic, scroll sync, business rules trong page |
| `SettingsPage.tsx` | **670** | 41 | Tab navigation + form cho 4 sub-feature trong 1 page |
| `ApiDocsPage.tsx` | **592** | 12 | OpenAPI viewer inline, không tái sử dụng |
| `IssuesPage.tsx` | **566** | 30 | List + filter + bulk + detail panel + open-from-URL |
| `SpecificationsPage.tsx` | **533** | 31 | Spec tree + content + comments inline |
| `BoardPage.tsx` | **512** | 43 | Kanban DnD + swimlane + filter + create + detail |
| `DashboardPage.tsx` | **453** | 12 | 5 chart composition + selectors |
| `GlobalDashboardPage.tsx` | **371** | 12 | Cross-project widget |
| `AdminPage.tsx` | **360** | 21 | User mgmt + role mgmt |

**Theo spec: page nên < 100 LOC, chỉ composition.** Hiện tại **0 page** đạt.

### 1.4 Components — coupling

```
44 component files, top imports:
  5x  @/components/filter/FilterBar           ← shared filter, OK
  4x  @/components/issue/IssueDetailPanel     ← cross-page container, đúng feature
  4x  @/components/editor/TipTapEditor        ← shared, OK
  3x  @/components/markdown/MarkdownViewer    ← shared, OK
  3x  @/components/issue/CreateIssueModal     ← cross-page, đúng feature
```

**Cross-feature dependencies** (page nào dùng `@/components/issue/*`):
- `IssuesPage`, `BoardPage`, `SpecificationsPage`, `TeamIssuesPage`, `TimelinePage`, `AppLayout` → IssueDetailPanel
- `BoardPage`, `IssuesPage`, `TimelinePage`, ... → CreateIssueModal

→ `issue` đúng là feature cốt lõi, cross-cutting.

### 1.5 Duplication & code smells

| Pattern | Số chỗ | Hậu quả |
|---|---|---|
| Inline avatar div `<span className="h-X w-X rounded-full bg-..."` | **28+** | Không có `<Avatar>` component → mỗi lần đổi style phải sửa nhiều chỗ. Vừa thấy ngay trong `IssueDetailPanel.tsx:77,89` |
| Inline `interface XProps` trong cùng file | **28** | Khó tìm khi search type, không có public API rõ |
| `useToastStore.getState().addToast(...)` trong `onError` | **15+** | Có thể wrap `useMutation` thành helper hook |
| `getErrorMessage(err, '...')` rải khắp | **20+** | OK đã extract, nhưng có thể wrap luôn vào helper |
| `queryClient.invalidateQueries(...)` định nghĩa lại inline | **mỗi file** | Mỗi feature có pattern `invalidateAll` riêng, không nhất quán |

### 1.6 `tsconfig`

```jsonc
{
  "strict": "(implied true via reference?)",
  "noUnusedLocals": false,     // ← nên bật
  "noUnusedParameters": false, // ← nên bật
  "verbatimModuleSyntax": true,
  "erasableSyntaxOnly": true,  // ← chặn enum, namespace
}
```

**Path alias**: chỉ có `@/* → ./src/*`. Cần thêm `@/shared/*`, `@/features/*`, `@/entities/*`, `@/widgets/*`, `@/pages/*`, `@/app/*` sau khi tạo folder.

### 1.7 Routing

`App.tsx` import **19 page eager**, route inline:
- Chưa có `React.lazy` → initial bundle to (vite build cuối cùng ~1.6MB JS).
- Không có route table — thêm route phải mở `App.tsx`.
- Không có route-level error boundary.

---

## 2. Issues & Impact

### 2.1 🔴 Critical — Pages chứa business logic

**Impact**: khi backend đổi shape API, phải search nhiều page; khó test logic; conflict cao khi merge.

**Ví dụ cụ thể**: `BoardPage.tsx` có 43 hook usages:
- 3 `useQuery` (board data, project, members)
- 5 `useMutation` (update, bulk update, reorder, delete, bulk delete)
- DnD logic của @hello-pangea/dnd inline
- Filter state quản lý local
- Detail panel open/close state
- Quick-issue modal state

**Đề xuất**: tách thành:
- `features/issue/hooks/useBoardData.ts` — 3 query
- `features/issue/hooks/useBoardMutations.ts` — 5 mutation
- `features/issue/components/BoardView.tsx` — DnD + columns presentation
- `pages/BoardPage.tsx` — chỉ ráp `<BoardView />` + read route params

### 2.2 🔴 Critical — `api/` không có domain boundary

17 file flat, mỗi file có ~5-18 type definition + hàm HTTP. `issues.ts` (8.2K) là biggest, chứa **13 type** + `issueApi` object.

**Impact**: 
- Cross-feature dependency ngầm — bất kỳ ai sửa `api/issues.ts` đụng UI nhiều page.
- Type re-export không kiểm soát — `import type { Issue } from '@/api/issues'` rải 20+ chỗ.

**Đề xuất**: di chuyển vào `features/<feature>/api/`, types ra `features/<feature>/types.ts`, expose qua barrel `index.ts`.

### 2.3 🟡 High — `components/` mix purpose

`components/issue/` trộn:
- **Presentational**: `IssueCard` (board card), `ActivityTab`
- **Business modal**: `CreateIssueModal`, `QuickIssueModal`
- **Container god-component**: `IssueDetailPanel` (1030 LOC, gọi 8 mutation, 3 query)
- **Integration**: `LinkedPullRequests` (cần GitHub API)

**Impact**: file `IssueDetailPanel.tsx` quá lớn, mọi thay đổi assignment/comment/attachment đều phải mở file này.

**Đề xuất**: tách thành sub-components ở `features/issue/components/issue-detail/`:
- `IssueDetailPanel.tsx` (composition only)
- `IssueDetailHeader.tsx`
- `IssueDetailFields.tsx` (status/priority/assignee/dates)
- `IssueDetailDescription.tsx`
- `IssueDetailAttachments.tsx`
- `IssueDetailLinkedIssues.tsx` (mới — đã có)
- `IssueDetailLinkedPRs.tsx` (mới — đã có)
- Hooks: `useIssueDetail(id)`, `useIssueMutations(id)`

### 2.4 🟡 High — Không có Design System

`components/ui/` chỉ có 3 file. Mọi button, badge, dropdown đều dùng Tailwind utilities trực tiếp ở mỗi component.

**Impact**: 
- 28+ chỗ inline Avatar → đổi style avatar = sửa 28 chỗ.
- Button style không nhất quán (primary/secondary/danger mix tự do).
- Không có a11y consistency (focus ring, aria-label).

**Đề xuất**: build `shared/ui/atoms/` cơ bản:
- `Avatar` (user fallback initial, image variant, size variants)
- `Button` (variant: primary/secondary/ghost/danger, size: sm/md/lg)
- `IconButton`
- `Badge` (color variant)
- `Spinner`
- `Input`, `Textarea`, `Label`

### 2.5 🟡 High — State coupling qua window/global getters

```ts
useToastStore.getState().addToast(...)  // rải khắp onError
```

**Impact**: khó test, không declarative, ngầm coupling.

**Đề xuất**: 
- Tạo `shared/lib/hooks/useApiMutation.ts` — wrap `useMutation` tự động hiện toast khi error.
- Toast invocation chỉ ở 1 chỗ trong wrapper.

### 2.6 🟢 Medium — Không lazy load

Tất cả 19 page eager import → initial bundle to. Bundle hiện tại ~1.6MB JS (theo log vite build trước đó: "Some chunks are larger than 500 kB").

**Đề xuất**: `React.lazy()` cho route-level page, kèm `Suspense` boundary với spinner. Giảm initial bundle ~40-60% cho page đầu (Login/Dashboard).

### 2.7 🟢 Medium — Type duplication

28 inline `*Props` interface. `Issue` type re-defined trong `api/issues.ts` + dùng khắp nơi qua `import type`.

**Đề xuất**: 
- Move Props interface ra `props.ts` cùng folder nếu component có > 5 prop.
- Domain types (Issue, Project, User, Label, Component, …) tập trung ở `entities/<name>/types.ts`.

### 2.8 🟢 Medium — Routing không có table

`App.tsx` 90 LOC, import 19 page. Thêm route phải edit ở đây.

**Đề xuất**: `app/router/routes.ts` export array `{ path, element, guards }`, generate `<Route>` từ array.

### 2.9 🟢 Low — `lib/constants.ts` thành đống

`constants.ts` (4.5K) chứa STATUS_BADGE_COLORS, PRIORITY_COLORS, TYPE_ICONS, TOAST_DURATION, ORDER_GAP, DEBOUNCE_DELAY, … — mix UI tokens, domain enum, technical config.

**Đề xuất**: split:
- `shared/config/constants.ts` — technical (TOAST_DURATION, DEBOUNCE_DELAY, ORDER_GAP)
- `entities/issue/constants.ts` — STATUSES, STATUS_LABELS, STATUS_BADGE_COLORS, PRIORITY_COLORS, TYPE_ICONS
- `shared/config/theme.ts` (nếu cần) — color tokens

### 2.10 🟢 Low — TS strict chưa max

`noUnusedLocals: false`. Có thể bật để bắt dead code trong CI.

---

## 3. Target Architecture (adapted from spec)

```
packages/web/src/
├── app/                            # Composition root
│   ├── providers/                  # QueryClient, ThemeProvider, AuthGate
│   ├── router/
│   │   ├── routes.ts               # Route table (array)
│   │   ├── AuthGuard.tsx
│   │   └── AdminGuard.tsx
│   ├── App.tsx                     # Thin: providers + RouterProvider
│   └── main.tsx
│
├── shared/                         # Generic, không có domain knowledge
│   ├── ui/                         # ← shadcn/ui components (flat, theo CLI default)
│   │   ├── button.tsx              # shadcn add button
│   │   ├── input.tsx, label.tsx, textarea.tsx
│   │   ├── avatar.tsx              # → replace 28 chỗ inline
│   │   ├── badge.tsx
│   │   ├── sheet.tsx               # → IssueDetailPanel base
│   │   ├── dialog.tsx              # → CreateIssueModal, QuickIssueModal
│   │   ├── alert-dialog.tsx        # → confirm flows
│   │   ├── dropdown-menu.tsx       # → AssigneeDropdown, actions menu
│   │   ├── popover.tsx
│   │   ├── command.tsx             # → CommandPalette
│   │   ├── tabs.tsx                # → IssueDetailPanel Details/Activity
│   │   ├── tooltip.tsx             # → InfoTooltip
│   │   ├── select.tsx, calendar.tsx
│   │   ├── separator.tsx, skeleton.tsx
│   │   └── sonner.tsx              # → swap ToastContainer
│   ├── lib/                        # useDebounce, formatDate, timeAgo, cn, getErrorMessage
│   ├── api/
│   │   ├── client.ts               # Axios instance + interceptors
│   │   └── hooks/                  # useApiMutation, useApiQuery (toast wrapper qua Sonner)
│   ├── config/                     # constants, env, route paths
│   └── types/                      # Pagination, ApiResponse, Brand types
│
├── entities/                       # Business domain models (chia sẻ giữa feature)
│   ├── user/                       # User type, UserAvatar, userApi (light)
│   ├── issue/                      # Issue type, IssueBadge (status/priority/type), constants
│   ├── project/                    # Project type, ProjectBadge
│   ├── label/                      # Label type, LabelChip
│   └── component/                  # Component type, ComponentChip
│
├── features/                       # 1 use case = 1 folder
│   ├── auth/                       # login, register, AuthGuard, useCurrentUser, usePermissions
│   ├── project/                    # CRUD project, member management
│   ├── issue/                      # ★ feature lớn nhất
│   │   ├── api/                    # issuesApi.ts, quickIssueApi.ts
│   │   ├── components/
│   │   │   ├── board/              # BoardView, BoardColumn, SwimlaneView, IssueCard
│   │   │   ├── list/               # IssuesList, IssueRow
│   │   │   ├── tree/               # IssueTreeView
│   │   │   ├── detail/             # IssueDetailPanel + sub-components (tách 1030 LOC)
│   │   │   ├── modals/             # CreateIssueModal, QuickIssueModal
│   │   │   ├── bulk/               # BulkActionBar
│   │   │   └── linked/             # LinkedIssues, LinkedPullRequests
│   │   ├── hooks/                  # useBoardData, useIssueMutations, useIssueFilters
│   │   ├── store/                  # (nếu cần — hiện tại có thể không)
│   │   ├── types.ts                # Re-export entities/issue + feature-specific types
│   │   └── index.ts                # Public API
│   ├── specification/              # Spec CRUD + comments
│   ├── timeline/                   # Gantt view
│   ├── dashboard/                  # Project dashboard charts
│   ├── admin/                      # Team management, member tasks
│   ├── standup/                    # Standup settings + reports
│   ├── notification/               # Bell, notification list
│   ├── search/                     # Command palette
│   ├── template/                   # Issue templates
│   ├── credentials/                # Credentials manager
│   ├── api-docs/                   # API docs viewer + key management
│   └── integrations/
│       ├── slack/
│       └── github/
│
├── widgets/                        # (optional) composition của nhiều feature
│   ├── AppHeader/                  # auth + notification + search + theme toggle
│   └── AppSidebar/
│
└── pages/                          # < 100 LOC mỗi page, chỉ ráp
    ├── LoginPage.tsx
    ├── BoardPage.tsx               # = <BoardView projectId={id} /> + open issue from URL
    └── ...
```

---

## 4. Migration Plan

### Phase 1 — Foundation (1-2 ngày, **1 PR**)

**Scope**: setup, không di chuyển code.

- [ ] Tạo folder skeleton: `app/`, `shared/{ui/{atoms,molecules,organisms},lib,api,config,types}/`, `entities/`, `features/`, `widgets/`, `pages/` (chỉ folder + `.gitkeep`)
- [ ] Thêm path alias trong `tsconfig.app.json` + `vite.config.ts`:
  ```jsonc
  "paths": {
    "@/*": ["./src/*"],
    "@/app/*": ["./src/app/*"],
    "@/shared/*": ["./src/shared/*"],
    "@/entities/*": ["./src/entities/*"],
    "@/features/*": ["./src/features/*"],
    "@/widgets/*": ["./src/widgets/*"],
    "@/pages/*": ["./src/pages/*"]
  }
  ```
- [ ] Thêm `eslint-plugin-boundaries` config trong `eslint.config.js`:
  ```js
  {
    'boundaries/element-types': ['error', {
      default: 'disallow',
      rules: [
        { from: 'shared', allow: ['shared'] },
        { from: 'entities', allow: ['shared', 'entities'] },
        { from: 'features', allow: ['shared', 'entities', 'features'] },  // qua public API
        { from: 'widgets', allow: ['shared', 'entities', 'features', 'widgets'] },
        { from: 'pages', allow: ['shared', 'entities', 'features', 'widgets', 'pages'] },
        { from: 'app', allow: '*' },
      ],
    }],
  }
  ```
- [ ] Bật `noUnusedLocals: true`, `noUnusedParameters: true` (chấp nhận có lint cleanup nhỏ)
- [ ] Verify: `pnpm build` + `pnpm dev` xanh

**Commit**: `chore(web): setup architecture skeleton + path aliases + ESLint boundaries`

### Phase 2 — shadcn/ui setup + shared/lib + Sonner (1-2 ngày, **2 PR**)

#### 2.1 Install + theme setup (PR #1)
- [ ] Verify `src/lib/utils.ts` `cn()` impl (clsx + tailwind-merge — đã có deps)
- [ ] Init shadcn: `npx shadcn@latest init` với config:
  - Style: Default
  - Base color: Slate (match palette hiện tại) hoặc Neutral
  - CSS variables: Yes
  - React Server Components: No (Vite SPA)
  - Components path: `@/shared/ui`
  - Utils path: `@/shared/lib/utils`
- [ ] Setup Tailwind v4 theme variables: shadcn v3 dùng `@theme` directive trong `src/index.css`. Verify primary color hiện tại (`primary-600` blue family) map đúng sang `--primary`.
- [ ] Dark mode: shadcn dùng `class="dark"` strategy — đã match `useThemeStore` hiện tại
- [ ] Install components core (1 lệnh duy nhất):
  ```bash
  npx shadcn@latest add button input label textarea avatar badge \
    sheet dialog alert-dialog dropdown-menu popover command \
    tabs tooltip select calendar separator skeleton sonner
  ```
- [ ] Add Sonner provider trong `app/App.tsx` (replaces `<ToastContainer />`)
- [ ] Smoke test: app build + dev xanh, page hiện tại chưa break (chưa swap chỗ nào)

**Commit**: `feat(web): bootstrap shadcn/ui design system + Sonner toast`

#### 2.2 Port Toast logic sang Sonner (PR #2)
- [ ] Sonner có sẵn: `id` (replace), `action`, `duration`, `onAutoClose`, `onDismiss` — map 1:1 với code custom đã build cho PR #56:
  - `showActionToast({ key, ... })` → `toast.message(msg, { id: key, action: { label, onClick }, duration, onAutoClose })`
  - Per-key replacement → Sonner tự handle khi `id` trùng
  - Progress bar → Sonner có animation built-in (không cần render thủ công)
  - `(Ns)` countdown text → bỏ (Sonner progress bar đã đủ rõ)
- [ ] Migrate `useToastStore`:
  - `addToast(msg, type)` → wrapper gọi `toast.error()` / `toast.success()` / `toast.info()`
  - `showActionToast(...)` → wrapper gọi `toast.message(...)` với action
- [ ] Smoke test luồng PR #56: assign user → toast hiện → Undo trong 10s → cancel pending DM
- [ ] Xóa `src/components/ToastContainer.tsx` (sau khi verify Sonner thay thế hoàn toàn)
- [ ] Xóa `<ToastContainer />` trong App.tsx, replace bằng `<Toaster />` từ sonner

**Commit**: `refactor(web): swap custom toast to Sonner, port undo flow`

#### 2.3 shared/lib + api (gộp vào PR #2 hoặc tách)
- [ ] `shared/lib/`: move `time.ts`, `error.ts`, `branch-name.ts` (nếu generic — `branch-name` nên đẩy về `features/issue/lib/`)
- [ ] `shared/api/client.ts`: di chuyển `api/client.ts`
- [ ] `shared/api/hooks/useApiMutation.ts` (mới): wrap `useMutation` tự động `toast.error(getErrorMessage(err))` — eliminate 15+ chỗ inline
- [ ] `shared/config/`: tách `constants.ts` → `shared/config/constants.ts` (TOAST_DURATION, DEBOUNCE_DELAY, ORDER_GAP) + `entities/issue/constants.ts` (STATUSES, STATUS_LABELS, STATUS_BADGE_COLORS, PRIORITY_COLORS, TYPE_ICONS)

**Acceptance**: shadcn components ready trong `src/shared/ui/`. Toast hoạt động qua Sonner. Codebase cũ vẫn chạy y nguyên — chưa swap UI nào trong page.

**Risk**: 
- Tailwind v4 + shadcn setup có thể có 1-2 issue nhỏ với `@theme` directive → reference official docs (https://ui.shadcn.com/docs/tailwind-v4). Nếu stuck > 1h thì fallback Tailwind v3.4 cho web package.
- Sonner default position `bottom-right` khớp với ToastContainer hiện tại → không đổi UX.

### Phase 3 — Migrate features (5-6 tuần, **1 PR mỗi feature**)

Thứ tự ưu tiên: **ít coupling → nhiều coupling**. Mỗi feature một PR riêng, có thể parallel cho leaf features.

| # | Feature | Files chính | Effort | Rủi ro | Pages bị ảnh hưởng |
|---|---|---|---|---|---|
| 1 | `credentials` | `CredentialManager.tsx`, `api/credentials.ts`, `pages/CredentialsPage.tsx` | S | Thấp | 1 |
| 2 | `integrations/slack` | `SlackIntegration.tsx`, `api/slack.ts` | S | Thấp | 1 |
| 3 | `integrations/github` | `GitHubIntegration.tsx`, `api/github.ts` | S | Thấp | 1 |
| 4 | `template` | `TemplateManager.tsx`, `api/templates.ts` | S | Thấp | 1 |
| 5 | `search` | `CommandPalette`, `api/search.ts` | S | Thấp | layout |
| 6 | `notification` | `NotificationBell`, `api/notifications.ts` | S | Thấp | layout |
| 7 | `auth` | `LoginPage`, `RegisterPage`, `stores/auth.ts`, `api/auth.ts`, AuthGuard | M | Trung bình (touches App) | 2 |
| 8 | `project` | `ProjectsPage`, `NewProjectPage`, `api/projects.ts` | M | Trung bình | 2 |
| 9 | `standup` | `StandupSettingsPage` (736 LOC!), `api/standup.ts` | L | Trung bình | 1 |
| 10 | `api-docs` | `ApiDocsPage` (592 LOC), `CredentialsManager` overlap | L | Thấp | 1 |
| 11 | `specification` | `SpecificationsPage` (533 LOC), `SpecContent`, `SpecCommentPanel` | L | Trung bình | 1 |
| 12 | `admin` | `AdminPage`, `TeamDashboardPage`, `TeamIssuesPage`, `MemberTasksPage` | L | Trung bình | 4 |
| 13 | `dashboard` | `DashboardPage` (453), `GlobalDashboardPage`, 5 chart components | L | Trung bình | 2 |
| 14 | `timeline` | `TimelinePage` (729 LOC) | XL | Cao (Gantt logic) | 1 |
| 15 | `issue` | **★ HEAVY** — board/list/tree/detail/modals/bulk/linked, IssueDetailPanel 1030 LOC | XXL | **Cao** — touches mọi page | 7+ |

**Rule cho mỗi feature migration**:
1. Tạo `features/<name>/{api,components,hooks,types.ts,index.ts}`
2. Copy code sang (không cut), update imports trong feature folder mới
3. **Swap UI primitive sang shadcn** ngay trong bước này (Avatar, Button, Dialog, DropdownMenu, ...). Hạn chế phải đụng file thêm lần thứ 2.
4. Trong pages cũ, đổi import từ `@/components/xxx` sang `@/features/<name>` qua public API
5. App vẫn build + chạy → commit
6. Xóa file cũ ở `src/components/xxx`, `src/api/xxx.ts`, `src/hooks/xxx.ts`
7. App vẫn build + chạy → commit cleanup
8. Mỗi feature: **2 commit nhỏ**, dễ revert

**Pattern feature size đặc biệt — `issue`**:

Đây là feature lớn nhất, cross-cutting. Đề xuất chia làm 4 PR sub-task:

- **15a**: tạo skeleton `features/issue/`, move primitives (`IssueCard`, `BoardColumn`, `SwimlaneRow`, `IssueTreeView`) sang `features/issue/components/`. Pages vẫn import qua barrel.
- **15b**: migrate API + types (`api/issues.ts`, `api/quick-issue.ts`) sang `features/issue/api/`. Re-export từ barrel để pages cũ chưa hỏng.
- **15c**: tách `IssueDetailPanel` thành sub-components (header, fields, description, attachments, linked). Mỗi sub-component < 200 LOC.
- **15d**: tách hooks `useBoardData`, `useIssueMutations`, `useIssueFilters` — đẩy logic ra khỏi `BoardPage`/`IssuesPage`.

### Phase 4 — Simplify pages (1 tuần, **1 PR**)

Sau khi tất cả feature đã migrate:

- [ ] Refactor từng page xuống < 100 LOC. Mục tiêu:
  - `BoardPage.tsx`: 512 → ~60 LOC
  - `IssuesPage.tsx`: 566 → ~80 LOC
  - `TimelinePage.tsx`: 729 → ~60 LOC
  - `StandupSettingsPage.tsx`: 736 → ~80 LOC
- [ ] Route table — `app/router/routes.ts` array, lazy load với `React.lazy + Suspense`
- [ ] AppLayout (sidebar + header) refactor thành `widgets/AppShell` nếu cần

### Phase 5 — Cleanup (2-3 ngày, **1 PR**)

- [ ] Xóa folder cũ `src/components/`, `src/api/`, `src/hooks/`, `src/lib/` (cái nào đã trống)
- [ ] Xóa file `.gitkeep` thừa
- [ ] Audit: tìm `import from '@/components/'` còn sót → fix
- [ ] Bundle size diff check trước/sau
- [ ] Final ESLint pass với boundaries strict
- [ ] Update CLAUDE.md nếu có (note convention mới)
- [ ] Update `REFACTOR_PLAN.md` mark "completed"

---

## 5. Risk Register

| Rủi ro | Mức | Mitigation |
|---|---|---|
| Phá behavior người dùng vì miss import path | High | Mỗi PR build + manual smoke test 5 luồng chính (login, board DnD, create issue, comment, settings) |
| Conflict với feature đang dev song song | Medium | Schedule refactor sprint riêng, freeze new feature trong sprint đó. Hoặc rebase liên tục. |
| Bundle to lên vì circular import | Low | ESLint boundaries enforce dependency direction. Vite warn nếu circular. |
| `IssueDetailPanel` tách quá nhỏ → prop drilling | Medium | Dùng `useIssueDetail(id)` shared hook + Context cho deeply-nested children |
| Path alias break trong test sau này | Low | Tooling đã setup ổn, vitest dùng cùng tsconfig |
| Tailwind v4 + shadcn theme setup | Low-Med | Theo official docs https://ui.shadcn.com/docs/tailwind-v4. Test với 1-2 component đơn giản (Button) trước khi commit. Nếu stuck > 1h, fallback Tailwind v3.4. |
| shadcn component khác visual với UI hiện tại | Medium | Override theme tokens (CSS variables) để gần với palette cũ. Acceptance: side-by-side compare login + board page trước/sau. |
| Port Toast undo logic sang Sonner lỡ break | Medium | Smoke test luồng PR #56 (assign → undo) ngay sau swap. Có thể giữ ToastContainer custom trong Phase 2 nếu cần thêm thời gian. |
| Bundle size tăng vì Radix primitives | Low | Radix tree-shake per primitive (~5-10KB mỗi cái). Lazy load page bù lại nhiều hơn. Diff check ở Phase 5. |

---

## 6. Open Questions cho User

Trước khi sang Phase 1, cần xác nhận:

1. **Timeline kỳ vọng**? 4-6 tuần part-time (1-2 giờ/ngày) hay sprint 2 tuần full-time?
2. **PR strategy**: chia nhỏ 15+ PR (review nhanh) hay batch theo phase (PR to)?
3. **`eslint-plugin-boundaries`** — thêm dependency này được không? (~50KB devDep, rất phổ biến)
4. **Bật `noUnusedLocals: true`** — chấp nhận có ~50-100 cleanup warning ban đầu không?
5. **Test coverage**: tạo smoke test với Playwright/Vitest **trước khi** refactor heavy (issue feature)? Đề xuất MẠNH: ít nhất Playwright cho 5 luồng quan trọng.
6. **shadcn theme palette**: dùng `Slate` (match neutral hiện tại) hay `Neutral` hay custom? Có thể quyết sau khi `npx shadcn init` chạy thử và preview.

**Đã chốt**:
- ✅ Design system: **shadcn/ui**
- ✅ Folder: `src/shared/ui/` flat
- ✅ Toast: swap sang **Sonner** trong Phase 2

---

## 7. Bugs Found (fix later, **không fix trong refactor PR**)

> Cập nhật mục này khi gặp bug trong quá trình refactor.

Phase 0 discovery chưa phát hiện bug rõ rệt. 2 điều đáng chú ý:

- **`tsconfig.app.json`**: `verbatimModuleSyntax: true` + `erasableSyntaxOnly: true` chặn enum & namespace. Nếu cần enum cho domain, dùng `as const` tuple thay thế.
- **`App.tsx:60`**: `useThemeStore.getState().initTheme()` trong `useEffect` empty-deps — OK nhưng có thể đẩy lên `app/providers/ThemeProvider`.

---

## 8. Success Criteria

Refactor được coi là thành công khi:

- [ ] 0 file `pages/*.tsx` > 150 LOC
- [ ] 0 file `features/*/components/*.tsx` > 300 LOC
- [ ] `src/components/` và `src/api/` flat folders bị xóa
- [ ] ESLint boundaries chạy clean
- [ ] Bundle size không tăng (lý tưởng giảm 20-40% nhờ lazy load — bù được phần Radix thêm vào)
- [ ] All 19 page render đúng (manual QA check)
- [ ] Không có bug regression mới
- [ ] Inline avatar count: **28 → 0** (tất cả dùng `<Avatar>` từ shadcn)
- [ ] Sonner thay thế ToastContainer + giữ nguyên Undo flow của PR #56
- [ ] Onboarding doc cập nhật: "logic assign issue ở đâu?" → trả lời được trong 30 giây

---

## 9. Next Step

1. **Bạn review file này**, trả lời mục [6. Open Questions](#6-open-questions-cho-user).
2. Sau khi confirm, mình bắt đầu **Phase 1** trên 1 PR riêng `refactor/web-skeleton`.
3. Sau Phase 1 build xanh, schedule các phase tiếp theo theo timeline đã thống nhất.
