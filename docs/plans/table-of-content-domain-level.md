# Plan: Table of Content — bổ sung cấp **Domain** trên Epic

> **Status**: 🟢 In Progress — PR1 (BE) + PR2 (Web) implemented locally on `main` (uncommitted) 2026-05-21; awaiting commit + MCP server schema PR
> **Domain**: `issue`, `ui` (cập nhật cả hai changelog tương ứng)
> **Tracks**: ticket "Table of content, bổ sung Domain level, bao gồm nhiều Epic" — yêu cầu mở rộng issue hierarchy thêm một cấp gom các Epic theo module nghiệp vụ, hiển thị dưới dạng "mục lục" của dự án.
> **Đối chiếu input PM** (`Dhuman Internal` spreadsheet):
> - Cột **Module** (Authentication, User management, Membership level, Mileage, Deposit, Shipping policy, …) → cấp **Domain** (mới).
> - Cột **Features** (ID & Pass sign up/log in, Member list, …) → cấp **Epic** (đã có).

---

## 1. Requirement summary

- **What**:
  1. Thêm một cấp issue type mới `DOMAIN` đứng trên `EPIC` trong [`packages/api/src/issue/domain/issue-type.vo.ts:1`](../../packages/api/src/issue/domain/issue-type.vo.ts) và enum Prisma [`packages/api/prisma/schema.prisma:212`](../../packages/api/prisma/schema.prisma).
  2. Một `DOMAIN` chứa nhiều `EPIC` (qua field `parentId` sẵn có trên `Issue`).
  3. Xây dựng view **Table of Content** — trang mới ở sidebar BB PM hiển thị cây `Domain → Epic → Task` của project, dạng outline gấp/mở.
- **Why**:
  - Project đang chạy (PITB, Dhuman, …) có **hàng chục Epic phẳng** trong Board view (xem `SwimlaneBoardView.tsx`). Khi scope mở rộng (mỗi module ~5-10 Epic), Board scroll quá dài, PM khó nhìn tổng thể scope dự án.
  - PM hiện đang phải duy trì scope ngoài hệ thống (Google Sheet `Dhuman Internal`) vì BB PM chưa có cấp "module / domain". Mỗi lần thay đổi scope phải sync tay hai chỗ.
  - Một "table of content" giúp:
    - Onboard member mới — nhìn 1 trang là hiểu dự án có những mảng nghiệp vụ nào.
    - PM rà soát coverage — Domain nào còn thiếu Epic, Epic nào chưa có Task.
    - Báo cáo tiến độ theo module (cùng lúc gom nhiều Epic) — chuẩn bị cho dashboard giai đoạn sau.
- **For whom**: PM (chính), Developer & QA (tham khảo scope).

---

## 2. Affected services & files

### API (`@bb-pm/api`)
- **Schema** — [`packages/api/prisma/schema.prisma:212`](../../packages/api/prisma/schema.prisma):
  - Thêm `DOMAIN` vào enum `IssueType`.
  - Không cần model mới — `DOMAIN` là một `Issue` với `type = DOMAIN`, tận dụng `parentId` sẵn có cho hierarchy.
- **Domain** — [`packages/api/src/issue/domain/issue-type.vo.ts`](../../packages/api/src/issue/domain/issue-type.vo.ts):
  - `ISSUE_TYPES` thêm `'DOMAIN'`.
  - `validateTypeWithParent` thêm 2 rule:
    - `DOMAIN_CANNOT_HAVE_PARENT` — `DOMAIN` không có parent (top-level).
    - `EPIC_PARENT_MUST_BE_DOMAIN` — nếu `EPIC` có parent thì parent phải là `DOMAIN` (cho phép Epic không có parent để backward-compat trong giai đoạn migration).
  - Đổi rule `EPIC_CANNOT_HAVE_PARENT` (cũ ở line 31) thành "EPIC chỉ được có parent là DOMAIN".
