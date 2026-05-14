# Entities (Prisma models)

> Concrete catalog of every model in `packages/api/prisma/schema.prisma`.
> 30 models + 7 enums. This is the *what's in the database* reference;
> [`overview.md`](./overview.md) covers *how it's served*. The schema file is
> always authoritative — when in doubt, open it.

Grouped by domain. For each model: table name, key fields, foreign keys,
indexes, and what owns its lifecycle.

---

## 1. Identity

### `User` → `users`

The root of everything authored. Soft-deletes via `status = DELETED`.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `email` | UNIQUE | Login identifier. |
| `name` | string | |
| `passwordHash` | string | bcrypt (cost 12). |
| `avatar` | nullable | S3 proxy URL `/api/upload/avatar/:userId`. |
| `status` | `UserStatus` enum | `PENDING / ACTIVE / REJECTED / DELETED`. |
| `slackUserId` | nullable UNIQUE | Set when standup DM first arrives; enables assignment DMs. |
| `isSuperuser` | bool | Auto-added as ADMIN to every project on project create. |
| `refreshToken` | nullable | bcrypt-hashed UUID half. **One slot per user** — second login invalidates first. |
| `createdAt` / `updatedAt` | DateTime | |

Relations (16 of them — User is the spider in the middle):

- `memberships` ← `ProjectMember`
- `assignedIssues` / `reviewerIssues` / `createdIssues` ← `Issue`
- `activities`, `comments`, `attachments`, `notifications`, `apiKeys`, `templates`
- `componentLeads` / `componentDefaultAssignees` ← `Component`
- `createdSpecs` ← `Specification`, `specComments` ← `SpecComment`
- `credentials` ← `ProjectCredential`
- `slackInstallations`, `githubInstallations`
- `joinRequests` / `resolvedJoinRequests` ← `ProjectJoinRequest`

### `ApiKey` → `api_keys`

Per-user issued tokens for `/api/external/*`.

| Field | Notes |
|---|---|
| `key` | UNIQUE bcrypt-hash. |
| `keyPrefix` | first 8 chars (`bbpm_xx`), indexed. Narrows the bcrypt-compare set in `ApiKeyGuard`. |
| `name`, `lastUsed`, `userId` | |

Index: `@@index([keyPrefix])`. Cascade-deleted with the user.

---

## 2. Workspace

### `Project` → `projects`

| Field | Notes |
|---|---|
| `id` | UUID PK |
| `key` | UNIQUE human prefix (e.g. `BBPM`, `BB`). Used in URLs and `BB-123` issue keys. |
| `name`, `description` | |

Relations: `members`, `issues`, `labels`, `components`, `specifications`,
`credentials`, `reportConfig?` (1:1), `githubIntegration?` (1:1), `joinRequests`.

> **Important asymmetry.** `findOne(idOrKey)` accepts both UUID and key.
> `update(id)` and `remove(id)` accept UUID only. See
> [`patterns.md#8`](./patterns.md).

### `ProjectMember` → `project_members`

Composite join with a role.

| Field | Notes |
|---|---|
| `userId`, `projectId` | UNIQUE composite — one row per (user, project). |
| `role` | `ProjectRole` enum: `ADMIN / PM / DEVELOPER`. Default `DEVELOPER`. |

Cascade on User OR Project delete. Read by `ProjectMemberGuard`.

### `ProjectJoinRequest` → `project_join_requests`

| Field | Notes |
|---|---|
| `status` | `JoinRequestStatus`: `PENDING / APPROVED / REJECTED`. |
| `message` | varchar(500), the request body. |
| `rejectionReason` | varchar(500), set when rejected. |
| `requesterId`, `projectId` | UNIQUE composite (a user can have only one open request per project). |
| `resolvedById`, `resolvedAt` | The admin/PM who handled it. `SetNull` on resolver delete. |

Index: `@@index([projectId, status])`.

---

## 3. Issue core

### `Issue` → `issues`

The center of gravity. ~900 LOC in `IssueService` revolve around this.

