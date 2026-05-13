# Project Changelog

> Projects, project members + roles, the self-service join-request flow, and the auto-seeded default labels created on every new project.

## Owns

- **Modules**: `packages/api/src/project/`, `packages/api/src/project-member/`, `packages/api/src/join-request/`, `packages/api/src/common/guards/project-member.guard.ts`, `packages/api/src/common/guards/roles.guard.ts`
- **Frontend**: `packages/web/src/api/projects.ts`, `packages/web/src/pages/ProjectsPage.tsx`, `packages/web/src/pages/NewProjectPage.tsx`, `packages/web/src/pages/SettingsPage.tsx`, `packages/web/src/pages/MemberTasksPage.tsx`
- **Tables**: `projects`, `project_members`, `project_join_requests`, `labels` (seeded per project)

## Surface

- `POST /api/projects` — JWT, creator becomes ADMIN + all active superusers auto-added as ADMIN
- `GET /api/projects` — JWT, lists projects the user is a member of (or all projects with `isMember` / `pendingJoinRequest` flags for the discovery view)
- `GET /api/projects/:idOrKey` — JWT + member or superuser, resolves UUID or human key
- `PATCH /api/projects/:id` / `DELETE /api/projects/:id` — JWT + ADMIN
- `GET /api/projects/:id/members` / `POST` / `PATCH /:memberId/role` / `DELETE /:memberId`
- `POST /api/projects/:projectId/join-requests` — JWT, user requests to join
- `PATCH /api/projects/:projectId/join-requests/:requestId/approve|reject` — JWT + ADMIN/PM

**Key resolution**: `ProjectMemberGuard` accepts either a UUID or a human key (e.g. `BB`) in `:projectId`. Non-UUID values are looked up via `prisma.project.findUnique({where:{key}})` and the request param is replaced with the UUID before downstream services see it.

## Timeline

### 2026-04-21 — Project join-request flow (a967958)
**Added.** Users can now discover all projects (not just ones they're a member of) and request to join. `project_join_requests` table tracks `PENDING | APPROVED | REJECTED` with a free-text `message` (≤500 char) on request and `rejection_reason` on rejection. Approving the request creates a `project_members` row with `DEVELOPER` role. Resolved-by user is recorded for audit.
- Migration: bundled with this commit — adds `project_join_requests` table with `(requester_id, project_id)` unique, `(project_id, status)` index.
- Source: `packages/api/src/join-request/join-request.service.ts`, `packages/web/src/pages/ProjectsPage.tsx`.

### 2026-04-06 — Default label seeding on project create
**Added.** Every new project is auto-seeded with 6 labels: `Bug` (#EF4444), `Feature` (#3B82F6), `Improvement` (#8B5CF6), `Documentation` (#6B7280), `Urgent` (#F59E0B), `Design` (#EC4899). Done in the same call as project creation via `prisma.label.createMany({skipDuplicates: true})`.
- Source: `packages/api/src/project/project.service.ts:54`.

### 2026-04-06 — Auto-add superusers as ADMIN on new project
**Added.** When any user creates a project, every `ACTIVE` superuser is added as an ADMIN member alongside the creator. Use case: superusers can immediately oversee all projects without manual invites.
- Source: `packages/api/src/project/project.service.ts:25`.

### 2026-04-06 — Initial project model (init commit, Schema: `20260406080645_init`)
**Added.** `projects` (id, key unique, name, description), `project_members` (id, role, FK pair unique). Roles `ADMIN | PM | DEVELOPER` via `ProjectRole` enum. `ProjectMemberGuard` enforces membership on every `:projectId`-scoped route. Superusers bypass via the early-return path.
- Migration: `20260406080645_init`.

## Open questions / known issues

- No project archive/soft-delete. Deleting a project cascades to all members, issues, specs, labels, integrations.
- No role-based fine-grained permission map (e.g., DEVELOPER cannot delete issues created by others). Today, any member can do any project-scoped action; the `@Roles(...)` decorator is reserved for the few admin/PM-only routes.