- **Use cases** — [`packages/api/src/issue/application/create-issue.use-case.ts`](../../packages/api/src/issue/application/create-issue.use-case.ts) và [`update-issue.use-case.ts`](../../packages/api/src/issue/application/update-issue.use-case.ts):
  - Tham chiếu logic validate mới (vì hai use case đã gọi `validateTypeWithParent`).
  - Cập nhật mapping `formatHierarchyError` cho 2 mã lỗi mới.
  - Trong `update-issue.use-case.ts:92` ("auto-assign unassigned children if EPIC assignee changed"): cân nhắc mở rộng — khi assignee của `DOMAIN` đổi, có cascade sang các Epic con không? **Quyết định: không cascade** (Domain là khái niệm tổ chức, không có "owner" cố định). Giữ behavior cũ chỉ ở cấp Epic → Task.
- **Repository** — [`packages/api/src/issue/infrastructure/issue.prisma.repository.ts:101`](../../packages/api/src/issue/infrastructure/issue.prisma.repository.ts) (`fetchParentType`): không đổi signature, chỉ thêm `'DOMAIN'` vào union return type.
- **Read API mới** — `GET /api/v1/projects/:projectKey/table-of-content`:
  - Trả về tree `Domain[] → Epic[] → { id, title, status, taskCount, doneCount }`.
  - Đặt trong controller mới `packages/api/src/issue/issue.controller.ts` (hoặc tách `table-of-content.controller.ts` nếu cảm thấy clean hơn). Dùng `IssueRepository.findAll(projectId, { type: ['DOMAIN', 'EPIC'] })` + aggregate counts qua một query phụ.
- **Test**:
  - `issue.entity.spec.ts` — thêm case cho `DOMAIN`.
  - `create-issue.use-case.spec.ts` + `update-issue.use-case.spec.ts` — case: tạo Epic dưới Domain hợp lệ, tạo Domain dưới Domain bị reject, tạo Task trực tiếp dưới Domain bị reject.

### Web (`@bb-pm/web`)
- **Routing & sidebar** — sidebar (`packages/web/src/shared/layout/Sidebar.tsx` — chỗ chứa Home, Standup, Specs, Board, …):
  - Thêm mục **Table of Content** ngay **sau `Specs`, trước `Board`** (quyết định 2026-05-21 với PM — đặt cùng cụm "tài liệu / scope" sau Specs, trước các view thao tác hằng ngày).
  - Route `/projects/:projectKey/table-of-content`.
- **Page mới** — `packages/web/src/pages/TableOfContentPage.tsx`:
  - Fetch tree từ API mới.
  - Render outline (Domain header có thể collapse, Epic là sub-row, Task hiển thị inline count + progress bar). Mỗi Epic/Task click vào mở `IssueDetailPanel` sẵn có (`@/features/issue/components/detail`).
  - Action button "+ Domain" và "+ Epic dưới Domain X" — mở `CreateIssueModal` với `type` và `parentId` pre-fill.
- **Create issue** — [`packages/web/src/features/issue/components/CreateIssueModal.tsx`](../../packages/web/src/features/issue/components/CreateIssueModal.tsx):
  - Thêm option `Domain` vào `<select>` type.
  - Khi `type === 'EPIC'`: hiển thị thêm field "Parent Domain" (Select với danh sách Domain trong project). Optional (cho phép Epic floating khi migrate).
  - Khi `type === 'DOMAIN'`: ẩn field `parentId`.
- **Board** — [`packages/web/src/features/issue/components/board/SwimlaneBoardView.tsx`](../../packages/web/src/features/issue/components/board/SwimlaneBoardView.tsx) + [`BoardPage.tsx`](../../packages/web/src/pages/BoardPage.tsx):
  - Thêm filter chip "Domain" ở `BoardToolbar.tsx` — chọn Domain → chỉ hiện swimlane của các Epic thuộc Domain đó.
  - **Không** tự sinh swimlane lồng (Domain > Epic > columns) ở phase này — quá phức tạp về UX. Domain chỉ là filter.
- **Filter codec** — [`packages/web/src/shared/lib/filter-codec.ts`](../../packages/web/src/shared/lib/filter-codec.ts):
  - Thêm param `domain` (UUID, omitted when null) để filter Board / Issues / Timeline theo Domain.
- **Issue card / detail** — `IssueCard.tsx`, `IssueDetailPanel.tsx`:
  - Hiển thị breadcrumb `Domain ▸ Epic ▸ Task` trên detail panel (đầu Issue Detail).