| Field | Notes |
|---|---|
| `id` | UUID PK |
| `number` | int — `(projectId, number)` UNIQUE. Allocated by `MAX(number)+1` per project. **No advisory lock** — concurrent creates can collide. |
| `title` | varchar(500) |
| `description` | text |
| `status` | `IssueStatus`: `BACKLOG / TODO / IN_PROGRESS / REVIEW_QA / DONE / CANCELED`. |
| `priority` | `IssuePriority`: `HIGH / MEDIUM / LOW`. |
| `type` | `IssueType`: `EPIC / TASK / BUG / SUB_TASK`. |
| `order` | int — fractional column order with `ORDER_GAP=1000`. Renormalized when neighbours drift <0.001 apart. |
| `startDate` / `dueDate` | nullable DateTime |
| `focusDate` | nullable `@db.Date` (UTC midnight). "I want to work on this today". |
| `isRecheck` | bool — auto-set on backflow into `IN_PROGRESS`, cleared on exit. |
| `archivedAt` | nullable — `ArchiveScheduler` sets it daily 3 AM for `DONE/CANCELED` older than 3 days. Cleared on re-open. |
| `projectId` | Cascade. |
| `assigneeId` | `SetNull` on user delete. Powers the deferred-DM flow. |
| `reviewerAssigneeId` | `SetNull` on user delete. |
| `creatorId` | `SetNull` on user delete. |
| `parentId` | self-relation. EPIC has no parent; SUB_TASK requires non-SUB_TASK parent; cycles rejected. |

Indexes:

- `@@unique([projectId, number])` — issue keys.
- `@@index([projectId, status])` — board queries.
- `@@index([assigneeId])`, `@@index([reviewerAssigneeId])`, `@@index([parentId])` — sidebar queries.
- `@@index([status, archivedAt])` — archive scheduler scan.

Children: `IssueLabel`, `IssueComponent`, `Activity`, `Comment`, `Attachment`,
`Notification`, `IssueLink` (× 2 directions), `IssueSpecLink`, `GitHubPrIssueLink`.

### `Activity` → `activities`

The change log.

| Field | Notes |
|---|---|
| `field` | varchar(50). Intentionally **string-typed**, not an enum — new event types (`status`, `assigneeId`, `github_pr_linked`, `github_pr_auto_linked`, `created`, …) are added by writing a new slug. |
| `oldValue` / `newValue` | nullable strings. |
| `issueId` | Cascade. |
| `userId` | `SetNull` on user delete. |

Index: `@@index([issueId])`. Coalesced within a 10-second window for
`assigneeId` / `reviewerAssigneeId` (see [`patterns.md#4`](./patterns.md)).

### `Comment` → `comments`

| Field | Notes |
|---|---|
| `content` | text (markdown). |
| `issueId` | Cascade. |
| `userId` | `SetNull` on author delete. |

Has its own `attachments` relation (an attachment can be tied to an issue OR
a comment).

### `Attachment` → `attachments`

| Field | Notes |
|---|---|
| `fileName`, `fileSize`, `mimeType`, `url` | S3 URL. |
| `issueId?` / `commentId?` | One must be set (enforced in service, not DB). |
| `uploaderId` | Cascade. |

Indexes: `@@index([issueId])`, `@@index([commentId])`.

### `IssueLabel` → `issue_labels` (M:N join)

Composite PK `(issueId, labelId)`. Both sides cascade.

### `Label` → `labels`

| Field | Notes |
|---|---|
| `name` | varchar(50), UNIQUE per project. |
| `color` | varchar(7), default `#6B7280`. |
| `projectId` | Cascade. |

### `IssueComponent` → `issue_components` (M:N join)

### `Component` → `components`

| Field | Notes |
|---|---|
| `name` | varchar(100), UNIQUE per project. |
| `description` | nullable. |
| `leadId?` | `SetNull` on user delete — the component owner. |
| `defaultAssigneeId?` | `SetNull` — auto-assigned when an issue is tagged with this component. |
| `projectId` | Cascade. |

### `IssueTemplate` → `issue_templates`

| Field | Notes |
|---|---|
| `name` | varchar(100). |
| `type` | `IssueType`. |
| `description` | text — markdown body to prefill new issues. |
| `creatorId` | Cascade. |

### `IssueLink` → `issue_links`

Issue ↔ issue typed relations.

| Field | Notes |
|---|---|
| `type` | `IssueLinkType`: `BLOCKS / IS_BLOCKED_BY / RELATES_TO / DUPLICATES / IS_DUPLICATED_BY`. |
| `sourceIssueId` / `targetIssueId` | Both Cascade. |
| `creatorId?` | `SetNull` on user delete. |

