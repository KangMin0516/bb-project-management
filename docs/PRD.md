# Burningbros Internal Project Management System — PRD

> **Historical planning document.** This PRD captures the **original product requirements** at project kickoff. Implementation has diverged in several places (e.g., `RECHECK` was refactored from a status into an `isRecheck` boolean; the WebSocket real-time layer is not yet built; integrations like Slack standup, GitHub PR sync, and the AI quick-issue capture were added after this PRD). For the **current state**, read [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) and the per-domain [`docs/changelogs/`](./changelogs/).
>
> This file is preserved as the originating "what we set out to build" artifact.

## 1. Overview

### Purpose
Build an in-house project management system to replace Jira.

### Core goals
- **Cost reduction**: remove Jira license cost.
- **Operational clarity**: for a 20-person team across 4 projects (4–5 people per project), make task assignment and progress tracking unambiguous.
- **AI-system integration**: REST API that lets our existing AI-based task-generation/planning systems read and write issues.

### Target users
- Burningbros internal PMs and engineers (~20 people).

### Target timeline
- Production launch within 3 months.

---

## 2. Tech Stack

| Area | Technology | Notes |
|------|------------|-------|
| **Backend** | NestJS + TypeScript | Production-grade: DI, modules, guards, interceptors |
| **ORM** | Prisma 7 | Type-safe, built-in migrations |
| **Database** | PostgreSQL 16 | Self-hosted |
| **Auth** | JWT (Passport) + bcrypt | NestJS Guard-based role management |
| **Frontend** | React 19 + Vite + TypeScript | Aligned with existing project patterns |
| **UI** | Tailwind CSS + Radix UI + Lucide Icons | Custom components |
| **State management** | Zustand + TanStack React Query | Separate client / server state |
| **Routing** | React Router DOM | SPA |
| **Forms / validation** | React Hook Form + Zod | Client-side validation |
| **Real-time** | WebSocket (Socket.io) | Live kanban board sync |
| **Monorepo** | pnpm workspaces | Following the BB_YT_AUTOMATION pattern |
| **Deployment** | Docker Compose on existing infra | Frontend: nginx, backend: Node |

---

## 3. Project Structure (pnpm monorepo)

```
project-management/
├── packages/
│   ├── api/                          # NestJS backend
│   │   ├── src/
│   │   │   ├── auth/                 # AuthModule
│   │   │   │   ├── auth.module.ts
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── jwt.strategy.ts
│   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   └── roles.guard.ts
│   │   │   ├── projects/             # ProjectModule
│   │   │   │   ├── projects.module.ts
│   │   │   │   ├── projects.controller.ts
│   │   │   │   └── projects.service.ts
│   │   │   ├── issues/               # IssueModule
│   │   │   │   ├── issues.module.ts
│   │   │   │   ├── issues.controller.ts
│   │   │   │   ├── issues.service.ts
│   │   │   │   └── issues.gateway.ts  # WebSocket (live board)
│   │   │   ├── labels/               # LabelModule
│   │   │   ├── members/              # MemberModule
│   │   │   ├── activities/           # ActivityModule
│   │   │   ├── common/               # Shared (decorators, pipes, filters, dto)
│   │   │   │   ├── decorators/
│   │   │   │   │   ├── roles.decorator.ts
│   │   │   │   │   └── current-user.decorator.ts
│   │   │   │   ├── filters/
│   │   │   │   │   └── http-exception.filter.ts
│   │   │   │   └── dto/
│   │   │   │       └── pagination.dto.ts
│   │   │   ├── prisma/               # PrismaModule (global)
│   │   │   │   ├── prisma.module.ts
│   │   │   │   └── prisma.service.ts
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── test/
│   │   └── package.json
│   │
│   ├── web/                          # React + Vite frontend
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ui/               # Shared UI (Button, Input, Card, Badge, Table, …)
│   │   │   │   ├── board/            # Kanban board components
│   │   │   │   ├── issue/            # Issue card, detail, create modal
│   │   │   │   ├── project/          # Project card, settings
│   │   │   │   └── layout/           # Sidebar, Header, Layout
│   │   │   ├── pages/                # Page components
│   │   │   ├── services/             # API client (Axios)
│   │   │   ├── stores/               # Zustand stores
│   │   │   ├── contexts/             # AuthContext
│   │   │   ├── hooks/                # useIssues, useProjects, …
│   │   │   ├── types/                # TypeScript types
│   │   │   ├── lib/                  # Utilities
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   └── package.json
│   │
│   └── shared/                       # Shared types / constants
│       ├── src/
│       │   ├── types/                # Issue, Project, etc. shared types
│       │   └── constants/            # Status, priority, etc. enums / constants
│       └── package.json
│
├── docker-compose.yml
├── docker-compose.prod.yml
├── Dockerfile.api
├── Dockerfile.web
├── pnpm-workspace.yaml
├── package.json
└── docs/
    └── PRD.md
```

