# GitHub Integration Changelog

> Per-project GitHub PAT connection. On every `pull_request` webhook (HMAC-verified), the system auto-links PRs to issues by parsing `PROJECT-123` keys from the title, body, and head branch, and optionally transitions linked issues' statuses on PR open or merge.

## Owns

- **Modules**: `packages/api/src/github/` — `github.service.ts`, `github-webhook.service.ts`, `github-sync.service.ts`, `github.controller.ts`
- **Frontend**: `packages/web/src/api/github.ts`, GitHub settings panel in `packages/web/src/pages/SettingsPage.tsx`, PR links section in `packages/web/src/components/issue/IssueDetailPanel.tsx`
- **Tables**: `github_integrations` (1:1 per project), `github_pull_requests`, `github_pr_issue_links`

## Surface

- `POST /api/github/connect` — JWT, body `{accessToken, projectId}`. Validates the PAT by calling `/user`, encrypts with `EncryptionService`, generates a 32-byte hex `webhook_secret`, upserts on `projectId`. Returns the secret **once** — the UI displays it for the user to paste into GitHub.
- `GET /api/github/status/:projectId` — JWT, returns the masked webhook secret + the webhook URL.
- `PATCH /api/github/config/:projectId` — JWT, sets `on_pr_open_status`, `on_pr_merge_status`, `auto_link_enabled`.
- `GET /api/github/repos/:projectId` — JWT, lists `/user/repos` for the dropdown.
- `POST /api/github/link-pr` — JWT, manual link (body: `{prUrl, issueId, projectId}`).
- `DELETE /api/github/links/:linkId` — JWT.
- `POST /api/github/webhook/:projectId` — **public**, body must be raw (verified by HMAC), `X-Hub-Signature-256` header required.

## Security

- **PAT encrypted at rest** with `EncryptionService` (AES-256-CBC + per-row IV).
- **Webhook signature** verified with `crypto.timingSafeEqual` against `sha256=${hmac('sha256', webhook_secret, rawBody)}`.
- **Webhook secret is per-project** — generated fresh on connect, masked except for the last 4 chars in status responses.

## Timeline

### 2026-04-18 — Initial GitHub integration (66ec78b, Schema: `20260417165022_add_github_integration`)
**Added + Schema.** Three tables:
- `github_integrations` — `(project_id)` unique, `access_token` (encrypted), `webhook_secret`, `owner_login`, optional `repo_name`, plus three config columns `on_pr_open_status`, `on_pr_merge_status`, `auto_link_enabled` (default `true`).
- `github_pull_requests` — `(integration_id, github_id)` unique. Stores `number`, `title`, `url`, `state`, `author_login`, `author_avatar`, `repo_full_name`, `base_branch`, `head_branch`, `merged_at`.
- `github_pr_issue_links` — `(pull_request_id, issue_id)` unique, plus index on `issue_id` for the detail-panel reverse lookup.

Webhook flow (`packages/api/src/github/github-webhook.service.ts`):
1. Load the project's integration and validate the signature on the raw body. Reject 401 on mismatch.
2. Parse `pull_request` event payload. Upsert the PR row.
3. If `auto_link_enabled`, search `${title} ${body} ${head_branch}` with regex `/\b([A-Z][A-Z0-9_]{1,9})-(\d+)/g`, filter to keys matching the project's `key`, and upsert a `github_pr_issue_links` row per matched issue. Each link writes an `Activity{field: "github_pr_auto_linked"}` row on the issue.
4. On `action == opened|reopened`, if `on_pr_open_status` is set, transition every linked issue to that status (writes a `status` activity row).
5. On `action == closed && merged`, if `on_pr_merge_status` is set, same transition.

- Migration: `20260417165022_add_github_integration`.
- Source: `packages/api/src/github/github.service.ts`, `packages/api/src/github/github-webhook.service.ts`, `packages/api/src/github/github-sync.service.ts`.

## Open questions / known issues

- **R6 — webhook does work synchronously.** The handler does the upsert + auto-link + status sync inside the request. Today these are fast enough (<200ms typical). GitHub doesn't have Slack's hard 3-second budget, but a slow `/user/repos` call could trip GitHub's delivery timeout. A future change should split the handler into "200 OK first, process async".
- **Only `pull_request` events.** No `push`, no `issue_comment`, no `pull_request_review`. Linking a PR comment to an issue is not yet supported.
- **PAT-only auth.** No GitHub App support. PAT rotation means re-running `POST /api/github/connect` and regenerating the webhook secret (because the row is upserted with a new `webhook_secret`).
- **Webhook URL leaks the project UUID.** The path is `/api/github/webhook/:projectId` — knowing the project UUID is necessary but not sufficient to forge a webhook (signature still required), but the URL is shared in clear text with GitHub.
