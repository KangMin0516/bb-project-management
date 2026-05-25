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

### 2026-05-25 — Soft-archive for completed projects (PM-???, pending)
**Added.** Superusers can now archive a project from `Settings → Danger Zone → Archive Project`. Archived projects disappear from every member-facing surface — Projects list, project switcher / sidebar, Global & Team Dashboards, Standup issue lists, global search (⌘K), MCP `list_projects` / `digest` / `search_issues` / `list_my_assignments`, and Quick-Issue project picker. Direct URL access (`/projects/<KEY>/board`, etc.) returns 404 for non-superusers because `ProjectMemberGuard` now rejects archived projects regardless of membership. Superusers retain access via a new `Archived` tab on the Projects page that lists every archived project with its archivedAt / archivedBy / open-vs-done issue count and an `Unarchive` action to restore. Internal write paths (issue mutation, webhook ingest, MCP create/update) are intentionally **not** gated — the assumption is that hiding all entry points is sufficient containment, and a stricter write-side block can be added later if needed.

Schema additions:
- `projects.archived_at: timestamptz?`
- `projects.archived_by_id: uuid?` (FK → users.id, ON DELETE SET NULL)
- Index on `archived_at`

Where clauses tightened (all add `archivedAt: null` or `project: { archivedAt: null }`):
- `ProjectRepository.listForUser`, `listAllWithMembership`, `findWithDetails` (member listings + project detail)
- `UserMetricsQueryService.getMyGlobalDashboard` (Global Dashboard)
- `TeamMetricsQueryService.getTeamDashboard`, `getMemberDetail`, `getMemberIssues`, `getTeamIssues` (Team Dashboard, 12 queries)
- `StandupService.sendIssueListBlock` (per-user issue list DM)
- `ExternalService.listProjectsForUser`, `listMyAssignments`, `searchIssues`, `getDigest`, `listIssues`, `listSpecs`/`getSpec`/`getSpecMarkdown`, `listMembers`, `listLabels`, `getTableOfContent`, `getIssue`, `listComments`, `listActivities`, `listAttachments`, `listIssueSpecLinks` — read endpoints now 404 on archived projects via a new `requireActiveProjectId` helper
- `SearchService.searchIssues`, `searchAll` (global ⌘K — superusers also see archived projects filtered out so retired projects don't pollute search)
- `QuickIssueService.parse` (quick-issue Slack DM never lands in an archived project)
- `ProjectMemberGuard` — rejects archived projects for non-superusers (boards, timeline, calendar, dashboard sub-route, …)
- `IssueQueryService.lookupIssueByKey` (markdown `PROJ-N` auto-link resolver — was leaking archived-project issue titles via hover tooltips)
- `DeadlineScheduler.run` (per-hour cron stops nudging archived-project assignees)
- `MgmtDigestService.{getProjectStats, getMemberStats, getOverdueIssues, getStalledIssues, getUnassignedCount}` (5 queries — daily management Slack digest no longer lists retired projects)
- `ReportScheduler.checkAndQueueReports` (per-minute planner skips configs whose project is archived; previously the channel kept getting morning/lunch/evening blasts)
- `JoinRequestPrismaRepository.resolveProjectId` (a stale invitation URL no longer creates a pending request against a retired project)
- `UnlockShareLinkUseCase` + `ShareLinkPublicController.requireFreshLink` — share-link unlock and every share-scoped read 410-Gones if the project is archived (closes the one path where an external, un-authenticated viewer could still load archived data)

API surface (new):
- `POST /api/projects/:projectId/archive` — superuser, idempotent-no (409 if already archived)
- `POST /api/projects/:projectId/unarchive` — superuser, 409 if not archived
- `GET /api/projects/archived` — superuser, returns archived rows with archivedBy + issue counts
- `GET /api/projects/:projectId?includeArchived=1` — superuser can opt-in to view an archived project's detail (used by the Archived tab when navigating in for cleanup)

Domain events published through `OutboxEventBus` (best-effort, after `repo.save()` — no subscribers in this release; the audit columns `archivedAt` / `archivedById` are the durable trail):
- `ProjectArchivedEvent { projectId, key, actorId, archivedAt }`
- `ProjectUnarchivedEvent { projectId, key, actorId }`

Project (re-)used patterns:
- `ProjectWithMembersAndCount` carries `archivedAt` / `archivedById` so archive/unarchive responses are distinguishable from a plain `update`.
- `ArchiveProjectUseCase` / `UnarchiveProjectUseCase` accept both UUID and human key (mirroring `GET /api/projects/:id`).
- `ProjectPrismaRepository.listArchived` uses a `groupBy` for the DONE count so a project archived with 5k closed issues doesn't materialise 5k Issue rows per refresh of the Archived tab. Both counts exclude soft-deleted issues (`Issue.archivedAt: null`).
- Frontend cache invalidation across `projects`, `projects-all`, `projects-archived`, `project/<id>`, `global-dashboard`, `team-dashboard`.

- Source: `packages/api/prisma/schema.prisma` (+ migration `20260525050348_add_project_archive`), `packages/api/src/project/domain/project.entity.ts`, `packages/api/src/project/domain/events/project-archived.event.ts`, `packages/api/src/project/domain/events/project-unarchived.event.ts`, `packages/api/src/project/application/archive-project.use-case.ts`, `packages/api/src/project/application/unarchive-project.use-case.ts`, `packages/api/src/project/application/list-archived-projects.use-case.ts`, `packages/api/src/project/application/archive-project.use-case.spec.ts`, `packages/api/src/project/application/ports/project.repository.ts`, `packages/api/src/project/infrastructure/project.prisma.repository.ts`, `packages/api/src/project/project.controller.ts`, `packages/api/src/project/project.module.ts`, `packages/api/src/common/guards/project-member.guard.ts`, `packages/api/src/dashboard/team-metrics-query.service.ts`, `packages/api/src/dashboard/user-metrics-query.service.ts`, `packages/api/src/external/external.service.ts`, `packages/api/src/issue/application/issue-query.service.ts`, `packages/api/src/issue/deadline.scheduler.ts`, `packages/api/src/join-request/infrastructure/join-request.prisma.repository.ts`, `packages/api/src/report/mgmt-digest.service.ts`, `packages/api/src/report/report.scheduler.ts`, `packages/api/src/share-link/application/unlock-share-link.use-case.ts`, `packages/api/src/share-link/share-link.public.controller.ts`, `packages/api/src/standup/standup.service.ts`, `packages/api/src/search/search.service.ts`, `packages/api/src/quick-issue/quick-issue.service.ts`, `packages/web/src/features/project/api.ts`, `packages/web/src/features/project/repository.ts`, `packages/web/src/features/project/hooks/useArchiveProject.ts`, `packages/web/src/features/project/components/ArchivedProjectCard.tsx`, `packages/web/src/features/project/components/settings/DangerZoneSection.tsx`, `packages/web/src/pages/ProjectsPage.tsx`, `packages/web/src/pages/SettingsPage.tsx`.

### 2026-05-20 — Non-member placeholder back-link goes home, not to /projects (04241fe)
**Changed.** The "Back to projects" link on both `NotMemberPlaceholder` and the "Project not found" card pointed at `/projects`, which lists every project in the workspace with their `isMember` flags. Daisy didn't want a non-member arriving via deep link to see the full company project catalogue. Re-pointed to `/` (global dashboard / home) with the label "Back to home". The "Request to Join" CTA above still works without exposing the catalogue.
- Source: `packages/web/src/features/project/components/NotMemberPlaceholder.tsx`, `packages/web/src/app/router/ProjectRouteGate.tsx`.

### 2026-05-20 — Deep-link gate: non-members see "Request to Join" instead of a silent empty board (d3ea14d)
**Added.** When a user opens any `/projects/:projectId/*` deep link (Slack notification, MCP-generated URL, copied issue link) for a project they aren't a member of, the page used to render as if it were empty: the board fell through to "No issues found", the header lost the project name, and the issue panel (`?open=...`) silently failed because every `/projects/:projectId/issues/*` request 403'd at the `ProjectMemberGuard`. New behaviour: a `ProjectRouteGate` layout route wraps the 8 project subroutes (`/`, `/board`, `/lists`, `/issues`, `/specs`, `/timeline`, `/credentials`, `/settings`) and reads the cached `projects-all` query to decide. Non-members get a centered `NotMemberPlaceholder` card with the project name + key, an explanation, and the existing tri-state `JoinRequestPrompt`. Hitting "Request to Join" calls `POST /projects/:id/join-requests` which already fans out a Slack DM to every project ADMIN/PM (via `MessagingPort` → `SlackAdapter` — no change needed there). Missing project shows a "Project not found" card with a back link. Superusers bypass exactly like the server-side `ProjectMemberGuard`.
- Source: `packages/web/src/app/router/index.tsx`, `packages/web/src/app/router/ProjectRouteGate.tsx`, `packages/web/src/features/project/hooks/useProjectAccess.ts`, `packages/web/src/features/project/components/NotMemberPlaceholder.tsx`.

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