---

## 4. Core Features

### 4.1 Project Management
- Project CRUD (create / read / update / delete).
- Per-project member management (invite, change role, remove).
- Project list and summary dashboard.

### 4.2 Issue Management

#### Issue types
| Type | Description |
|------|-------------|
| Epic | Large-scale feature / goal grouping |
| Task | Primary unit of work (the most common issue type) |
| Bug | Bug report |
| Sub-task | Sub-unit under a Task |

#### Issue fields
| Field | Type | Required |
|-------|------|----------|
| Title | text | Yes |
| Description | rich text | No |
| Status | enum | Yes |
| Priority | enum | Yes |
| Assignee | user | No |
| Labels | tag[] | No |
| Type | enum | Yes |
| Parent issue | relation | No |

#### Issue hierarchy
```
Domain (Module)
 └── Epic
      └── Task
           └── Sub-task
```

> `DOMAIN` was added 2026-05-21 as a top-level grouping above Epic — see
> [`docs/plans/table-of-content-domain-level.md`](./plans/table-of-content-domain-level.md).
> The enum is `DOMAIN` in code/API/DB; the UI labels it "Module" to avoid
> confusion with the "domain layer" in clean-architecture. Epics may
> exist without a Domain parent (backward-compat with pre-feature data).

### 4.3 Workflow (unified)

```
Backlog → To Do → In Progress → Review/QA → Done
                  │                          │
                  └──── CANCELED              │
                  │                          │
                  └──── RECHECK ─────────────┘
```

| Status | Category | Description |
|--------|----------|-------------|
| Backlog | To Do | Unscheduled |
| To Do | To Do | Scheduled to do |
| In Progress | In Progress | Work underway |
| Review/QA | In Progress | Under review or QA |
| Done | Done | Completed |
| Canceled | Done | Canceled |
| Recheck | In Progress | Needs recheck (QA → back to in-progress) |

