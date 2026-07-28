# Changelogs

Per-domain changelogs for the `bb-pm` (BB Project Management) monorepo. Each file tracks the evolution of one feature area: schema changes, behavior changes, bug fixes, and notable refactors — anchored to the git commit and the Prisma migration that introduced them.

> **Why per-domain?** A single top-level `CHANGELOG.md` becomes unreadable once the project crosses ~30 modules. Per-domain files let an engineer (or an LLM agent) load only the slice of history they actually need.

---

## Index

| File | Domain | Scope summary |
|---|---|---|
| [`core-changelog.md`](./core-changelog.md)                   | **Core / infra**       | Common module, Prisma, guards, encryption, throttling, exception filter, transform interceptor, deploy pipeline |
| [`auth-changelog.md`](./auth-changelog.md)                   | **Auth**               | JWT issue/refresh, API keys, user account lifecycle (PENDING → ACTIVE → REJECTED/DELETED) |
| [`user-changelog.md`](./user-changelog.md)                   | **Users**              | Profile, avatar storage (S3 proxy), superuser bypass, Slack-user mapping |
| [`project-changelog.md`](./project-changelog.md)             | **Projects**           | Project CRUD, members, roles (ADMIN/PM/DEVELOPER), seeded labels, join-request flow |
| [`issue-changelog.md`](./issue-changelog.md)                 | **Issues**             | Issue lifecycle, hierarchy (EPIC/TASK/BUG/SUB_TASK), kanban order, dates (start/due/focus), `isRecheck`, auto-archive, dependencies, components, labels, comments, attachments, activities |
| [`specification-changelog.md`](./specification-changelog.md) | **Specifications**     | Markdown specs, sections, threaded comments, issue↔spec links, ordering |
| [`doc-comment-changelog.md`](./doc-comment-changelog.md)     | **Doc comments**       | Notion-style inline comments on documents hosted outside BB PM, anchored to a text quote, served over a `COMMENT`-scoped share link |
| [`notification-changelog.md`](./notification-changelog.md)   | **Notifications**      | In-app notifications (assignment, comment, mention, join-request resolution) |
| [`upload-changelog.md`](./upload-changelog.md)               | **Uploads**            | S3 attachments + avatars, file-type blocklist, avatar HTTP proxy |
| [`slack-changelog.md`](./slack-changelog.md)                 | **Slack core**         | OAuth install, encrypted bot tokens, channel/user cache, signature verification |
| [`standup-changelog.md`](./standup-changelog.md)             | **Standup bot**        | DM-driven 1-question-at-a-time bot, configs, scheduler, reminders, quick-issue capture |
| [`report-changelog.md`](./report-changelog.md)               | **Slack reports**      | Daily project reports (morning/lunch/evening) + management digest |
| [`github-changelog.md`](./github-changelog.md)               | **GitHub integration** | PAT connect, HMAC-verified webhooks, PR↔issue auto-link, status sync |
| [`external-api-changelog.md`](./external-api-changelog.md)   | **External API**       | `X-API-Key`-authenticated REST surface for AI agents and external integrations |
| [`mcp-changelog.md`](./mcp-changelog.md)                     | **MCP server**         | OAuth 2.1 Authorization Server, dual `X-API-Key`/`Bearer` guard, source-of-write tagging, `/external/*` additions for MCP agents |
| [`dashboard-changelog.md`](./dashboard-changelog.md)         | **Dashboards**         | Global, project, team dashboards, KPI cards, focus issues, member tasks |
| [`timeline-changelog.md`](./timeline-changelog.md)           | **Timeline view**      | Gantt-style timeline, EPIC grouping, scroll sync, CANCELED filtering |
| [`calendar-changelog.md`](./calendar-changelog.md)           | **Calendar view**      | Month grid pinned by `dueDate`, +N more overflow popover, shared filter toolbar |
| [`ui-changelog.md`](./ui-changelog.md)                       | **Frontend cross-cutting** | Dark mode, keyboard shortcuts + command palette, API docs page, breadcrumbs, accessibility |

---

## Format

Every domain changelog follows the same structure (see [`.claude/templates/docs/changelogs/CHANGELOG_TEMPLATE.md`](../../.claude/templates/docs/changelogs/CHANGELOG_TEMPLATE.md)):

1. **Title + one-line scope**.
2. **Owns** — the files/modules/tables this domain controls. Useful for agents deciding "is this relevant to my task?".
3. **Surface** — the HTTP routes, schedulers, webhooks, or UI screens exposed by the domain.
4. **Timeline** — reverse-chronological list of changes, each one tagged with date, commit short SHA, and Keep-a-Changelog-style category:
   - **Added** — net-new feature, model, column, endpoint, scheduler.
   - **Changed** — behavior change to existing code.
   - **Fixed** — bug fix.
   - **Removed** — capability deleted (rare; usually replaced by a renamed equivalent).
   - **Schema** — Prisma migration in this domain.
5. **Open questions / known issues** — at the bottom, if applicable. Pull from `docs/ARCHITECTURE.md` §13 risk register.

### Per-entry format

```markdown
### 2026-04-17 — Auto-archive DONE/CANCELED issues (08b0d42)
**Added.** A `@nestjs/schedule` cron at `0 0 3 * * *` sets `archived_at = now()` on issues with `status IN ('DONE','CANCELED')` and `updated_at < now - 3 days`. When such an issue is later moved to a non-terminal status (via update or board drag), `archived_at` is reset to `null`.
- Migration: `20260417093739_add_issue_archived_at` — adds `archived_at TIMESTAMP NULL`, indexes `(status, archived_at)`.
- Source: `packages/api/src/issue/archive.scheduler.ts`.
```

A good entry has:
- The **what** in one sentence.
- The **why** if non-obvious from the title.
- Pointers to the migration and the source file(s) so the reader can navigate.

---

## When to update a changelog

- **You added a Prisma migration** → update the matching domain (issue/spec/auth/...).
- **You added or changed an HTTP route** → update the matching domain.
- **You added or changed a scheduler / webhook handler** → update the matching domain.
- **You changed a UI behavior visible to users** → update `ui-changelog.md` or the domain that owns the page.
- **You refactored without behavior change** → optional, but a one-line **Changed** entry helps the next reader.

> Trivial fixes (typos, formatting, dependency bumps) don't need a changelog entry. If the diff doesn't change observable behavior or schema, skip it.

## When **not** to update

- Plain dependency bumps that don't change behavior.
- Internal renames with no API/UI/DB surface change.
- Test-only changes.

---

## Conventions

- **Newest at the top** within each file. The most recent change should be visible at first scroll.
- **Reference commits by short SHA** (`08b0d42`), not by PR number, so the link survives PR closure or repo migration.
- **Reference migrations by their folder name**, e.g. `20260417093739_add_issue_archived_at`.
- **Use absolute, source-relative paths** (`packages/api/src/issue/issue.service.ts:447`) so agents can navigate directly.
- **Keep entries calibrated** — a one-line fix entry is fine; a multi-paragraph entry is fine; padding entries to look impressive is not.
- **Cross-link domains** when a change touches multiple. Example: "see also [issues](./issue-changelog.md#…)".
