# Plan: Public Timeline share link (passcode-gated, read-only)

> **Status**: 🟡 Draft — awaiting review, 2026-05-21. Ticket: [PM-60](https://pm.burningbros.kr/projects/PM/board?open=d29c59c5-2506-4afd-a01c-fd15e3eeb3de).
> **Domain**: `auth` (share JWT + guard), `issue` (public Timeline endpoint), `ui` (share dialog + public pages). MCP optional.
> **Tracks**: PM-60 "Public Timeline share link (passcode-gated, read-only)" — Client cần xem Timeline của project mà không có account BB PM. PM bấm **Share** → sinh link `https://pm.burningbros.kr/share/<token>` + passcode → gửi cho khách → khách nhập passcode → xem Timeline read-only.

> **Decisions locked (2026-05-21)**:
> - Scope Phase 1: **Timeline only** (schema `scopes[]` mở rộng Board/Calendar/Lists sau).
> - Link model: **Multiple links per project** (mỗi khách 1 link riêng + passcode riêng).
> - Public assignee: **name + avatar only**, không trả email/userId.
> - Expiry: **optional, default 90 ngày**.
> - JWT store FE: **sessionStorage** (tự clear khi đóng tab).

---

## 1. Requirement summary

- **What**:
  1. Thêm bảng `share_links` lưu link công khai cho 1 project, mỗi link có 1 passcode (bcrypt hash), optional expiry, scope (`TIMELINE` phase 1), trạng thái revoked + brute-force lockout.
  2. Backend mới `packages/api/src/share-link/` (tách khỏi `share/` hiện tại đang phục vụ OG unfurl).
  3. Endpoints: admin CRUD (PM↑), public unlock (passcode → share JWT), public timeline read.
  4. JWT riêng (`kind: "share"`) ký bằng `JWT_SHARE_SECRET` mới — `JwtAuthGuard` chính reject share JWT, `ShareAuthGuard` mới chỉ accept share JWT.
  5. FE: dialog "Share" trên Timeline (PM↑), trang public `/share/:token` (passcode form → shared timeline read-only), trang admin "Manage public share links".
- **Why**:
  - Hiện nay PM phải screenshot Timeline và gửi qua chat cho khách — data nhanh cũ, không scroll/zoom được, không thấy update.
  - Khách không thể (và không nên) có account BB PM full quyền: dữ liệu internal (comments, activity log, email người làm) là PII / nội bộ.
  - Multiple links per project cho phép audit per-client: revoke 1 khách không ảnh hưởng khác; access log per-link biết khách nào xem khi nào.
- **For whom**: PM (chính, người tạo + quản lý link), Admin (quản lý global), Client (người tiêu thụ link — không có account BB PM).

---

## 2. Affected services & files

### API (`@bb-pm/api`)

- **Schema** — [`packages/api/prisma/schema.prisma`](../../packages/api/prisma/schema.prisma):
  - Thêm `model ShareLink` (xem §3 Step 1).
  - Thêm `enum ShareScope { TIMELINE BOARD CALENDAR LISTS }` (chỉ dùng `TIMELINE` phase 1, các enum kia là chỗ đặt cho Phase 2).
  - Quan hệ: `Project.shareLinks ShareLink[]`, `User.createdShareLinks ShareLink[]`.
- **Migration** — `packages/api/prisma/migrations/<timestamp>_add_share_link/migration.sql`.
- **Module mới** — `packages/api/src/share-link/`:
  ```
  share-link/
    share-link.module.ts
    share-link.controller.ts        ← admin CRUD (auth: PM↑)
    share-link.public.controller.ts ← public routes (/api/public/share/*)
    application/
      create-share-link.use-case.ts
      revoke-share-link.use-case.ts
      rotate-passcode.use-case.ts
      unlock-share-link.use-case.ts
      get-public-timeline.use-case.ts
      ports/share-link.repository.ts
    infrastructure/
      share-link.prisma.repository.ts
    dto/
      create-share-link.dto.ts
      update-share-link.dto.ts
      unlock-share-link.dto.ts
    domain/
      share-link.entity.ts          ← lockout state machine (failedAttempts → lockedUntil)
    guards/
      share-auth.guard.ts           ← chấp nhận share JWT, reject main JWT
  ```
  - **Pattern bắt chước Issue module** (xem `packages/api/src/issue/issue.module.ts`) — Clean Architecture đã được áp dụng cho Issue/Project/JoinRequest, share-link nên theo cùng convention.
- **Public DTO mới** — `share-link/dto/public-timeline-issue.dto.ts`:
  - Chỉ chứa các field whitelist (xem §4). KHÔNG reuse `Issue` payload từ `IssueQueryService` để tránh accidental leak khi thêm field mới vào model.
- **Auth integration**:
  - [`packages/api/src/auth/auth.module.ts`](../../packages/api/src/auth/auth.module.ts): không đổi (giữ `JWT_SECRET` cho user auth).
  - [`packages/api/src/auth/strategies/jwt.strategy.ts`](../../packages/api/src/auth/strategies/jwt.strategy.ts): validate thêm `if (payload.kind === 'share') throw UnauthorizedException`. Defense-in-depth — share JWT không bao giờ pass main guard.
  - **New strategy** `share-link/strategies/share-jwt.strategy.ts` extending `PassportStrategy(Strategy, 'share-jwt')` — secret = `JWT_SHARE_SECRET`. Payload validate: `kind === 'share'`, `shareLinkId`, `projectId`, `scopes`, `exp`.
  - **New guard** `share-link/guards/share-auth.guard.ts` extending `AuthGuard('share-jwt')` — gắn lên public timeline endpoint (cùng decorator `@Public()` để bypass global `JwtAuthGuard`, rồi guard này tự verify share JWT).
- **Env** — `.env` + `packages/api/.env.example`:
  - `JWT_SHARE_SECRET` (required, **khác** `JWT_SECRET`).
  - `SHARE_JWT_EXPIRES_IN` (default `2h`).
  - `SHARE_LINK_PASSCODE_FAIL_THRESHOLD` (default `20`).
  - `SHARE_LINK_LOCKOUT_MINUTES` (default `60`).
- **app.module** — [`packages/api/src/app.module.ts`](../../packages/api/src/app.module.ts):
  - Import `ShareLinkModule`. Lưu ý: cùng tên gốc với `ShareModule` hiện hữu — đặt import sau ShareModule để giảm khả năng nhầm.
- **Tests**:
  - `share-link/application/create-share-link.use-case.spec.ts`
  - `share-link/application/unlock-share-link.use-case.spec.ts` — happy path, wrong passcode, lockout, expired, revoked.
  - `share-link/application/get-public-timeline.use-case.spec.ts` — verify whitelist (assignee không có email).
  - `share-link/domain/share-link.entity.spec.ts` — lockout state machine.

### Web (`@bb-pm/web`)

- **Routing** — [`packages/web/src/app/router/index.tsx`](../../packages/web/src/app/router/index.tsx):
  - Thêm 2 route **ngoài** `<AuthGuard>` (giống `/login`, `/register`):
    - `<Route path="/share/:token" element={<SharePasscodePage />} />`
    - `<Route path="/share/:token/timeline" element={<SharedTimelinePage />} />`
  - Không có sidebar/AppLayout (khách không cần thấy nav nội bộ).
- **Pages mới**:
  - `packages/web/src/pages/public/SharePasscodePage.tsx` — form passcode, call `POST /api/public/share/:token/unlock`, lưu `{ shareJwt, projectName, scopes, expiresAt }` vào `sessionStorage` (key: `bbpm.share.${token}`), navigate `/share/:token/timeline`.
  - `packages/web/src/pages/public/SharedTimelinePage.tsx` — đọc JWT từ sessionStorage; nếu missing → navigate về `/share/:token`. Hiển thị `TimelineView` với `mode="public"`.
- **Shared Timeline component**:
  - Approach: refactor [`packages/web/src/pages/TimelinePage.tsx`](../../packages/web/src/pages/TimelinePage.tsx) tách phần "render Timeline" thành `<TimelineView>` (header + LabelColumn + Chart + Tooltip), nhận prop `mode: 'internal' | 'public'` + `data: { project, issues }`.
  - `mode="public"`:
    - **Disable** drag-to-reschedule (không gọi mutation).
    - **Disable** filters write-back URL (filter chỉ in-memory).
    - Click vào row → mở **modal mini** (`PublicIssueModal`) chỉ hiển thị title/dates/status/assignee — **không** mở `IssueDetailPanel` (panel này pull comments/activity = leak nội bộ).
    - Toolbar bỏ "Assignee" filter (để tránh enumerate được toàn bộ assignee list qua tick boxes).
    - Header: tên project + "Shared by {creator name}" + nút "Logout" (clear sessionStorage, navigate `/share/:token`).
- **Public API client** — `packages/web/src/features/share-link/publicApi.ts`:
  - Axios instance riêng `axios.create({ baseURL: '/api/public' })`.
  - Interceptor: tự gắn `Authorization: Bearer <shareJwt>` đọc từ sessionStorage.
  - Catch 401/403 → clear sessionStorage và navigate `/share/:token` (re-enter passcode).
- **Share dialog (admin side)** — `packages/web/src/features/share-link/components/ShareLinkDialog.tsx`:
  - Trigger: nút "Share" trên TimelinePage toolbar (chỉ render khi user là PM/ADMIN của project).
  - Dialog content: input passcode (button "Generate" tạo random 8 ký tự alphanumeric), input expiry (date picker, default `+90d`, có checkbox "No expiry"), scope (Phase 1 chỉ tick TIMELINE, disabled).
  - Sau khi tạo: hiển thị URL + passcode + nút "Copy both" (clipboard format: "URL: ...\nPasscode: ..."). **Sau khi đóng dialog passcode không retrievable** (PM phải lưu chỗ khác — giống AWS Access Key UX).
  - Sử dụng shadcn `Dialog` primitive (xem [`packages/web/src/shared/ui/dialog.tsx`](../../packages/web/src/shared/ui/dialog.tsx)).
- **Manage page** — `packages/web/src/pages/project/ShareLinksPage.tsx` (route `/projects/:projectId/share-links`, mục Settings):
  - List tất cả share link của project (chỉ PM↑).
  - Cột: created (date+author), expiry, scopes, accessCount, lastAccessedAt, status (Active/Expired/Revoked/Locked).
  - Actions per row: Revoke (destructive — dùng `confirmDialog()` từ [`packages/web/src/shared/ui/confirm-dialog.tsx`](../../packages/web/src/shared/ui/confirm-dialog.tsx)), Rotate passcode (giống dialog tạo nhưng cập nhật), Copy URL.
- **Permission helper**:
  - Reuse existing `useProjectRole` (hoặc tương đương) — nếu chưa có, đọc `projectMember.role` từ ProjectRouteGate context.

### MCP (`@bb-pm/api/src/external` + `bbpm-internal-mcp`)

- **Phase 1**: KHÔNG bắt buộc. Skip mặc định.
- **Optional (PR4)**: nếu PM dùng agent để bulk-tạo link cho nhiều client một lúc, thêm:
  - `POST /api/external/projects/:projectKey/share-links` (mirror admin create endpoint, dùng API key auth thay vì JWT).
  - MCP tool `create_share_link({ projectKey, passcode?, expiresInDays? })` — trả về `{ url, passcode }`. Passcode được generate server-side nếu không truyền.
  - Update `docs/changelogs/mcp-changelog.md` + bump `@burningbrosdabi/bbpm-mcp` version.

### Tài liệu

- `docs/changelogs/auth-changelog.md` — entry mới: share JWT, ShareAuthGuard, env vars.
- `docs/changelogs/issue-changelog.md` — entry mới: public timeline endpoint, public issue DTO.
- `docs/changelogs/ui-changelog.md` — entry mới: SharePasscodePage, SharedTimelinePage, ShareLinkDialog, ShareLinksPage.
- `docs/changelogs/mcp-changelog.md` — chỉ khi làm PR4.
- `docs/ARCHITECTURE.md` — thêm mục §Share Link nếu §Module ownership matrix có format hỗ trợ (đọc trước, không cần ép vào nếu chưa có chỗ).

### DB Migration

- Tạo bảng `share_links` mới + enum `share_scope`.
- Không backfill — bảng trống ban đầu. Migration không destructive.
- Index: `(projectId)`, `(token)` (unique).

---

## 3. Proposed implementation (step by step)

### Step 1 — Schema (Prisma)

Thêm vào [`packages/api/prisma/schema.prisma`](../../packages/api/prisma/schema.prisma) ngay sau `model ProjectJoinRequest` (block các model thuộc project):

```prisma
enum ShareScope {
  TIMELINE
  BOARD     // reserved for Phase 2
  CALENDAR  // reserved for Phase 2
  LISTS     // reserved for Phase 2
}

model ShareLink {
  id              String       @id @default(uuid())
  token           String       @unique @db.VarChar(32)   // URL slug, 32 hex chars
  passcodeHash    String       @map("passcode_hash")     // bcrypt
  scopes          ShareScope[] @default([TIMELINE])

  expiresAt       DateTime?    @map("expires_at")
  revokedAt       DateTime?    @map("revoked_at")
  lastAccessedAt  DateTime?    @map("last_accessed_at")
  accessCount     Int          @default(0) @map("access_count")
  failedAttempts  Int          @default(0) @map("failed_attempts")
  lockedUntil     DateTime?    @map("locked_until")

  createdAt       DateTime     @default(now()) @map("created_at")
  updatedAt       DateTime     @updatedAt @map("updated_at")

  projectId       String       @map("project_id")
  project         Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)

  createdById     String       @map("created_by_id")
  createdBy       User         @relation("CreatedShareLinks", fields: [createdById], references: [id], onDelete: Restrict)

  @@index([projectId])
  @@map("share_links")
}
```

Add `shareLinks ShareLink[]` to `Project`, `createdShareLinks ShareLink[] @relation("CreatedShareLinks")` to `User`.

Generate migration: `pnpm --filter @bb-pm/api db:migrate:dev --name add_share_link`.

### Step 2 — Domain entity

`packages/api/src/share-link/domain/share-link.entity.ts`:

```typescript
export type LockoutResult =
  | { ok: true }
  | { ok: false; reason: 'EXPIRED' | 'REVOKED' | 'LOCKED' };

export class ShareLinkEntity {
  /** Returns whether the link is currently usable for unlock attempts. */
  static canUnlock(link: ShareLinkRow, now: Date): LockoutResult {
    if (link.revokedAt) return { ok: false, reason: 'REVOKED' };
    if (link.expiresAt && link.expiresAt < now) return { ok: false, reason: 'EXPIRED' };
    if (link.lockedUntil && link.lockedUntil > now) return { ok: false, reason: 'LOCKED' };
    return { ok: true };
  }

  /** Returns the new `failedAttempts` / `lockedUntil` after a failed try. */
  static recordFailure(
    link: ShareLinkRow,
    threshold: number,
    lockoutMs: number,
    now: Date,
  ): { failedAttempts: number; lockedUntil: Date | null } {
    const failedAttempts = link.failedAttempts + 1;
    const lockedUntil = failedAttempts >= threshold ? new Date(now.getTime() + lockoutMs) : null;
    return { failedAttempts, lockedUntil };
  }
}
```

Test: `share-link.entity.spec.ts` covering — expiry boundary, lockout threshold (19 → null, 20 → lockedUntil), already-locked vs unlocked.

### Step 3 — Repository port + Prisma impl

`share-link/application/ports/share-link.repository.ts`:

```typescript
export const SHARE_LINK_REPOSITORY = Symbol('SHARE_LINK_REPOSITORY');

export interface ShareLinkRepository {
  create(input: CreateShareLinkInput): Promise<ShareLinkRow>;
  findByToken(token: string): Promise<ShareLinkRow | null>;
  findById(id: string): Promise<ShareLinkRow | null>;
  findByProject(projectId: string): Promise<ShareLinkRow[]>;
  recordSuccess(id: string, now: Date): Promise<void>;
  recordFailure(id: string, failedAttempts: number, lockedUntil: Date | null): Promise<void>;
  revoke(id: string, now: Date): Promise<void>;
  rotatePasscode(id: string, passcodeHash: string): Promise<void>;
}
```

`share-link/infrastructure/share-link.prisma.repository.ts` — straight Prisma mapping, no domain logic.

### Step 4 — Use cases

| Use case | Inputs | Validation | Side effects |
|---|---|---|---|
| **CreateShareLinkUseCase** | `{ projectId, creatorId, passcode, scopes[], expiresAt? }` | passcode length 6-64; project exists; creator is PM↑ (enforced at controller via RolesGuard); `scopes` not empty, only TIMELINE in Phase 1 (controller-level enum filter) | Generate 32-hex token via `crypto.randomBytes(16).toString('hex')`; bcrypt hash passcode (cost 10); insert row. |
| **UnlockShareLinkUseCase** | `{ token, passcode, ip }` | Token exists; canUnlock; bcrypt compare | On success: bump `accessCount`, set `lastAccessedAt`, reset `failedAttempts`, sign share JWT. On failure: bump `failedAttempts`, maybe set `lockedUntil`. Both paths: log to debug. |
| **GetPublicTimelineUseCase** | `{ shareLinkId, projectId }` (from JWT) | Re-check link validity (revoked / expired) at every read — JWT alone doesn't trust client | Query issues via `IssueQueryService.findAll(projectId, { limit: 200 })` then map to `PublicIssueDto`. |
| **RevokeShareLinkUseCase** | `{ id, actorId }` | Actor is PM↑ on the link's project (RolesGuard at controller) | Set `revokedAt = now()`. |
| **RotatePasscodeUseCase** | `{ id, newPasscode, actorId }` | Same as create | Update `passcodeHash`, reset `failedAttempts` + `lockedUntil`. |

`UnlockShareLinkUseCase` is the only use case with security-critical state; cover with unit tests:
- happy path → returns JWT with correct claims
- wrong passcode → `failedAttempts++`
- 20th wrong → `lockedUntil` set, returns 401
- locked + correct passcode → returns 423 (Locked) without leaking that the passcode was correct
- expired link → 410 Gone
- revoked → 410 Gone

### Step 5 — Share JWT strategy + guard

`share-link/strategies/share-jwt.strategy.ts`:

```typescript
@Injectable()
export class ShareJwtStrategy extends PassportStrategy(Strategy, 'share-jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SHARE_SECRET')!,
    });
  }

  validate(payload: SharePayload): SharePayload {
    if (payload.kind !== 'share')
      throw new UnauthorizedException('Not a share token');
    return payload;
  }
}
```

`share-link/guards/share-auth.guard.ts`: `AuthGuard('share-jwt')`.

Defense-in-depth — patch [`packages/api/src/auth/strategies/jwt.strategy.ts`](../../packages/api/src/auth/strategies/jwt.strategy.ts):
```typescript
validate(payload: { sub: string; email: string; kind?: string }): JwtPayload {
  if (payload.kind === 'share')
    throw new UnauthorizedException('Share token cannot access internal API');
  return { sub: payload.sub, email: payload.email };
}
```

### Step 6 — Controllers

**Admin controller** `share-link/share-link.controller.ts` (mounted at `/api/projects/:projectId/share-links`, global `JwtAuthGuard` applies):

| Method | Path | Guard | Body |
|---|---|---|---|
| POST | `/` | `RolesGuard` + `@Roles(ADMIN, PM)` | `CreateShareLinkDto` |
| GET | `/` | `RolesGuard` + `@Roles(ADMIN, PM)` | — |
| PATCH | `/:id/rotate-passcode` | same | `{ newPasscode }` |
| PATCH | `/:id/revoke` | same | — |
| DELETE | `/:id` | `@Roles(ADMIN)` (PM revokes via PATCH; only ADMIN hard-deletes) | — |

**Public controller** `share-link/share-link.public.controller.ts` (mounted at `/api/public/share`, decorated `@Public()` so global `JwtAuthGuard` skips):

| Method | Path | Guard | Throttle | Body |
|---|---|---|---|---|
| POST | `/:token/unlock` | (none — public) | `@Throttle({ default: { ttl: 60_000, limit: 5 } })` per pattern in `auth.controller.ts:22` | `UnlockShareLinkDto` `{ passcode }` |
| GET | `/:token/project` | `ShareAuthGuard` + `@Public()` | global default | — |
| GET | `/:token/timeline` | `ShareAuthGuard` + `@Public()` | global default | — |

**Cross-checks in public controllers**:
- Verify `req.user.shareLinkId` resolves to a still-valid link (re-check revoke/expiry every request, not just at unlock).
- Verify path param `:token` matches the JWT's `shareLinkId` row (avoid mix-and-match: someone unlocks link A, then changes URL to link B with the same JWT → must reject).

### Step 7 — Public Issue DTO + whitelist mapper

`share-link/dto/public-timeline-issue.dto.ts`:

```typescript
export interface PublicTimelineIssue {
  id: string;
  number: number;
  title: string;
  type: 'DOMAIN' | 'EPIC' | 'TASK' | 'BUG' | 'SUB_TASK';
  status: IssueStatus;
  priority: IssuePriority;
  startDate: string | null;
  dueDate: string | null;
  parentId: string | null;
  assignee: { name: string; avatar: string | null } | null;
  labels: Array<{ name: string; color: string }>;
}
```

Mapper `share-link/application/to-public-timeline-issue.ts` — takes Prisma row from `IssueQueryService.findAll`, drops every field not in the interface. **Pure function, unit-tested**.

Public project endpoint returns:
```typescript
{ key: string, name: string, sharedByName: string, scopes: ShareScope[], expiresAt: string | null }
```
KHÔNG trả: project id (UUID), creator email, member list, GitHub integration, Slack config.

### Step 8 — Web: public pages + dialog

1. **Refactor TimelinePage** — extract `TimelineView` component receiving `{ project, issues, mode, onIssueClick }`. `TimelinePage` stays the internal entry point and passes `mode="internal"`. Estimate: ~150 LOC moved, no behavior change on existing route.
2. **`SharePasscodePage`** — single passcode input, submit → `POST /api/public/share/:token/unlock` → store JWT + meta in sessionStorage → navigate.
3. **`SharedTimelinePage`** — reads sessionStorage, calls `GET /api/public/share/:token/project` and `/timeline`, renders `<TimelineView mode="public" />` with a small header (project name + "Shared by …" + Logout).
4. **`PublicIssueModal`** — read-only popup showing the whitelisted fields only. Re-uses shadcn Dialog. No "Edit", no comments tab, no activity tab.
5. **`ShareLinkDialog`** — modal triggered from TimelinePage toolbar "Share" button (gated by `useProjectRole(projectId) >= 'PM'`). Two states: create form → result panel with copyable URL + passcode (one-shot reveal).
6. **`ShareLinksPage`** + nav entry — list under Settings.

### Step 9 — Tests + smoke

- **API** unit + integration:
  - `pnpm --filter @bb-pm/api test` — all new `.spec.ts` files.
  - `pnpm --filter @bb-pm/api test:e2e` — verify the e2e bootstrap still passes (app.module wires).
- **Manual smoke**:
  - Create link as PM → copy URL → open incognito → enter passcode → see Timeline.
  - Wrong passcode 20× → link locked → correct passcode rejected with 423.
  - Revoke from manage page → public URL returns 410.
  - Try to use share JWT against `/api/projects/:id/issues` → 401 (kind check).
  - Try main user JWT against `/api/public/share/:token/timeline` → 401 (ShareAuthGuard rejects non-share kind).
- **Lint + build**:
  ```bash
  pnpm --filter @bb-pm/api lint
  pnpm --filter @bb-pm/api build
  pnpm --filter @bb-pm/web lint
  pnpm --filter @bb-pm/web build
  ```

### Step 10 — Changelog + commit

Mỗi PR cập nhật đúng file changelog tương ứng (xem §2 Tài liệu) trong **cùng commit** với code change — không cho phép split (per [`CLAUDE.md` §10](../../CLAUDE.md)).

---

## 4. API changes

### New endpoints (admin-side, under existing JWT auth)

```
POST    /api/projects/:projectId/share-links
        body: { passcode: string(6-64), scopes: ['TIMELINE'], expiresAt?: ISO date | null }
        response: { id, token, url, scopes, expiresAt, createdAt }
                  (passcode NOT returned)

GET     /api/projects/:projectId/share-links
        response: Array<{ id, token (last 6 chars only? full?), scopes, expiresAt,
                          revokedAt, lockedUntil, accessCount, lastAccessedAt,
                          createdBy: { name, avatar } }>

PATCH   /api/projects/:projectId/share-links/:id/rotate-passcode
        body: { newPasscode: string(6-64) }
        response: { id, rotatedAt }

PATCH   /api/projects/:projectId/share-links/:id/revoke
        response: { id, revokedAt }

DELETE  /api/projects/:projectId/share-links/:id    (ADMIN only)
        response: 204
```

### New endpoints (public, no JWT)

```
POST    /api/public/share/:token/unlock
        body: { passcode: string }
        success: { shareJwt, projectKey, projectName, sharedByName, scopes,
                   expiresAt }   ← 200
        wrong passcode: 401     ← do NOT distinguish "bad passcode" vs "unknown token"
        locked: 423             ← Retry-After: seconds-until-unlock
        expired/revoked: 410 Gone
        rate-limited: 429       ← 5/min/IP via @Throttle

GET     /api/public/share/:token/project
        header: Authorization: Bearer <shareJwt>
        response: { key, name, sharedByName, scopes, expiresAt }

GET     /api/public/share/:token/timeline
        header: Authorization: Bearer <shareJwt>
        response: { issues: PublicTimelineIssue[] }
```

### Field whitelist (public timeline issue)

| Field | Source | Public? |
|---|---|---|
| `id`, `number`, `title` | Issue | ✅ |
| `type`, `status`, `priority` | Issue | ✅ |
| `startDate`, `dueDate` | Issue | ✅ |
| `parentId` | Issue | ✅ (cần để dựng cây Epic/Domain) |
| `assignee.name`, `assignee.avatar` | Issue.assignee | ✅ |
| `labels[].name`, `labels[].color` | Issue.labels | ✅ |
| `assignee.email`, `assignee.id` | Issue.assignee | ❌ |
| `creator`, `reviewerAssignee` | Issue | ❌ |
| `description` | Issue | ❌ |
| `comments`, `activities`, `attachments` | relations | ❌ |
| `source`, `isRecheck`, `archivedAt`, `order`, `focusDate` | Issue | ❌ |
| `_count` | meta | ❌ |
| `components` | Issue.components | ❌ (Phase 2 có thể bật) |

### Bypassing path — main API stays untouched

- Tất cả endpoint hiện hữu (`/api/projects/:projectId/issues/*`, `/api/projects/:projectId/comments/*`, …) **không cần đổi**. Public surface là tách riêng dưới `/api/public/share/*`.
- Global `JwtAuthGuard` reject share JWT (kind check) → khách hàng có thể coi như attacker nếu thử dùng share JWT vào endpoint internal — luôn 401.

---

## 5. UI / UX changes

| # | Vị trí | Thay đổi |
|---|---|---|
| 1 | Timeline toolbar | Thêm nút **Share** (icon `Share2` từ lucide), render khi `role >= PM`. Click → mở `ShareLinkDialog`. |
| 2 | New page `/share/:token` | Centered card 480px max-width: project name placeholder ("Loading…" → name từ response), password input, "Unlock" button. Error states: wrong passcode (inline), locked (countdown), expired/revoked (terminal). |
| 3 | New page `/share/:token/timeline` | Full-screen Timeline (no AppLayout sidebar, no internal nav). Top bar slim: project name, "Shared by {creator}", expiry countdown ("Expires in 87 days"), Logout button. |
| 4 | New modal `PublicIssueModal` | 360px width. Title + status pill + priority chip. Dates (start → due). Assignee row (avatar + name only). Labels. **No** description, comments, activity. |
| 5 | New page `/projects/:projectId/share-links` | Settings → "Public share links" tab. Table: Created | Created by | Scopes | Expires | Last accessed | Access count | Status | Actions. Actions: Rotate passcode (icon `KeyRound`), Revoke (icon `Ban`, destructive). |
| 6 | Settings sidebar | Add "Public share links" entry. |

**Recoverability**: passcode chỉ hiển thị 1 lần (UX giống AWS access key). PM phải tự lưu hoặc rotate khi quên. Lý do: lưu plaintext = đánh đổi security; rotate là cheap.

---

## 6. Risks & considerations

| # | Risk | Mitigation |
|---|---|---|
| 1 | **Brute-force passcode** | bcrypt (cost 10) + `@Throttle 5/min/IP/token` + lockout sau 20 fail trong window dài (`lockedUntil` = now+60min). Test: 100 attempts/min từ IP khác nhau vẫn fail vì lockout per-link không phải per-IP. |
| 2 | **JWT secret leak / reuse** | `JWT_SHARE_SECRET` tách riêng `JWT_SECRET` → leak share secret không ảnh hưởng user auth; leak user secret không cho phép tạo share JWT giả. Cả 2 strategy verify `kind` claim. |
| 3 | **JWT replay sau khi revoke** | Mỗi public read **re-fetch** ShareLink row và check `revokedAt`/`expiresAt` — JWT alone không đủ. JWT TTL 2h hạn chế window replay. Trade-off: thêm 1 query/read; OK với cap 200 issues/timeline. |
| 4 | **Data leak qua endpoint khác** | Tất cả public endpoints viết riêng dưới `/api/public/share/*`. Public DTO whitelist explicit, không reuse internal serializer. Test: gọi `/api/projects/:id/issues` với share JWT → expect 401. |
| 5 | **Token enumeration** | Token 32 hex chars = 128 bit entropy. `findByToken` only path; 404 cho cả "không tồn tại" lẫn "wrong passcode" (`/unlock` trả 401 trong cả 2 case) để không leak existence. |
| 6 | **Side-channel: timing attack passcode** | bcrypt compare là constant-time. Verify bằng vitest perf benchmark nếu cần (low priority). |
| 7 | **Khách share link với khách khác** | Acceptance — link là intended-shareable. Audit qua `accessCount` + IP/UA log (Phase 2 nếu PM cần). |
| 8 | **PM tạo link rồi quên revoke** | Default 90d expiry → auto-rotting. PM có thể tick "no expiry" nhưng UX hiện warning. |
| 9 | **Khách có thể xem các Project khác** | JWT chứa `projectId`, public timeline endpoint verify `:token` → `link.projectId` match path's project context. Không có route nào cho khách "chuyển project". |
| 10 | **Timeline fetch giới hạn 200** | Hiện `useTimelineData` cap 200 issues. Project lớn (>200 issues) sẽ truncate. Cùng vấn đề với internal Timeline → không phải regression. Có thể cần raise cap, nhưng out of scope của feature này. |
| 11 | **Khách screenshot data** | Không thể prevent — chấp nhận. Mitigation: PM kiểm soát expiry + revoke. |
| 12 | **Collision với module `share/` hiện hữu** | Đặt tên module `share-link/` (kebab) + class `ShareLinkModule` (Pascal). Public route prefix `/api/public/share` khác `/share/:issueKey` của module cũ. Path collision: `/share/:issueKey` (existing) vs `/share/:token` (new FE route) — đường vào KHÁC vì existing là **server-side** route trên main app (Express handler) còn new là **client-side route** trong React Router. Token format dài 32-hex sẽ không bao giờ match issue key (`PITB-12`). OK. |

---

## 7. Out of scope (Phase 2+)

- Share **Board** / **Calendar** / **Lists** views — chỉ cần thêm public endpoint tương ứng + bật scope. Schema `scopes[]` đã chuẩn bị.
- **Per-link granular permission** (chỉ share 1 Domain hoặc 1 Epic) — thêm field `scopeFilter: Json` (domainIds[], epicIds[]).
- **Per-user passcode** (mỗi khách 1 passcode khác nhau dưới 1 link) — phức tạp UX, đợi feedback.
- **Audit access log table** + email/Slack alert khi link bị truy cập lần đầu hoặc từ IP mới.
- **Embed iframe** (`<iframe>` BB PM trong site khách hàng) — cần CORS/CSP riêng.
- **Magic-link email** (PM nhập email khách → server gửi link + passcode tự động) — gắn với module Notification.
- **MCP tool `create_share_link`** — gộp vào PR4 optional.

---

## 8. Estimated effort

- **API**:
  - Schema + migration: ~25 LOC, 2 file.
  - Domain entity + spec: ~80 LOC.
  - Repository port + Prisma impl: ~120 LOC, 2 file.
  - Use cases (5) + specs: ~450 LOC.
  - Strategies + guards: ~80 LOC, 2 file.
  - Controllers (admin + public): ~150 LOC, 2 file.
  - DTOs (4): ~60 LOC.
  - Module wiring: ~25 LOC.
  - **API subtotal**: ~990 LOC.
- **Web**:
  - TimelinePage refactor → TimelineView (no behavior change): ~150 LOC moved.
  - SharePasscodePage: ~120 LOC.
  - SharedTimelinePage: ~80 LOC.
  - PublicIssueModal: ~60 LOC.
  - ShareLinkDialog: ~180 LOC.
  - ShareLinksPage + manage table: ~250 LOC.
  - Settings sidebar entry + routing: ~20 LOC.
  - publicApi axios instance + interceptors: ~50 LOC.
  - **Web subtotal**: ~910 LOC.
- **Tài liệu**: 3 changelog entry (+ MCP nếu PR4): ~60 LOC.
- **MCP (PR4 optional)**: ~80 LOC.

- **Tổng complexity**: **Medium-High**. Security-critical (passcode, JWT, lockout) → cần test coverage cao + manual smoke kỹ. Không animation phức tạp, không migration data.
- **Estimate**: **3-4 ngày dev + 0.5 ngày smoke/QA**. Chia 3 PR:
  - **PR1 (BE)** — schema + module + admin CRUD + public unlock + public timeline + tests. (~1.5 ngày)
  - **PR2 (FE-core)** — TimelineView refactor + SharePasscodePage + SharedTimelinePage + ShareLinkDialog. (~1 ngày)
  - **PR3 (FE-admin)** — ShareLinksPage + nav entry. (~0.5 ngày)
  - **PR4 (MCP, optional)** — `/api/external/projects/:projectKey/share-links` + tool. (~0.25 ngày)

---

## 9. Next step

**Awaiting user review**. Sau khi bạn duyệt plan, tôi sẽ:
1. Implement PR1 (BE) — schema + module + endpoints + tests, commit + push.
2. Implement PR2 (FE-core) — refactor TimelinePage + public pages + share dialog, commit + push.
3. Implement PR3 (FE-admin) — manage page, commit + push.
4. PR4 (MCP) — chỉ khi bạn confirm muốn.

Nếu có sửa scope hoặc decision nào (vd. raise field whitelist, đổi default expiry, gộp PR), bạn comment vào file này hoặc trả lời chat tôi update plan trước khi code.
