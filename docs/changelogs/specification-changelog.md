# Specification Changelog

> Markdown specifications (기획서) — per-project knowledge base with section anchors, threaded comments, and bi-directional links to issues. Recently extended to be fully manageable via the external (X-API-Key) API so AI agents can read and update specs programmatically.

## Owns

- **Modules**: `packages/api/src/specification/`, `packages/api/src/issue-spec-link/`
- **Frontend**: `packages/web/src/api/specifications.ts`, `packages/web/src/pages/SpecificationsPage.tsx`, `packages/web/src/components/spec/`
- **Tables**: `specifications`, `spec_sections`, `spec_comments`, `issue_spec_links`

## Surface

- `GET|POST /api/projects/:projectId/specs`
- `GET|PATCH|DELETE /api/projects/:projectId/specs/:specId`
- `GET /api/projects/:projectId/specs/:specId/markdown` — raw markdown export
- `PATCH /api/projects/:projectId/specs/:specId/reorder` — drag-drop sidebar order
- `GET|POST /api/projects/:projectId/specs/:specId/comments` — threaded (`parent_id`)
- `PATCH /api/projects/:projectId/specs/:specId/comments/:commentId/resolve` — toggle `resolved`
- `POST|DELETE /api/projects/:projectId/issues/:issueId/spec-links` — link an issue to a spec (optionally to a specific section via `sectionSlug`)
- **External API** mirror at `/api/external/projects/:projectKey/specs/*` and `/api/external/issues/:projectKey/:issueNumber/spec-links/*`

## Timeline

### 2026-05-11 — Issue↔spec links via external API (7eb50ad)
**Added.** `POST | GET | DELETE /api/external/issues/:projectKey/:issueNumber/spec-links` so an AI agent that just created an issue can wire it back to the source spec without going through the JWT-gated route.
- Source: `packages/api/src/external/external.service.ts:468` (`createIssueSpecLink`, `listIssueSpecLinks`, `deleteIssueSpecLink`).
- Related: [`external-api-changelog.md`](./external-api-changelog.md).

### 2026-05-11 — Spec reorder via `order` + drag-and-drop sidebar (6f4e542)
**Added.** Added `order INT DEFAULT 0` on `specifications`. Sidebar in the Specifications page is draggable; persists order. Order is per-project. External API doesn't expose the reorder endpoint directly — clients should update via PATCH.
- Migration: bundled with this commit.
- Source: `packages/api/src/specification/specification.service.ts` (reorder), `packages/web/src/pages/SpecificationsPage.tsx`.

### 2026-05-11 — Spec create/update via external API (d5705ee)
**Added.** `POST /api/external/projects/:projectKey/specs` and `PATCH /api/external/projects/:projectKey/specs/:specId`. Lets an AI agent draft and revise specs end-to-end with just an API key.
- Source: `packages/api/src/external/external.service.ts:433` (`createSpec`, `updateSpec`).

### 2026-05-05 — Specifications listed via external API (32ee26d)
**Added.** `GET /api/external/projects/:projectKey/specs` and `GET .../specs/:specId` and `GET .../specs/:specId/markdown`. The markdown endpoint returns the raw `content` with section anchors preserved for downstream Markdown processors.
- Source: `packages/api/src/external/external.service.ts:403`.

### 2026-04-11 — Section slug non-nullable (Schema: `20260411064110_make_section_slug_non_nullable`)
**Schema.** Tightened the `issue_spec_links.section_slug` column. Empty string `''` means "linked to the whole spec, no specific section". Removing NULL eliminates a tri-state and simplifies the unique key `(issue_id, spec_id, section_slug)`.
- Migration: `20260411064110_make_section_slug_non_nullable`.

### 2026-04-11 — Issue-spec links (Schema: `20260411060414_add_issue_spec_links`)
**Schema + Added.** New `issue_spec_links` table with `(issue_id, spec_id, section_slug)` unique. UI: from an issue detail panel, "Link Spec" → choose spec → optionally jump to a section anchor. From the spec page, see all linked issues.
- Migration: `20260411060414_add_issue_spec_links`.
- Source: `packages/api/src/issue-spec-link/issue-spec-link.service.ts`.

### 2026-04-08 — Initial specifications model (Schema: `20260408021345_add_specifications`)
**Schema + Added.** Three tables:
- `specifications` — `title`, markdown `content`, `category`, `status` enum (`DRAFT | REVIEW | APPROVED | DEPRECATED`), `creator`.
- `spec_sections` — derived from the markdown's `## Heading` anchors; `section_id` is a kebab-case slug; allows linking to a specific section.
- `spec_comments` — threaded (`parent_id` self-relation), `resolved` boolean, optional `section_id` to comment on a particular section.
- Migration: `20260408021345_add_specifications`.
- Source: `packages/api/src/specification/specification.service.ts`.

## Open questions / known issues

- **Section anchors are derived at write time** by parsing the markdown headings. Edits that change a heading also change the slug, which can orphan `issue_spec_links` rows pointing at the old slug. Today, the orphan persists silently. A future change should either migrate or warn on slug change.
- **No version history.** A spec edit overwrites `content`. No diff view.
- **Spec markdown is rendered with `react-markdown` + `rehype-sanitize`** on the frontend. Code blocks use `rehype-highlight`; tables use `remark-gfm`.