Index: `@@unique([sourceIssueId, targetIssueId, type])`. The frontend's
`LINK_TYPE_STRATEGY` table flips inbound links to a single outbound
perspective (`features/issue/strategy`).

### `IssueSpecLink` → `issue_spec_links`

Issue ↔ specification (with optional section anchor).

| Field | Notes |
|---|---|
| `issueId`, `specId`, `sectionSlug` | Composite UNIQUE. `sectionSlug` default `""`. |

Cascade from both sides. Indexes: `@@index([issueId])`, `@@index([specId])`.

### `Notification` → `notifications`

| Field | Notes |
|---|---|
| `type` | varchar(20) — `ASSIGNED / REVIEWER_ASSIGNED / COMMENTED / MENTIONED / JOIN_APPROVED / JOIN_REJECTED`. String-typed for the same reason as `Activity.field`. |
| `message` | varchar(500). |
| `isRead` | bool. |
| `userId` | Recipient. Cascade. |
| `issueId?` | Cascade if issue deleted. |
| `projectId?`, `actorId?` | Plain strings — no FK constraints (intentional: keeps the row readable even if the actor is deleted). |

Index: `@@index([userId, isRead, createdAt])` — the bell dropdown query.

Inserted *after* the 10-second grace window for assignment DMs — see
[`patterns.md#3`](./patterns.md). The DM payload's `meta` is **not
persisted**; it's consumed only by the side-effect delivery path.

---

## 4. Specifications (기획서)

### `Specification` → `specifications`

| Field | Notes |
|---|---|
| `title` | varchar(200). |
| `content` | text (markdown). |
| `category` | varchar(50), nullable. Used for grouping in the sidebar. |
| `status` | `SpecStatus`: `DRAFT / REVIEW / APPROVED / DEPRECATED`. |
| `order` | int — drag-drop reorder within a category. |
| `projectId`, `creatorId` | Both Cascade. |

Index: `@@index([projectId, status])`.

### `SpecSection` → `spec_sections`

Inline anchor table, populated by parsing the spec's markdown headings.

| Field | Notes |
|---|---|
| `sectionId` | varchar(100) — the slug used in `#section-id` links. |
| `level` | int — heading level (1-6). |
| `title` | varchar(300). |
| `order` | int. |
| `specId` | Cascade. UNIQUE `(specId, sectionId)`. |

Index: `@@index([specId, order])`.

### `SpecComment` → `spec_comments`

Threaded discussion on a spec (optionally pinned to a section).

| Field | Notes |
|---|---|
| `content` | text. |
| `resolved` | bool. |
| `specId` | Cascade. |
| `sectionId?` | `SetNull` if the section is removed. |
| `userId` | Cascade. |
| `parentId?` | Self-relation for replies. Cascade. |

Indexes: `@@index([specId, resolved])`, `@@index([userId])`, `@@index([parentId])`.

---

## 5. Credentials

### `ProjectCredential` → `project_credentials`

Per-project secret store.

| Field | Notes |
|---|---|
| `name`, `serviceType`, `description`, `url` | |
| `entries` | **JSON** — `[{ key, value, sensitive }]`. Entries with `sensitive: true` are masked on read (`••••••••`), revealed on a separate endpoint. |
| `projectId` | Cascade. |
| `createdById` | (no cascade — keeps the audit author intact). |

Note: the *cell* encryption pattern here is by convention — the service
expects callers to encrypt sensitive values via `EncryptionService` before
storing. (Some legacy rows are plaintext; this is a known migration gap.)

---

## 6. Slack

### `SlackIntegration` → `slack_integrations`

