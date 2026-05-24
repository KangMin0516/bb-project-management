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

### 2026-05-24 — SpecItem checklist + AI-suggest + Spec Rollup view (PM-82)
**Added.** Per-item "기획 vs 구현" tracking on top of the existing Specification module. PMs can mark requirements with `- [ ]` checkboxes inside a spec's markdown; each line becomes a `SpecItem` row keyed by an inline `<!-- spec-item:<uuid> -->` marker that survives reorderings and edits. SpecItems link 1:N to Issues; aggregate progress (lowest-progress wins — a single non-DONE issue keeps the item out of DONE) is computed client-side from each item's linked issue statuses.

End-to-end:
- **Schema.** New `spec_items` and `spec_item_issue_links` tables (migration `20260524140129_add_spec_items_and_item_issue_links`). `spec_items.archivedAt` soft-deletes rows when a PM removes a marker from the content; issue links are preserved so restoring the line un-archives the row.
- **Parser.** `markdown-checkbox-parser.ts` walks the markdown line-by-line, skipping fenced code blocks, and (a) reuses any existing marker comment, (b) allocates a fresh UUID + writes it back inline when missing, (c) detects duplicate markers and re-keys them. 12 unit tests cover edit-survival, duplicate-marker, fenced-skip, indentation, and 500-char truncation.
- **Service wiring.** `SpecificationService.create` and `.update` now call `SpecItemService.upsertFromContent(tx, …)` inside their existing `$transaction` after `syncSections`, then persist the rewritten `markedContent`. `findOne` includes the active item list with each item's linked-issue summary.
- **Link CRUD.** `POST /api/projects/:projectId/specifications/:specId/items/:itemId/issues` `{ issueId }` and `DELETE …/issues/:linkId`. External mirror at `/api/external/projects/:projectKey/specs/:specId/items/...` so MCP agents can wire issues to items end-to-end.
- **AI suggest.** `POST /api/projects/:projectId/specifications/:specId/suggest-items` runs the AnthropicAdapter via the existing `AiCompletionPort`. Output is JSON-only; results are cached for 10 minutes per spec content hash. PM reviews the suggestion list in a modal, picks the keepers, and the modal rewrites the spec content with `- [ ] <text>` appended under the matching section heading (or at the doc tail).
- **FE — single spec.** `SpecProgressBar` + `SpecItemPanel` (filterable by `All / Done / In progress / Backlog / Unplanned`) + `LinkIssueToItemModal` + AI suggest trigger button in the progress strip.
- **FE — project rollup.** New `/projects/:projectId/spec-rollup` page (sidebar nav "Spec Rollup", `ListChecks` icon). Lists every spec with a stacked status bar + done-count, sortable by progress / recent / title. Deep-links into the SpecificationsPage for that spec.

Pre-existing `IssueSpecLink` (spec-level, section-slug-anchored) is untouched and continues to surface in `SpecContent`'s heading badges. The new SpecItemIssueLink is a finer-grained complement, not a replacement.

- Source: `packages/api/prisma/schema.prisma` (new models + Issue / SpecSection / Specification back-refs), `packages/api/prisma/migrations/20260524140129_add_spec_items_and_item_issue_links/migration.sql`, `packages/api/src/specification/lib/markdown-checkbox-parser.ts` (new + `.spec.ts` 12-case suite), `packages/api/src/specification/spec-item.service.ts` (new), `packages/api/src/specification/spec-item-issue-link.service.ts` (new), `packages/api/src/specification/spec-suggest.service.ts` (new), `packages/api/src/specification/specification.service.ts` (`upsertFromContent` hook + `findOne` items include), `packages/api/src/specification/specification.controller.ts` (3 new routes), `packages/api/src/specification/specification.module.ts` (providers + `QuickIssueModule` import for `AI_COMPLETION_PORT`), `packages/api/src/quick-issue/quick-issue.module.ts` (export `AI_COMPLETION_PORT`), `packages/api/src/external/external.service.ts` (mirror methods), `packages/api/src/external/external.controller.ts` (mirror routes), `packages/api/src/external/dto/external-link-spec-item-issue.dto.ts` (new), `packages/web/src/features/specification/api.ts` (new types + 3 endpoints), `packages/web/src/features/specification/repository.ts`, `packages/web/src/features/specification/lib/itemStatus.ts` (new), `packages/web/src/features/specification/components/SpecProgressBar.tsx`, `SpecItemPanel.tsx`, `LinkIssueToItemModal.tsx`, `SpecAiSuggestModal.tsx` (all new), `packages/web/src/pages/SpecificationsPage.tsx` (progress strip + panel wiring + AI modal), `packages/web/src/pages/SpecRollupPage.tsx` (new), `packages/web/src/app/router/index.tsx` (route), `packages/web/src/widgets/AppLayout/AppLayout.tsx` (sidebar entry).

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
- **`<!-- spec-item:<uuid> -->` markers are visible in textarea edit mode.** ReactMarkdown skips them on render so they're invisible in preview, but PMs editing the raw source can see them. A future polish toggle could hide-on-edit; for now the markers are documented as automatic and a "do-not-edit" hint is shown next to the AI-suggest button.
- **IssueDetailPanel doesn't yet show "Linked spec items" (reverse direction).** Plan §3 step 16 calls for this; deferred until the issue-detail BE response shape is extended to include `specItemLinks`.