- All status transitions are unrestricted (preserves Jira's current behavior).

### 4.4 Views

#### Kanban board
- Columns per status with issues as cards.
- Drag-and-drop to change status.
- **Live sync** (WebSocket: another user's changes appear immediately).
- Filters: assignee, label, priority, issue type.
- WIP (Work In Progress) count per column.

#### List view
- Tabular view of issues.
- Sort by: status, priority, created date, updated date.
- Filters: same as kanban.
- Bulk actions (status change, assignee assignment, etc.).

### 4.5 Roles & Permissions (3 tiers)

| Role | Permissions |
|------|-------------|
| Admin | System-wide settings, create/delete projects, invite members |
| PM | Project settings, create/update/delete issues, manage members |
| Developer | Create/update issues, change status on own issues |

NestJS implementation: `@Roles('ADMIN')` decorator + `RolesGuard` for per-endpoint access control.

### 4.6 AI-system Integration (REST API)
- External AI systems can perform issue CRUD through the REST API.
- API-key authentication (separate from Bearer JWT — uses an `X-API-Key` header).

---

## 5. API Design (v1)

Base URL: `/api/v1`

### Auth
| Method | Endpoint | Description | Guard |
|--------|----------|-------------|-------|
| POST | `/auth/login` | Login (JWT issuance) | Public |
| POST | `/auth/register` | Register | Public |
| GET | `/auth/me` | Current user info | JWT |

### Projects
| Method | Endpoint | Description | Guard |
|--------|----------|-------------|-------|
| GET | `/projects` | List my projects | JWT |
| POST | `/projects` | Create project | JWT |
| GET | `/projects/:key` | Project detail | JWT + Member |
| PATCH | `/projects/:key` | Update project | JWT + PM↑ |
| DELETE | `/projects/:key` | Delete project | JWT + Admin |

### Project Members
| Method | Endpoint | Description | Guard |
|--------|----------|-------------|-------|
| GET | `/projects/:key/members` | List members | JWT + Member |
| POST | `/projects/:key/members` | Add member | JWT + PM↑ |
| PATCH | `/projects/:key/members/:userId` | Change role | JWT + Admin |
| DELETE | `/projects/:key/members/:userId` | Remove member | JWT + PM↑ |

### Issues
| Method | Endpoint | Description | Guard |
|--------|----------|-------------|-------|
| GET | `/projects/:key/issues` | List issues (filter / paginate) | JWT + Member |
| POST | `/projects/:key/issues` | Create issue | JWT + Member |
| GET | `/issues/:id` | Issue detail | JWT |
| PATCH | `/issues/:id` | Update issue | JWT |
| DELETE | `/issues/:id` | Delete issue | JWT + PM↑ |
| PATCH | `/issues/:id/status` | Change status (for D&D; WebSocket broadcast) | JWT |
| PATCH | `/issues/bulk` | Bulk update | JWT + PM↑ |

### Labels
| Method | Endpoint | Description | Guard |
|--------|----------|-------------|-------|
| GET | `/projects/:key/labels` | List labels | JWT + Member |
| POST | `/projects/:key/labels` | Create label | JWT + PM↑ |
| PATCH | `/labels/:id` | Update label | JWT + PM↑ |
| DELETE | `/labels/:id` | Delete label | JWT + PM↑ |

### Activity Log
| Method | Endpoint | Description | Guard |
|--------|----------|-------------|-------|
| GET | `/issues/:id/activities` | Issue change history | JWT |

### WebSocket Events (Socket.io)
| Event | Direction | Description |
|-------|-----------|-------------|
| `join-project` | Client → Server | Join the project room |
| `leave-project` | Client → Server | Leave the project room |
| `issue-updated` | Server → Client | Issue change broadcast |
| `issue-created` | Server → Client | Issue creation broadcast |
| `issue-deleted` | Server → Client | Issue deletion broadcast |

---

## 6. Data Model (Prisma Schema)

### ER diagram
```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│    users     │────▶│ project_members  │◀────│  projects   │
│              │     │  (role: enum)    │     │             │
└──────┬──────┘     └──────────────────┘     └──────┬──────┘
       │                                            │
       │ assignee_id                                │ project_id
       ▼                                            ▼
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   issues     │◀───│  issue_labels    │───▶│   labels    │
│              │     └──────────────────┘     └─────────────┘
│ parent_id ──┐│
│             ││
│  (self-ref) ◀┘
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ activities   │
└─────────────┘
```

### Tables

#### users
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK, @default(uuid()) |
| email | String | @unique |
| name | String | |
| password_hash | String | bcrypt |
| avatar | String? | nullable |
| is_superuser | Boolean | default false |
| created_at | DateTime | @default(now()) |
| updated_at | DateTime | @updatedAt |

#### projects
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | String | |
| key | String | @unique, uppercase 2–10 chars |
| description | String? | nullable |
| created_at | DateTime | |
| updated_at | DateTime | |

#### project_members
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK → users |
| project_id | UUID | FK → projects |
| role | Enum | ADMIN / PM / DEVELOPER |
| created_at | DateTime | |
| | | @@unique([user_id, project_id]) |

#### issues
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| number | Int | auto-increment within project |
| title | String | max 500 chars |
| description | String? | nullable |
| status | Enum | BACKLOG / TODO / IN_PROGRESS / REVIEW_QA / DONE / CANCELED / RECHECK |
| priority | Enum | HIGH / MEDIUM / LOW |
| type | Enum | EPIC / TASK / BUG / SUB_TASK |
| order | Int | sort order within a kanban column |
| project_id | UUID | FK → projects |
| assignee_id | UUID? | FK → users, nullable |
| creator_id | UUID | FK → users |
| parent_id | UUID? | FK → issues (self), nullable |
| created_at | DateTime | |
| updated_at | DateTime | |
| | | @@unique([project_id, number]) |
| | | @@index([project_id, status]) |

#### labels
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | String | max 50 chars |
| color | String | hex (#RRGGBB) |
| project_id | UUID | FK → projects |
| | | @@unique([project_id, name]) |

#### issue_labels
| Column | Type | Notes |
|--------|------|-------|
| issue_id | UUID | FK → issues |
| label_id | UUID | FK → labels |
| | | @@id([issue_id, label_id]) |

#### activities
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| issue_id | UUID | FK → issues |
| user_id | UUID | FK → users |
| field | String | changed field name |
| old_value | String? | |
| new_value | String? | |
| created_at | DateTime | |
| | | @@index([issue_id]) |

#### api_keys (for AI-system integration)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| key | String | @unique, 64-char hash |
| name | String | key description |
| user_id | UUID | FK → users |
| last_used | DateTime? | |
| created_at | DateTime | |

---

## 7. Page Structure (Frontend Routing)

```
/login                     → Login page
/                          → Home → redirects to /projects
/projects                  → Project list
/projects/:key/board       → Kanban board (main view)
/projects/:key/list        → List view
/projects/:key/settings    → Project settings (members / labels)
/settings                  → System settings (Admin)
/settings/members          → Global member management
```

### Key screens

#### Login
- Email + password → JWT issued → stored in AuthContext.

#### Project list
- Card layout (name, key, issue count, member avatars).
- Project-creation modal.

#### Kanban board (core screen)
- 7 status columns (collapsible).
- Issue card: type badge, priority icon, title, assignee, labels.
- Drag-and-drop → status change + WebSocket broadcast.
- Top filter bar (assignee, issue type, priority, search).
- Click a card → opens the issue detail side panel / modal.

#### List view
- Table columns: #, type, title, status, priority, assignee.
- Sort / filter.
- Checkbox + bulk actions (change status, assign).

#### Issue detail (modal / side panel)
- Inline title edit.
- Status / priority / assignee dropdowns.
- Description with markdown editing.
- Parent issue link.
- Children list.
- Label tags.
- Activity log (change-history timeline).

---

## 8. Development Roadmap

### Phase 1 — MVP (Month 1)
- [ ] Monorepo setup (pnpm workspaces).
- [ ] NestJS project init + Prisma schema + migration.
- [ ] AuthModule (login / register / JWT guard / role guard).
- [ ] ProjectModule (CRUD + member management).
- [ ] IssueModule (CRUD + status change).
- [ ] React frontend init + routing + AuthContext.
- [ ] Kanban board (drag-and-drop).
- [ ] Docker Compose dev environment.

### Phase 2 — Polish (Month 2)
- [ ] List view.
- [ ] Issue filtering & search (query params).
- [ ] LabelModule + UI.
- [ ] ActivityModule (auto-record change history).
- [ ] WebSocket live board sync.
- [ ] API-key auth (AI-system integration).
- [ ] Bulk actions.
- [ ] Issue detail side panel.

### Phase 3 — Stabilization & Expansion (Month 3)
- [ ] Project dashboard (progress, per-status stats).
- [ ] Production Docker build optimization.
- [ ] E2E tests (Playwright).
- [ ] Jira data migration script.
- [ ] Sprint feature (optional).
- [ ] Iterate on real-user feedback.

---

## 9. Changes vs. Current Jira Usage

| Item | Jira (current) | New system |
|------|----------------|------------|
| Workflow | Varies per project (4–9 steps) | Unified 7 steps |
| Issue types | 5 incl. Story | 4 (Story removed) |
| Methodology | Mixed Scrum / Kanban | Kanban first → sprints later |
| Labels | Free-form input | Per-project label management |
| Priority | 5 levels (only 3 actually used) | 3 levels (High, Medium, Low) |
| Notifications | Email | None initially (revisit later) |
| Views | Board / backlog / timeline / etc. | Kanban + List |
| Real-time | None | WebSocket board sync |

---

## 10. Reuse from Existing Projects

### From BB_YT_AUTOMATION (Node.js / TS patterns)
| Module | Reused content |
|--------|----------------|
| pnpm-workspace.yaml | Monorepo configuration |
| Prisma setup | schema.prisma structure, migration pattern |
| Docker setup | multi-stage build, docker-compose |
| JWT middleware | Auth pattern reference (→ converted to NestJS Guard) |

### From BB_DEVTEAM / CP (frontend)
| Module | Reused content |
|--------|----------------|
| components/ui/ | Button, Input, Card, Badge, Table, … shared components |
| AuthContext | Auth context pattern |
| services/ | Axios instance + interceptor pattern |
| Tailwind setup | CSS variables, theme configuration |
| Zustand stores | State-management pattern |