- **Types** — [`packages/web/src/features/issue/api.ts`](../../packages/web/src/features/issue/api.ts):
  - `IssueType` thêm `'DOMAIN'`.
  - Thêm function `getTableOfContent(projectKey)`.
- **Icon / màu** — [`packages/web/src/shared/config/issue-type.ts`](../../packages/web/src/shared/config/issue-type.ts) (nếu có, hoặc nơi tương ứng):
  - Domain: icon 📁 hoặc Lucide `FolderOpen`, màu indigo (tách khỏi tím Epic).

### MCP (`@bb-pm/api/src/external` & MCP server)
- `create_issue`, `update_issue`, `list_issues`: schema input thêm `DOMAIN` vào enum type. Cập nhật `docs/changelogs/mcp-changelog.md`.

### Tài liệu
- [`docs/PRD.md:155-160`](../PRD.md) — cập nhật block hierarchy.
- [`docs/changelogs/issue-changelog.md`](../changelogs/issue-changelog.md) — entry "Added: DOMAIN issue type & Table of Content view".
- [`docs/changelogs/ui-changelog.md`](../changelogs/ui-changelog.md) — entry "Added: Table of Content page + Domain filter on Board".
- [`docs/changelogs/mcp-changelog.md`](../changelogs/mcp-changelog.md) — entry "Changed: DOMAIN added to issue type enum on MCP tools".
- [`docs/changelogs/external-api-changelog.md`](../changelogs/external-api-changelog.md) — entry "Added: GET /projects/:key/table-of-content".

### DB Migration
- Một migration Prisma duy nhất: `ALTER TYPE "IssueType" ADD VALUE 'DOMAIN';`
- Không có data backfill — Domain tạo thủ công bởi PM sau khi feature lên.

---

## 3. Proposed implementation (step by step)

### Step 1 — Domain layer (API)

1. Thêm `'DOMAIN'` vào `ISSUE_TYPES` ([`issue-type.vo.ts:1`](../../packages/api/src/issue/domain/issue-type.vo.ts)).
2. Mở rộng `HierarchyError`:
   ```ts
   export type HierarchyError =
     | 'DOMAIN_CANNOT_HAVE_PARENT'      // mới
     | 'EPIC_PARENT_MUST_BE_DOMAIN'     // mới (thay EPIC_CANNOT_HAVE_PARENT)
     | 'SUB_TASK_REQUIRES_PARENT'
     | 'PARENT_CANNOT_BE_SUB_TASK'
     | 'CANNOT_BE_OWN_PARENT'
   ```
3. Cập nhật `validateTypeWithParent`:
   ```ts
   if (type === 'DOMAIN' && parentId) return 'DOMAIN_CANNOT_HAVE_PARENT'
   if (type === 'EPIC' && parentId && parentType !== 'DOMAIN') return 'EPIC_PARENT_MUST_BE_DOMAIN'
   // (Epic không có parent vẫn hợp lệ — backward-compat)
   if (type === 'SUB_TASK' && !parentId) return 'SUB_TASK_REQUIRES_PARENT'
   if (parentId && ownId && parentId === ownId) return 'CANNOT_BE_OWN_PARENT'
   if (parentType === 'SUB_TASK') return 'PARENT_CANNOT_BE_SUB_TASK'
   return null
   ```
4. Cập nhật mapping lỗi trong `create-issue.use-case.ts` và `update-issue.use-case.ts`.

### Step 2 — DB & Repository

1. Migration: `pnpm --filter @bb-pm/api prisma migrate dev --name add_domain_issue_type`.
2. `fetchParentType` return type: thêm `'DOMAIN'`.
3. Thêm method `findTableOfContent(projectId)` trong `IssueRepository` port + Prisma adapter:
   ```ts
   findTableOfContent(projectId: string): Promise<{
     domains: Array<{
       id: string; title: string;
       epics: Array<{
         id: string; title: string; status: IssueStatus;
         taskCount: number; doneCount: number
       }>
     }>;
     orphanEpics: Array<{ id: string; title: string; status: IssueStatus; taskCount: number; doneCount: number }>  // Epic chưa gán Domain
   }>
   ```
   Implementation: 2 query — một lấy tất cả Issue `type IN (DOMAIN, EPIC)` của project; một `groupBy` count Task theo `parentId IN (epicIds)` để gắn `taskCount` / `doneCount`. Tránh N+1.

