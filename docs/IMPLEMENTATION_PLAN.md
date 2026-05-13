# Implementation Plan — Burningbros PM System

> See PRD: [`docs/PRD.md`](./PRD.md)
> Stack: NestJS + Prisma 7 + React 19 + Vite + pnpm monorepo
> Goal: production deploy within 3 months

> **Historical planning document.** This is the **original 3-month roadmap** drafted at kickoff. Some decisions in here have since been revised (e.g., `RECHECK` status was later replaced by an `isRecheck` boolean; the WebSocket layer was deferred indefinitely; integrations not envisioned here — Slack standup bot, GitHub PR sync, Anthropic-powered quick-issue — were added later). For the **current state**, read [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) and the per-domain [`docs/changelogs/`](./changelogs/).

---

## Phase 1 — MVP (Weeks 1–4)

Core goal: login → pick a project → create and move issues on the kanban board.

---

### Step 1.1 — Monorepo & infra setup (early Week 1)

#### 1.1.1 Initialize pnpm workspace
```
project-management/
├── pnpm-workspace.yaml          # packages: ["packages/*"]
├── package.json                 # private: true, scripts (dev, build, lint)
├── .gitignore
├── .env.example
├── docker-compose.yml
├── Dockerfile.api
├── Dockerfile.web
└── packages/
    ├── api/
    ├── web/
    └── shared/
```

- `pnpm-workspace.yaml` → copy from BB_YT_AUTOMATION and adapt.
- Root `package.json` → workspace scripts (`dev:api`, `dev:web`, `build`, ...).

#### 1.1.2 Docker Compose (dev environment)

| Service | Image | Port |
|---------|-------|------|
| db | postgres:16-alpine | 5432 |
| api | node:22-alpine (dev: volume mount) | 3000 |
| web | node:22-alpine (dev: vite) | 5173 |

- Model the compose file on BB_YT_AUTOMATION's `docker-compose.yml`.
- PostgreSQL volume: `pgdata`.
- Env vars: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`.

#### 1.1.3 Initialize `shared` package

`packages/shared/src/constants/index.ts`:
- `IssueStatus` enum: `BACKLOG`, `TODO`, `IN_PROGRESS`, `REVIEW_QA`, `DONE`, `CANCELED`, `RECHECK`
- `IssuePriority` enum: `HIGH`, `MEDIUM`, `LOW`
- `IssueType` enum: `EPIC`, `TASK`, `BUG`, `SUB_TASK`
- `ProjectRole` enum: `ADMIN`, `PM`, `DEVELOPER`
- Display maps: `STATUS_LABELS`, `PRIORITY_LABELS`, ...

`packages/shared/src/types/index.ts`:
- `User`, `Project`, `Issue`, `Label`, `ProjectMember`, `Activity` interfaces.
- API response wrappers: `ApiResponse<T>`, `PaginatedResponse<T>`.

---

### Step 1.2 — NestJS backend init (late Week 1)

#### 1.2.1 Bootstrap NestJS

```bash
cd packages/api
nest new . --skip-git --package-manager pnpm
```

Key dependencies:
```
# Core
@nestjs/core @nestjs/common @nestjs/platform-express
@nestjs/config @nestjs/swagger

# Auth
@nestjs/passport @nestjs/jwt passport passport-jwt bcryptjs

# DB
prisma @prisma/client

# WebSocket (Phase 2)
@nestjs/websockets @nestjs/platform-socket.io socket.io