One workspace per install (we only support a single SlackIntegration
in production — see `notification.service`'s `findFirst` lookup).

| Field | Notes |
|---|---|
| `teamId` | UNIQUE — Slack workspace id. |
| `teamName` | display name. |
| `botToken` | AES-256-CBC encrypted (see [`patterns.md#5`](./patterns.md)). Format: `${ivHex}:${cipherHex}`. |
| `installedById` | the user who completed OAuth. |

Children: `reportConfigs`, `standupConfigs`. Disconnect cascades to both.

### `DailyReportConfig` → `daily_report_configs`

Per-project, 1:1 with `Project`.

| Field | Notes |
|---|---|
| `enabled`, `timezone` (default `Asia/Seoul`), `skipWeekends` | |
| `morningTime` / `lunchTime` / `eveningTime` | varchar `HH:mm`. |
| `morningChannelId` / `morningChannelName` (+ lunch/evening) | nullable. |
| `morningLastSent` / `lunchLastSent` / `eveningLastSent` | DateTime — dedup. |
| `projectId` | UNIQUE — 1:1. |
| `slackIntegrationId` | which workspace this config DMs. |

### `StandupQuestion` → `standup_questions`

Reusable question bank.

| Field | Notes |
|---|---|
| `text` | varchar(500). |
| `ignoreText` | text — words that "skip" this question (default `"nothing nope none no -"`). |
| `order` | int. |

Children: `configs` (M:N via `StandupConfigQuestion`), `answers`.

### `StandupConfig` → `standup_configs`

A schedule + roster + question set.

| Field | Notes |
|---|---|
| `name` | varchar(255). |
| `greeting`, `goodbye` | text. Template variables: `{{username}}`, `{{config_name}}`. |
| `channelId`, `channelName?` | where the summary goes. |
| `cronHour` / `cronMinute` / `cronDayOfWeek` | varchar — custom mini-cron format (supports `*`, `1-5`, `1,3,5`). |
| `timezone` | default `Asia/Seoul`. |
| `enabled` | bool. |
| `slackIntegrationId` | Cascade. |
| `lastTriggeredAt` | DateTime — dedup the once-per-minute scheduler. |

Children: `questions` (M:N), `members` (composite), `reports`.

### `StandupConfigQuestion` → `standup_config_questions` (M:N)

Composite PK `(configId, questionId)` + ordering field.

### `StandupConfigMember` → `standup_config_members`

| Field | Notes |
|---|---|
| `configId`, `slackUserId` | Composite PK. |
| `username` | display cache. |
| `isAway` | bool — manually toggled before trigger to skip a member. |

### `StandupReport` → `standup_reports`

One per (config, member, day).

| Field | Notes |
|---|---|
| `status` | `StandupReportStatus`: `ACTIVE / ANSWERED / AWAY / CANCELED / UNANSWERED`. |
| `slackUserId`, `username?` | denormalised — the recipient might not have a `User` row. |
| `currentQuestionOrder` | int? — bot state machine pointer. |
| `remindedAt` | nullable — set after a single nudge DM. |
| `configId` | Cascade. |

Indexes: `@@index([configId, createdAt])`, `@@index([slackUserId, status])`.

### `StandupAnswer` → `standup_answers`

| Field | Notes |
|---|---|
| `answer` | text (nullable — "skip" answers). |
| `messageTs` | Slack message timestamp (correlation). |
| `order` | int. |
| `reportId`, `questionId` | Composite UNIQUE. Both Cascade. |

---

## 7. GitHub

### `GitHubIntegration` → `github_integrations`

One per project (1:1 with `Project`).

| Field | Notes |
|---|---|
| `accessToken` | encrypted PAT. |
| `webhookSecret` | per-project HMAC SHA-256 secret. |
| `ownerLogin`, `repoName?` | |
| `onPrOpenStatus` / `onPrMergeStatus` | nullable strings — issue status to transition to on PR open / merge. |
| `autoLinkEnabled` | bool — toggle the regex auto-linker. |
| `projectId` | UNIQUE — 1:1. Cascade. |
| `installedById` | (no cascade). |

### `GitHubPullRequest` → `github_pull_requests`

Cache of PR state, populated by webhook.

| Field | Notes |
|---|---|
| `githubId` | int — GitHub's PR id. |
| `number`, `title` (varchar 500), `url`, `state` (varchar 20). |
| `authorLogin`, `authorAvatar?`. |
| `repoFullName`, `baseBranch`, `headBranch`. |
| `mergedAt?`. |
| `integrationId` | Cascade. UNIQUE `(integrationId, githubId)`. |

### `GitHubPrIssueLink` → `github_pr_issue_links`

| Field | Notes |
|---|---|
| `pullRequestId`, `issueId` | UNIQUE composite. Both Cascade. |

Index: `@@index([issueId])`. Written by `GitHubSyncService.autoLinkIssues`
when a PR title/body/branch contains `<PROJECT_KEY>-<NUMBER>`.

---

## 8. Enums recap

| Enum | Values | Used by |
|---|---|---|
| `UserStatus` | `PENDING / ACTIVE / REJECTED / DELETED` | `User.status` |
| `ProjectRole` | `ADMIN / PM / DEVELOPER` | `ProjectMember.role`, `@Roles(...)` decorator |
| `JoinRequestStatus` | `PENDING / APPROVED / REJECTED` | `ProjectJoinRequest.status` |
| `IssueStatus` | `BACKLOG / TODO / IN_PROGRESS / REVIEW_QA / DONE / CANCELED` | `Issue.status` |
| `IssuePriority` | `HIGH / MEDIUM / LOW` | `Issue.priority` |
| `IssueType` | `EPIC / TASK / BUG / SUB_TASK` | `Issue.type` |
| `IssueLinkType` | `BLOCKS / IS_BLOCKED_BY / RELATES_TO / DUPLICATES / IS_DUPLICATED_BY` | `IssueLink.type` |
| `SpecStatus` | `DRAFT / REVIEW / APPROVED / DEPRECATED` | `Specification.status` |
| `StandupReportStatus` | `ACTIVE / ANSWERED / AWAY / CANCELED / UNANSWERED` | `StandupReport.status` |

**Intentionally NOT enums:**

- `Activity.field` (varchar 50) — open-ended event log.
- `Notification.type` (varchar 20) — same reason.
- `Component`/`Label` colour/name — free-form.
- `GitHubPullRequest.state` (varchar 20) — mirrors GitHub's open string set,
  not worth pinning.

---

## 9. Cascade matrix (what dies when)

When you delete X, the following are cascade-deleted (vs nulled, vs blocked):

| Delete | Cascades | Sets null | Blocks |
|---|---|---|---|
| `User` | `memberships`, `apiKeys`, `templates`, `notifications`, `attachments`, `componentLead/defaultAssignee` (null), `createdSpecs` (cascade), `specComments` (cascade), `credentials` (no cascade — block-equivalent), `slackInstallations`, `githubInstallations`, `joinRequests` | `Issue.{assignee,reviewerAssignee,creator}`, `Activity.userId`, `Comment.userId`, `IssueLink.creatorId`, `ProjectJoinRequest.resolvedBy` | `ProjectCredential.createdBy` (no `onDelete` spec — defaults to Restrict) |
| `Project` | `members`, `issues`, `labels`, `components`, `specifications`, `credentials`, `reportConfig`, `githubIntegration`, `joinRequests` | — | — |
| `Issue` | `IssueLabel`, `IssueComponent`, `Activity`, `Comment`, `Attachment`, `Notification`, `sourceLinks`/`targetLinks`, `specLinks`, `githubPrLinks` | `children.parentId` (self-relation) | — |
| `Specification` | `SpecSection`, `SpecComment`, `IssueSpecLink` | — | — |
| `SpecSection` | — | `SpecComment.sectionId` | — |
| `Comment` | `Attachment` | — | — |
| `SlackIntegration` | `standupConfigs` | — | `daily_report_configs` (handled by service via `deleteMany`) |
| `StandupConfig` | `questions`, `members`, `reports` (→ `answers`) | — | — |
| `GitHubIntegration` | `pullRequests` (→ `issueLinks`) | — | — |

The `User` row has a `ProjectCredential.createdBy` relation without an
`onDelete` clause — that defaults to Prisma's `Restrict`. In practice this
means **a user cannot be hard-deleted if they created any credential**. We
soft-delete users (`status = DELETED`) instead, which sidesteps the issue
entirely.

---

## 10. How to add a new entity

1. **Edit `packages/api/prisma/schema.prisma`** — add the model + any new enums.
2. **Run `pnpm prisma migrate dev --name <slug>`** — generates
   `prisma/migrations/<timestamp>_<slug>/migration.sql` and updates the
   generated client.
3. **Pick cascade behaviour deliberately.** `Cascade` for owned children,
   `SetNull` for soft-references (author, assignee), no clause (Restrict) for
   audit references you want to preserve.
4. **Add indexes** for any column you'll filter or order by — Postgres won't
   warn you about missing indexes, but a 100k-row scan will.
5. **Add a row in this catalog** under the right domain section.
6. **Map it to a module.** Either extend an existing module's service or
   create a new module (see [`folder-structure.md`](./folder-structure.md)).