### Step 3 — Controller & API

1. Thêm endpoint `GET /api/v1/projects/:projectKey/issues/table-of-content` (đặt cùng `IssueController` cho gần các route khác).
2. Guard: `JwtAuthGuard + ProjectMemberGuard` như các endpoint Issue khác.
3. Response shape khớp với type ở Step 2.

### Step 4 — MCP tool surface

1. `create_issue` / `update_issue` / `list_issues`: thêm `DOMAIN` vào schema type enum.
2. Thêm tool mới `get_project_table_of_content(projectKey)` — gọi cùng endpoint trên. Để agent có thể "đọc mục lục dự án" mà không phải fetch hàng trăm issue.

### Step 5 — Web UI

1. **Types**:
   - Mở rộng `IssueType` ở `features/issue/api.ts`.
   - Thêm `getTableOfContent(projectKey)` gọi endpoint mới.
2. **Sidebar**: thêm item `Table of Content` (icon Lucide `ListTree`).
3. **Page** (`pages/TableOfContentPage.tsx`):
   - Layout 2 cột: trái — sticky outline cây Domain → Epic (click scroll xuống); phải — panel chi tiết Domain được chọn (gồm list Epic + progress bar tổng hợp).
   - Action "+ Add Domain" ở header; "+ Add Epic" inline trong mỗi Domain card.
   - Section riêng "Unassigned Epics" — list các Epic chưa có Domain (giúp PM migrate dần).
4. **CreateIssueModal**:
   - Type select gồm: `Domain | Epic | Task | Bug | Sub-task`.
   - Conditional field "Parent": ẩn nếu Domain, là Domain-select nếu Epic, là Epic-or-Task-select nếu Task/Bug, là Task-select nếu Sub-task.
5. **Board**:
   - Thêm `domainId` vào `FilterState` + codec.
   - `BoardToolbar.tsx`: dropdown Domain (sau dropdown Epic-owner).
   - Khi `domainId` set → `SwimlaneBoardView` chỉ render swimlane có `epic.parentId === domainId`.
6. **Detail panel breadcrumb**:
   - Đầu `IssueDetailPanel` hiển thị `Module ▸ Epic ▸` (link). Reuse logic fetch parent chain (Issue có sẵn `parent`).

### Step 7 — Bulk-assign Domain (in scope Phase 1)

1. **API mới** — `PATCH /api/v1/projects/:projectKey/issues/bulk-set-parent`:
   - Body: `{ issueIds: string[], parentId: string | null }`.
   - Validate: tất cả `issueIds` phải `type = EPIC`, `parentId` (nếu khác null) phải `type = DOMAIN` trong cùng project.
   - Một transaction Prisma `updateMany`. Activity entry gộp: tạo 1 entry per issue nhưng dùng cùng `source` "BULK" để có thể group ở UI sau.
2. **UI – Issues page** ([`packages/web/src/pages/IssuesPage.tsx`](../../packages/web/src/pages/IssuesPage.tsx)):
   - Khi filter `type = EPIC`: bật multi-select (checkbox cột đầu).
   - Toolbar action "Set Module" (dropdown chọn Domain hoặc "None"). Confirm dialog hiển thị số Epic sẽ đổi.
3. **UI – Table of Content page** (section "Unassigned Epics"):
   - Mỗi row Epic có dropdown "Move to module…" inline. Multi-select + bulk action cùng pattern với Issues page.
4. **MCP tool mới** — `bulk_set_epic_module(projectKey, epicIds, domainId | null)` để agent / migration script gọi được.
5. **Test**:
   - Use-case test: reject nếu issueIds chứa non-Epic, parent không phải Domain, hoặc khác project.
   - Manual: chọn 10 Epic không có Domain → bulk-set Domain X → reload Table of Content, 10 Epic xuất hiện dưới Domain X.

### Step 8 — Tests

- API unit:
  - `issue.entity.spec.ts`: case Domain top-level, Epic-under-Domain, Domain-under-Domain reject, Task-under-Domain reject.
  - `create-issue.use-case.spec.ts` + `update-issue.use-case.spec.ts`: tương tự.
  - Repository test: query `findTableOfContent` trả về đúng shape, đúng counts.