# Validation
class-validator class-transformer zod
```

#### 1.2.2 Write Prisma schema

`packages/api/prisma/schema.prisma` — write the full schema based on PRD §6.

Order:
1. `datasource` + `generator` blocks.
2. `User` model.
3. `Project` model.
4. `ProjectMember` (User ↔ Project many-to-many with `role`).
5. `Issue` model (self-relation: parent / children).
6. `Label` model.
7. `IssueLabel` (Issue ↔ Label many-to-many).
8. `Activity` model.
9. `ApiKey` model.

Migration: `npx prisma migrate dev --name init`.

#### 1.2.3 PrismaModule (global)

`src/prisma/prisma.service.ts`:
- `onModuleInit` → `$connect()`.
- `onModuleDestroy` → `$disconnect()`.
- `enableShutdownHooks()`.

`src/prisma/prisma.module.ts`:
- `@Global()` + `@Module({ providers: [PrismaService], exports: [PrismaService] })`.

#### 1.2.4 Common module (`common/`)

`src/common/decorators/`:
- `@CurrentUser()` — pulls `req.user`.
- `@Roles(...roles)` — sets metadata.
- `@Public()` — opts out of the JWT guard.

`src/common/guards/`:
- `JwtAuthGuard` — global JWT verification.
- `RolesGuard` — role check driven by `@Roles` metadata.
- `ProjectMemberGuard` — verifies the user is a member of the targeted project and (optionally) checks role.

`src/common/filters/`:
- `HttpExceptionFilter` — unified error response shape:
  ```json
  { "statusCode": 400, "message": "...", "error": "Bad Request" }
  ```

`src/common/dto/`:
- `PaginationDto` — `page`, `limit`, `sort`, `order`.
- Domain-specific `CreateDto`, `UpdateDto`.

`src/common/interceptors/`:
- `TransformInterceptor` — wraps responses as `{ data, meta }`.

---

### Step 1.3 — AuthModule (early Week 2)

#### 1.3.1 Files

| File | Responsibility |
|------|----------------|
| `auth.module.ts` | Register PassportModule, JwtModule |
| `auth.controller.ts` | `POST /login`, `POST /register`, `GET /me` |
| `auth.service.ts` | Login validation, registration, JWT issuance |
| `jwt.strategy.ts` | Convert JWT payload → user object |
| `dto/login.dto.ts` | `email`, `password` (class-validator) |
| `dto/register.dto.ts` | `email`, `password`, `name` |

#### 1.3.2 Logic

**`POST /auth/register`**
1. Check email is not in use.
2. Hash password with bcrypt (salt rounds: 12).
3. Create user.
4. Return JWT token.

**`POST /auth/login`**
1. Look up user by email.
2. Verify password with `bcrypt.compare`.
3. JWT payload: `{ sub: user.id, email: user.email }`.
4. Response: `{ access_token, user: { id, email, name, avatar } }`.

**JwtStrategy**
- `jwtFromRequest`: `ExtractJwt.fromAuthHeaderAsBearerToken()`.
- `validate(payload)` → fetch user via `PrismaService` → set on `req.user`.
- Expiry: `JWT_EXPIRES_IN` (default 8 hours).

**Register global guards** in `app.module.ts`:
```typescript
providers: [
  { provide: APP_GUARD, useClass: JwtAuthGuard },
  { provide: APP_GUARD, useClass: RolesGuard },
]
```
- Only endpoints decorated with `@Public()` skip the JWT check.

#### 1.3.3 Seed data
- Auto-create one Admin account (env vars `ADMIN_EMAIL`, `ADMIN_PASSWORD`).
- Implement in `prisma/seed.ts`.

---

### Step 1.4 — ProjectModule (late Week 2)

#### 1.4.1 Files

| File | Responsibility |
|------|----------------|
| `projects.controller.ts` | CRUD endpoints |
| `projects.service.ts` | Business logic |
| `dto/create-project.dto.ts` | `name`, `key`, `description?` |
| `dto/update-project.dto.ts` | `PartialType(CreateProjectDto)` |

#### 1.4.2 Logic

**`POST /projects`** (create)
1. Normalize `key` to uppercase alphanumeric (2–10 chars).
2. Check `key` uniqueness.
3. Create the project.
4. Auto-add the creator as an `ADMIN` `ProjectMember`.
5. Return `project` with `members`.

**`GET /projects`** (my project list)
1. Only return projects the current user is a member of.
2. Include each project's issue count and member count.
3. Sort by `updatedAt DESC`.

**`GET /projects/:key`** (detail)
- Guarded by `ProjectMemberGuard`.
- Include members + per-status issue counts.

**`PATCH /projects/:key`** (update)
- PM or above only.

**`DELETE /projects/:key`**
- Admin only.
- Cascade: child issues, labels, members, activity log.

---

### Step 1.5 — MemberModule (late Week 2)

#### 1.5.1 Endpoints

**`POST /projects/:key/members`** (add)
1. Look up target user by email.
2. Confirm not already a member.
3. Create `ProjectMember` (default role: `DEVELOPER`).

**`PATCH /projects/:key/members/:userId`** (change role)
- Admin only.
- Cannot change one's own role.

**`DELETE /projects/:key/members/:userId`** (remove)
- PM or above only.
- Cannot remove the last admin.

---

### Step 1.6 — IssueModule (Week 3)

The core module. Most complex — implement carefully.

#### 1.6.1 Files

| File | Responsibility |
|------|----------------|
| `issues.controller.ts` | CRUD + status change + bulk |
| `issues.service.ts` | Business logic |
| `dto/create-issue.dto.ts` | `title`, `description?`, `status?`, `priority?`, `type`, `assigneeId?`, `parentId?`, `labelIds?` |
| `dto/update-issue.dto.ts` | All fields optional |
| `dto/update-status.dto.ts` | `status`, `order` (for D&D) |
| `dto/query-issues.dto.ts` | Filter / sort / pagination DTO |
| `dto/bulk-update.dto.ts` | `issueIds[]`, fields to change |

#### 1.6.2 Logic

**`POST /projects/:key/issues`** (create)
1. Fetch the project's max `issue.number`.
2. `number = lastNumber + 1` (per-project auto-increment).
3. Fetch the max `order` in the target status column → `order = maxOrder + 1`.
4. Type validation:
   - `SUB_TASK` requires a `parentId`.
   - `EPIC` cannot have a `parentId`.
   - `TASK` can only have an `EPIC` as parent.
5. If `labelIds` provided, bulk-create `IssueLabel` rows.
6. Create activity row: `{ field: "created", newValue: title }`.

**`GET /projects/:key/issues`** (list)

Query params:
| Param | Type | Description |
|-------|------|-------------|
| status | string | Status filter (multiple: `status=TODO,IN_PROGRESS`) |
| priority | string | Priority filter |
| type | string | Issue-type filter |
| assigneeId | string | Assignee filter |
| parentId | string | Parent-issue filter |
| search | string | Title search (ILIKE) |
| page | number | Page (default: 1) |
| limit | number | Items per page (default: 50) |
| sort | string | Sort field (default: `order`) |
| order | asc / desc | Sort direction |

Response:
```json
{
  "data": [...issues],
  "meta": { "total": 120, "page": 1, "limit": 50, "totalPages": 3 }
}
```

**`PATCH /issues/:id`** (update)
1. Update only the supplied fields.
2. Emit one `Activity` row per changed field.
   - e.g. status change → `{ field: "status", oldValue: "TODO", newValue: "IN_PROGRESS" }`.
3. (Phase 2) WebSocket broadcast.

**`PATCH /issues/:id/status`** (status change — D&D only)
1. Called when a card is dragged on the kanban board.
2. Body: `{ status: "IN_PROGRESS", order: 3 }`.
3. Renormalize sibling `order` values in the destination column.
4. Emit activity row.
5. (Phase 2) WebSocket broadcast.

**Order renormalization algorithm**:
- Place the new `order` between the neighbors above and below the drop position.
- If integer gap is exhausted, renormalize the entire column to multiples of 100.
- Initial order values: 1000, 2000, 3000, ... (leave headroom).

**`DELETE /issues/:id`**
- PM or above only.
- Child issues' `parentId` set to `null` before delete.

---

### Step 1.7 — React frontend init (late Week 3)

#### 1.7.1 Create project

```bash
cd packages/web
pnpm create vite . --template react-ts
```

Key dependencies:
```
# Routing / state
react-router-dom zustand @tanstack/react-query axios

# UI
tailwindcss @radix-ui/react-dialog @radix-ui/react-select
@radix-ui/react-popover @radix-ui/react-checkbox
lucide-react class-variance-authority clsx tailwind-merge

# Forms
react-hook-form zod @hookform/resolvers

# Drag-and-drop
@hello-pangea/dnd

# Shared types
@bb-pm/shared (workspace:*)
```

#### 1.7.2 Base structure

**`services/api.ts`** (Axios instance)
- `baseURL: '/api/v1'` (set Vite proxy accordingly).
- Request interceptor: pull token from `localStorage` → `Authorization` header.
- Response interceptor: on 401 → clear token + redirect to `/login`.
- Pattern reference: BB_DEVTEAM Axios setup.

**`contexts/AuthContext.tsx`**
- Exposes `user`, `token`, `login()`, `logout()`, `isLoading`.
- On mount: `GET /auth/me` to verify the session.
- Reuse the BB_DEVTEAM pattern as-is.

**`App.tsx` routing**
```
<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route element={<ProtectedRoute />}>
    <Route element={<DashboardLayout />}>
      <Route path="/" element={<Navigate to="/projects" />} />
      <Route path="/projects" element={<ProjectsPage />} />
      <Route path="/projects/:key/board" element={<BoardPage />} />
      <Route path="/projects/:key/list" element={<ListPage />} />
      <Route path="/projects/:key/settings" element={<ProjectSettingsPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/settings/members" element={<MembersPage />} />
    </Route>
  </Route>
</Routes>
```

**`vite.config.ts` proxy**:
```typescript
server: {
  proxy: { '/api': 'http://localhost:3000' }
}
```

#### 1.7.3 Port UI components

Components to copy from BB_DEVTEAM / BB_YT_AUTOMATION:
- `Button.tsx`, `Input.tsx`, `Card.tsx`, `Badge.tsx`, `Table.tsx`.
- `cn()` utility (clsx + tailwind-merge).
- Tailwind config (color palette, fonts, etc.).

New components to build:
- `Select.tsx` (Radix Select).
- `Dialog.tsx` (Radix Dialog — modal base).
- `DropdownMenu.tsx` (Radix DropdownMenu).

---

### Step 1.8 — Core pages (Week 4)

#### 1.8.1 LoginPage
- Email/password form (React Hook Form + Zod).
- Call login API → store token → navigate to `/projects`.
- Show error messages.

#### 1.8.2 DashboardLayout
- Left sidebar (project list + settings link).
- Top header (current user + logout).
- Main content area (`<Outlet />`).

#### 1.8.3 ProjectsPage
- Project card grid (name, key, issue count, member avatars).
- "New Project" button → create-project modal (Dialog).
- TanStack Query: `useQuery(['projects'], fetchProjects)`.

#### 1.8.4 BoardPage (core)

**Data flow:**
```
useQuery(['issues', projectKey, filters])
  → GET /projects/:key/issues
  → group issues by status
  → render per column
```

**Component layout:**
```
BoardPage
├── BoardHeader (filter bar + "New Issue" button)
├── KanbanBoard (@hello-pangea/dnd DragDropContext)
│   ├── KanbanColumn (Droppable) × 7
│   │   ├── ColumnHeader (status name + count)
│   │   └── IssueCard (Draggable) × N
│   │       ├── TypeBadge
│   │       ├── PriorityIcon
│   │       ├── Title
│   │       ├── Labels
│   │       └── AssigneeAvatar
├── IssueCreateModal (Dialog)
└── IssueDetailPanel (side panel or Dialog)
```

**Drag-and-drop logic:**
1. `onDragEnd(result)` is fired.
2. `result.destination.droppableId` → new status.
3. `result.destination.index` → compute new `order`.
4. Optimistic update: reflect in UI immediately.
5. Call `PATCH /issues/:id/status`.
6. On failure, roll back to the previous state.

**Filter state (Zustand store):**
```typescript
interface BoardFilterStore {
  assigneeId: string | null;
  type: IssueType | null;
  priority: IssuePriority | null;
  search: string;
  setFilter: (key, value) => void;
  resetFilters: () => void;
}
```

#### 1.8.5 IssueCreateModal
- React Hook Form + Zod validation.
- Fields: title*, description, type, priority, initial status, assignee, parent issue.
- Assignee select: from project members.
- Parent-issue select: from the project's Epics / Tasks.
- On success → TanStack Query invalidate → board refetches automatically.

#### 1.8.6 IssueDetailPanel
- Opens as a right-side panel or modal when a card is clicked.
- Title: click to enter inline edit → blur or Enter triggers a PATCH.
- Status / priority / assignee: Radix Select → immediate PATCH on change.
- Description: textarea → blur triggers a PATCH.
- Child-issue list (read-only; clicking switches the panel to that issue).
- Labels display.
- Activity timeline (most recent 50 entries).

---

### Step 1.9 — Phase 1 checklist

- [ ] `docker-compose up` brings up the full environment.
- [ ] Register → login → token stored.
- [ ] Create project → appears in the list.
- [ ] Create issue → appears on the kanban board.
- [ ] Drag-and-drop → status persists.
- [ ] Click issue card → detail view / edit.
- [ ] Add member / change role.
- [ ] Per-role permissions enforced correctly.

---

## Phase 2 — Polish (Weeks 5–8)

---

### Step 2.1 — ListPage (early Week 5)

**Component layout:**
```
ListPage
├── ListHeader (filter bar + sort + "New Issue" button)
├── IssueTable
│   ├── TableHeader (column names + sort arrows)
│   ├── TableRow × N
│   │   ├── Checkbox (bulk select)
│   │   ├── Number (#)
│   │   ├── TypeBadge
│   │   ├── Title
│   │   ├── StatusBadge
│   │   ├── PriorityBadge
│   │   └── AssigneeAvatar
│   └── Pagination
├── BulkActionBar (appears at the bottom when issues are selected)
│   ├── "N items selected"
│   ├── StatusSelect (bulk status change)
│   ├── AssigneeSelect (bulk assignee change)
│   └── DeleteButton (PM+)
└── IssueDetailPanel
```

**Bulk actions:**
- Multi-select via checkboxes.
- Bulk-action bar at the bottom for batch changes.
- `PATCH /issues/bulk` → `{ issueIds: [...], status?: ..., assigneeId?: ... }`.

---

### Step 2.2 — LabelModule (late Week 5)

**Backend:**
- `GET /projects/:key/labels` — list project labels.
- `POST /projects/:key/labels` — create label (`name`, `color`).
- `PATCH /labels/:id` — update label.
- `DELETE /labels/:id` — delete label (cascade-delete `IssueLabel` rows).

**Frontend:**
- Add a label-management tab on `ProjectSettingsPage`.
- Label create: name input + color picker (8 presets + custom).
- Add a label multi-select to the issue create/edit modals.
- Render label badges on board cards and list rows.

**Default label presets** (auto-seeded on project create):
- `frontend` (#3B82F6), `backend` (#10B981), `mobile` (#8B5CF6), `bug` (#EF4444), `infra` (#6B7280), `qa` (#F59E0B).

---

### Step 2.3 — ActivityModule (early Week 6)

**Backend:**
- `ActivityService.log(issueId, userId, field, oldValue, newValue)` helper.
- Called automatically from `IssueService` `update` / `updateStatus`.
- Field-specific formatting:
  - `status`: enum → display label (`"TODO"` → `"To Do"`).
  - `assigneeId`: `userId` → user name.
  - `priority`: enum → display label.
- `GET /issues/:id/activities` — latest 100, newest first.

**Frontend:**
- Activity timeline at the bottom of the `IssueDetailPanel`.
- Each entry: `[user] changed [field] from [old] to [new] — [relative time]`.
- Relative time via `date-fns formatDistanceToNow`.

---

### Step 2.4 — Search & filter (late Week 6)

**Issue search:**
- Title search via Prisma `contains` (mode: insensitive).
- Combined filters: status + priority + type + assignee + label + search applied simultaneously.
- Sync with URL query params (filters survive back/refresh).

**Frontend:**
- Extract the filter bar into a shared component for board + list.
- Store filter state in a Zustand store.
- Two-way sync with URL `searchParams` (`useSearchParams` + Zustand).

---

### Step 2.5 — WebSocket live sync (Week 7)

#### Backend: IssuesGateway

`src/issues/issues.gateway.ts`:
```
@WebSocketGateway({ namespace: '/board', cors: true })
```

**Event flow:**
1. Client enters the board page → emits `join-project` with `projectId`.
2. Server joins the socket to `project:${projectId}` room.
3. On any issue change (create / update / delete / status change):
   - `IssueService` processes the change.
   - `IssuesGateway` broadcasts to the project room.
4. Client receives the event → updates the TanStack Query cache.

**Event payloads:**
```typescript
// issue-updated
{ issueId: string, changes: Partial<Issue>, updatedBy: string }

// issue-created
{ issue: Issue, createdBy: string }

// issue-deleted
{ issueId: string, deletedBy: string }
```

#### Frontend: useSocket hook

```typescript
function useProjectSocket(projectKey: string) {
  // Connect to Socket.io + join the room
  // issue-updated → queryClient.setQueryData (direct cache update)
  // issue-created → queryClient.invalidateQueries
  // issue-deleted → queryClient.setQueryData (remove)
}
```

**Caveats:**
- Ignore events triggered by the current user (avoid duplication with the optimistic update).
- If the socket fails to connect, fall back to polling (30s interval).

---

### Step 2.6 — API-key auth (late Week 7)

**Backend:**
- `ApiKeyGuard`: verifies the `X-API-Key` header.
- Update `JwtAuthGuard`: when no JWT is present, fall back to the API-key path.
- `POST /api/v1/auth/api-keys` — create an API key (Admin only).
- `GET /api/v1/auth/api-keys` — list my API keys.
- `DELETE /api/v1/auth/api-keys/:id` — delete an API key.

**Key generation:**
- `crypto.randomBytes(32).toString('hex')` → 64 chars.
- Store hash in the DB; return the raw key in the response only once.

**Example (from an AI system):**
```bash
curl -H "X-API-Key: bb_pk_abc123..." \
     -H "Content-Type: application/json" \
     -d '{"title": "New feature", "type": "TASK"}' \
     POST /api/v1/projects/GOOB/issues
```

---

### Step 2.7 — Issue detail side panel polish (Week 8)

Phase 1 built the basic form; Phase 2 levels it up:

- Description: markdown editor (live preview via `react-markdown`).
- Parent issue: changeable via a Select.
- Sub-tasks: "+" button to create a sub-task inline.
- Labels: multi-select with color badges.
- Assignee: avatar + name display, changeable via Select.
- Creator / created-at / updated-at meta info.
- Delete button (PM+, with confirmation Dialog).

---

### Step 2.8 — Phase 2 checklist

- [ ] List view works (sort / filter / pagination).
- [ ] Bulk actions (status / assignee).
- [ ] Label CRUD + issue-label assignment.
- [ ] Activity auto-recording + timeline display.
- [ ] WebSocket live sync (changes in another tab / user reflected).
- [ ] API-key creation + external API verified.
- [ ] All fields editable from the issue detail panel.
- [ ] URL-based filter persistence (back/refresh).

---

## Phase 3 — Stabilization & Expansion (Weeks 9–12)

---

### Step 3.1 — Project dashboard (Week 9)

**`GET /projects/:key/stats` endpoint:**
```json
{
  "statusCounts": { "BACKLOG": 12, "TODO": 8, "IN_PROGRESS": 5, ... },
  "priorityCounts": { "HIGH": 10, "MEDIUM": 15, "LOW": 3 },
  "typeCounts": { "EPIC": 3, "TASK": 20, "BUG": 5 },
  "assigneeCounts": [{ "userId": "...", "name": "...", "count": 8 }, ...],
  "recentActivity": [...],
  "completionRate": 0.65,
  "createdThisWeek": 12,
  "completedThisWeek": 8
}
```

**Frontend:**
- Stats cards on the project main view (top of the board, or a separate tab).
- Status donut chart (Recharts).
- Per-assignee issue-count bar chart.
- Weekly created/completed trend line chart.
- Recent-activity feed.

---

### Step 3.2 — Production Docker & deploy (Weeks 9–10)

#### `Dockerfile.api` (multi-stage)
```dockerfile
# Stage 1: Build
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/api/package.json packages/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile
COPY packages/shared packages/shared
COPY packages/api packages/api
RUN pnpm --filter @bb-pm/shared build
RUN pnpm --filter @bb-pm/api build
RUN pnpm --filter @bb-pm/api exec prisma generate

# Stage 2: Production
FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/packages/api/dist ./dist
COPY --from=builder /app/packages/api/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

#### `Dockerfile.web`
```dockerfile
FROM node:22-alpine AS builder
# ... build
RUN pnpm --filter @bb-pm/web build

FROM nginx:alpine
COPY --from=builder /app/packages/web/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

#### `docker-compose.prod.yml`
- `db`: PostgreSQL 16 + volume + healthcheck.
- `api`: built image + env + `depends_on: db`.
- `web`: nginx + upstream proxy to `api`.
- (Optional) `redis`: WebSocket adapter for multiple instances.

#### `nginx.conf`
```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  location /api/ {
    proxy_pass http://api:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";  # WebSocket support
  }

  location / {
    try_files $uri $uri/ /index.html;  # SPA fallback
  }
}
```

---

### Step 3.3 — Testing (Weeks 10–11)

#### Backend unit + integration tests (Jest)
- `AuthService`: login / register / token verification.
- `IssueService`: CRUD + status change + order renormalization.
- `ProjectService`: CRUD + member management.
- Guard tests: per-role access control.
- E2E tests: API flow verification via Supertest.

#### Frontend E2E tests (Playwright)
- Login → create project → create issue → drag-and-drop on the board → update issue → delete.
- Role-based permission tests (Developer attempts delete → fails).
- List-view filter / sort behavior.

---

### Step 3.4 — Jira data migration (Week 11)

Migration script (`scripts/migrate-from-jira.ts`):

**Target projects** (active only):
- D2, PLAYIN, GOOB, EC.

**Migration order:**
1. Jira projects → create `Project` rows (preserve `key`).
2. Jira members → create `User` rows + `ProjectMember` rows.
3. Jira Epics → create `Issue` rows of type `EPIC`.
4. Jira Tasks / Stories / Bugs → create `Issue` rows (parent: matching Epic).
5. Jira Sub-tasks → create `Issue` rows of type `SUB_TASK`.
6. Jira labels → create `Label` rows + `IssueLabel` mappings.

**Status mapping:**
| Jira | New system |
|------|------------|
| Backlog | BACKLOG |
| Selected for Development / To Do | TODO |
| In Progress | IN_PROGRESS |
| UI / API Ready / READY TO TEST / FINAL TESTING | REVIEW_QA |
| Done | DONE |
| CANCEL / CANCELED | CANCELED |
| RECHECK / RE-CHECK | RECHECK |

**Jira API access:** use Atlassian MCP or the REST API to pull data.

---

### Step 3.5 — Sprint feature (Week 12, optional)

Add in Phase 3 if there is time; otherwise defer.

**DB additions:**
- `Sprint` table: `id`, `name`, `projectId`, `startDate`, `endDate`, `status` (`PLANNING` / `ACTIVE` / `COMPLETED`).
- `Issue` gains a `sprintId` field.

**API additions:**
- `/projects/:key/sprints` — CRUD.
- `/sprints/:id/start` — start the sprint.
- `/sprints/:id/complete` — complete the sprint (unfinished issues → backlog).

**UI additions:**
- Sprint-select dropdown at the top of the board.
- Backlog view: drag unassigned issues into a sprint.

---

### Step 3.6 — Phase 3 checklist

- [ ] Production Docker build succeeds.
- [ ] `docker-compose.prod.yml` brings up all services.
- [ ] Project dashboard renders stats.
- [ ] Backend test coverage ≥ 70%.
- [ ] Playwright E2E covers the critical flows.
- [ ] Jira data migration script verified.
- [ ] Load test with 20 concurrent users passes.
- [ ] Production environment deployed.

---

## Appendix: Key Dependency Versions

### packages/api
```json
{
  "@nestjs/core": "^11",
  "@nestjs/common": "^11",
  "@nestjs/config": "^4",
  "@nestjs/swagger": "^8",
  "@nestjs/passport": "^11",
  "@nestjs/jwt": "^11",
  "@nestjs/websockets": "^11",
  "@nestjs/platform-socket.io": "^11",
  "prisma": "^7",
  "@prisma/client": "^7",
  "passport": "^0.7",
  "passport-jwt": "^4",
  "bcryptjs": "^2",
  "class-validator": "^0.14",
  "class-transformer": "^0.5",
  "socket.io": "^4"
}
```

### packages/web
```json
{
  "react": "^19",
  "react-dom": "^19",
  "react-router-dom": "^7",
  "zustand": "^5",
  "@tanstack/react-query": "^5",
  "axios": "^1",
  "tailwindcss": "^4",
  "@radix-ui/react-dialog": "^1",
  "@radix-ui/react-select": "^2",
  "@radix-ui/react-popover": "^1",
  "lucide-react": "^0.400",
  "class-variance-authority": "^0.7",
  "clsx": "^2",
  "tailwind-merge": "^2",
  "react-hook-form": "^7",
  "zod": "^3",
  "@hookform/resolvers": "^3",
  "@hello-pangea/dnd": "^17",
  "date-fns": "^3",
  "recharts": "^2",
  "socket.io-client": "^4"
}
```