- Web manual smoke (chưa có FE test runner):
  1. Tạo Domain → xuất hiện ở Table of Content + dropdown filter của Board.
  2. Tạo Epic chọn Parent Domain → Epic nằm dưới Domain trong Table of Content.
  3. Tạo Epic không chọn Parent → nằm trong "Unassigned Epics".
  4. Đổi Parent của Epic từ Domain A → B → Table of Content cập nhật.
  5. Lock: tạo Task với `parentId = <Domain id>` qua API → 400 `EPIC_PARENT_MUST_BE_DOMAIN` (sai message nhưng đúng hierarchy block — sửa text rõ hơn nếu cần).
  6. Board: chọn filter Domain → chỉ swimlane Epic thuộc Domain đó hiện ra.
  7. MCP: `create_issue(type='DOMAIN')` qua MCP server → tạo thành công.

---

## 4. API changes

### New endpoint
```
GET /api/v1/projects/:projectKey/issues/table-of-content
Auth: JWT + ProjectMemberGuard

Response 200:
{
  "domains": [
    {
      "id": "uuid",
      "title": "Authentication",
      "epics": [
        { "id": "uuid", "title": "ID & Pass sign up/log in", "status": "IN_PROGRESS", "taskCount": 8, "doneCount": 3 },
        ...
      ]
    },
    ...
  ],
  "orphanEpics": [
    { "id": "uuid", "title": "Product Listing", "status": "BACKLOG", "taskCount": 6, "doneCount": 0 }
  ]
}
```

### Changed endpoints
- `POST /api/v1/projects/:projectKey/issues` — body `type` enum thêm `DOMAIN`. Mới: error code `EPIC_PARENT_MUST_BE_DOMAIN` (400) thay `EPIC_CANNOT_HAVE_PARENT`.
- `PATCH /api/v1/issues/:id` — tương tự.
- `GET /api/v1/projects/:projectKey/issues?type=DOMAIN` — đã work qua filter sẵn có (chỉ là enum mới hợp lệ).

### MCP
- `create_issue.type`, `update_issue.type`, `list_issues.type` enum thêm `DOMAIN`.
- Tool mới `get_project_table_of_content(projectKey)`.
- Tool mới `bulk_set_epic_module(projectKey, epicIds, domainId | null)` (bulk-assign).

### Bulk-assign endpoint
```
PATCH /api/v1/projects/:projectKey/issues/bulk-set-parent
Auth: JWT + ProjectMemberGuard (PM↑ vì là mutation hàng loạt)

Body: { "issueIds": ["uuid", ...], "parentId": "uuid" | null }
Response 200: { "updatedCount": number }
Errors: 400 nếu issueIds có non-Epic / khác project / parentId không phải Domain.
```

---

## 5. UI / UX changes

| # | Where | Change |
|---|---|---|
| 1 | Sidebar | Thêm "Table of Content" **sau Specs, trước Board**. |
| 2 | Trang mới | `/projects/:key/table-of-content` — outline Domain → Epic + counters. |
| 3 | `CreateIssueModal` | Type select có `Domain`; field Parent đổi behavior theo type. |
| 4 | `BoardToolbar` | Dropdown filter Domain (đa-chọn 1, hoặc "All"). |
| 5 | `IssueDetailPanel` | Breadcrumb Domain ▸ Epic ▸ Title. |
| 6 | Issue card | Badge nhỏ "Module name" bên cạnh badge Epic (chỉ khi card là Task/Bug và Epic đã có Module). |
| 7 | Issue type icon | Domain (label = "Module") dùng icon `FolderOpen` (Lucide), màu indigo. |
| 8 | Issues page | Khi filter `type = EPIC`: bật multi-select + toolbar action "Set Module" (bulk-assign). |
| 9 | TOC page | Section "Unassigned Epics" có multi-select + "Move to module…" inline. |

---

## 6. Risks & considerations

| # | Risk | Mitigation |
|---|---|---|
| 1 | Project hiện có hàng trăm Epic không có Domain → "Unassigned Epics" section sẽ rất dài, khó migrate. | **Trong scope Phase 1**: bulk-assign Domain trên trang Issues (multi-select Epic → action "Set Parent Domain") và trên section "Unassigned Epics" ngay trong Table of Content page. Xem Step 7 ở §3. |
| 2 | Existing API client / agent gửi `type: 'EPIC'` không kèm `parentId` vẫn phải hoạt động (backward-compat). | Rule mới chỉ reject khi Epic CÓ parent và parent KHÔNG phải Domain. Epic không có parent vẫn hợp lệ. |
| 3 | Migration enum Postgres — `ADD VALUE` không reversible trong cùng transaction. | Migration thuần ALTER TYPE, không backfill. Rollback chỉ bằng cách rename trong follow-up migration nếu cần (Prisma đã có pattern). |
| 4 | Khi đổi Domain của Epic → mọi child Task vẫn thuộc Epic đó, không cần touch. | `parentId` của Task không thay đổi; chỉ `epic.parentId` thay. Cascade-safe. |
| 5 | MCP server cũ (đã deploy) chưa hiểu `DOMAIN` → trả về lỗi khi list. | MCP schema mở rộng enum (additive), không phá tool cũ. Deploy MCP cùng commit với API. |
| 6 | Filter URL có thêm `domain=` → dài hơn. | Tuân theo codec rule sẵn có: omit khi null. Không ảnh hưởng URL ngắn. |
| 7 | Activity feed bị spam khi PM gán Parent Domain cho hàng chục Epic cùng lúc. | Bulk-edit (nếu làm) batch activity entries (gộp 1 activity / nhiều issue) — follow-up. |
| 8 | Tên `DOMAIN` dễ nhầm với "domain layer" trong clean-architecture của codebase. | **Quyết định 2026-05-21**: enum trong code & API giữ tên `DOMAIN`; UI label luôn hiển thị "Module" (sidebar, modal, breadcrumb, badge). Comment ngay tại `issue-type.vo.ts` ghi rõ rationale. |

---

## 7. Out of scope

- **Domain-level dashboard / progress aggregate** — số liệu burndown ở cấp Domain. Phase tiếp theo, gắn với module Dashboard.
- **Domain-level permission** — gán PM lead cho từng Domain. Hiện vẫn permission cấp Project.
- **Nested Domain (Domain trong Domain)** — không hỗ trợ; tree luôn 4 cấp: Domain → Epic → Task → Sub-task.
- **Tự suy ra Domain từ tên Epic bằng AI** — out, dù khả thi qua `AiCompletionPort`. Có thể là follow-up MCP tool.
- **Drag & drop Epic giữa Domain trên Table of Content page** — phase 1 chỉ dropdown "Parent" trong modal edit. DnD là follow-up.

---

## 8. Estimated effort

- **API**:
  - Domain layer + validate: ~50 LOC, 1 file.
  - Migration: 1 file Prisma generated.
  - Repository `findTableOfContent` + `bulkSetParent`: ~120 LOC.
  - Controller (TOC + bulk-set endpoint) + DTO: ~70 LOC.
  - Tests: ~250 LOC (5-6 file `.spec.ts`).
- **Web**:
  - `TableOfContentPage.tsx`: ~300-350 LOC (gồm bulk-assign UI cho "Unassigned Epics").
  - `CreateIssueModal` mở rộng: ~60 LOC delta.
  - `IssuesPage` multi-select + "Set Module" action: ~80 LOC.
  - Sidebar + routing: ~20 LOC.
  - Filter codec + Board filter: ~30 LOC.
  - Breadcrumb + icon: ~30 LOC.
- **MCP**: ~60 LOC (schema + 2 tool mới).
- **Docs**: 4 changelog entries + cập nhật PRD.
- **Tổng complexity**: **Medium-High**. Cross-module (DB → API → MCP → Web), đụng nhiều file UI; bulk-assign thêm ~1 ngày so với estimate trước.
- **Estimate**: ~3-4 ngày dev + 0.5 ngày test/migrate. Chia 2 PR:
  - **PR1**: API + DB + MCP (gồm cả endpoint bulk-set-parent).
  - **PR2**: Web (TOC page, modal, sidebar, board filter, Issues page bulk-assign).

---

## 9. Next step

**Awaiting user approval** → `/2-implement` cho PR1 trước (BE), sau đó PR2 (FE).
