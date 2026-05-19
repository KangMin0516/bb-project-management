# Claude Code Instructions

> **Start here:** [`AGENTS.md`](./AGENTS.md) is the vendor-neutral agent contract for this repo. Everything in there applies to Claude Code. This file only adds Claude-specific extensions.

---

## 1. Boot sequence

Every Claude Code session in this repo must load, in order:

1. [`.claude/config.md`](./.claude/config.md) — single source of truth (ports, paths, commands)
2. [`AGENTS.md`](./AGENTS.md) — agent contract (sub-agents, slash commands, hard rules)
3. [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — module map
4. The relevant per-domain changelog at [`docs/changelogs/`](./docs/changelogs/) for the area you're editing

Skip none of these — they encode constraints that are not re-derivable from the code alone.

---

## 2. Tool routing

Map common asks to the right Claude Code primitive instead of reinventing them.

| Intent | Use |
|---|---|
| Plan a feature / refactor | `/1-plan` (runs the `planner` agent) |
| Implement a planned change | `/2-implement` (runs `implementer`) |
| Review the working diff | `/3-review` (runs `code-reviewer`) |
| Write or extend tests | `/4-test` |
| Deploy / rollback | `/5-deploy` |
| Post-deploy verification | `/6-verify` |
| Service lifecycle (start/stop/logs) | `/0-run` |
| Author an architecture doc | the `architecture-doc-writer` skill |

Sub-agents are invoked via the Task tool. **Never re-implement an agent's logic inline** — if a behavior belongs in `planner`, fix it in [`.claude/agents/planner.md`](./.claude/agents/planner.md) and the next `/1-plan` will pick it up.

---

## 3. File-edit conventions

- Use `Edit` / `Write` tools, not shell `sed` / `echo > file`.
- Read a file before editing it (the tool enforces this).
- For mechanical bulk changes (e.g. add a second arg to N call sites), prefer a one-off Python script via the `Bash` tool — it's idempotent and reviewable in the diff. Avoid sub-agents for purely mechanical work; reserve them for tasks needing judgment.
- Don't add `// TODO` markers unless the user explicitly asks. Open a follow-up issue or note it in the PR description instead.

---

## 4. Commit conventions

Format: `type(scope): subject` — match the existing log (`git log --oneline -10`).

Common types: `feat`, `fix`, `refactor`, `chore`, `test`, `docs`. Scopes match the module (`api`, `web`, `auth`, `issue`, `slack`, …). When a refactor commit touches multiple modules, scope to the higher-level concern (e.g. `web` for an app-wide UI primitive migration).

Always sign commits with the Co-Authored-By trailer for Claude:

```
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

**Never commit unless the user explicitly asks.** "Save this" / "stash this" / "stage it" are not commit requests.

---

## 5. PR conventions

When the user asks for a PR:

1. Push the branch with `git push` (if it's not already pushed).
2. `gh pr create --base main --title ... --body ...` with:
   - 2–3 bullet **Summary** of what changed and why.
   - A **Test plan** checklist split between CI-automatable items (ticked) and manual smoke items (unticked).
   - Optional **Notes for reviewer** section flagging pre-existing issues you found but didn't fix, intentional carve-outs, or anything that looks weird-on-purpose.
3. Return the PR URL.

Do not mark anything in the test plan as ticked unless you actually ran it in this session.

---

## 6. Honest reporting

When the user asks "are you sure there are no issues?", give a real audit — not a victory lap. Run lint, type-check, unit tests, and the DI smoke test before answering. Separate the report into:

- **Verified** — what you actually ran and saw pass.
- **Not verified** — things you couldn't reach (Slack DM in real workspace, drag jitter via Playwright synth events, etc.).
- **Pre-existing** — failures present on `main`, not introduced by the current branch.

If you couldn't run something, say so. Don't claim coverage you didn't deliver.

---

## 7. Web UI specifics

The web app is mid-migration to shadcn primitives layered on Radix:

- Modals → [`packages/web/src/shared/ui/dialog.tsx`](./packages/web/src/shared/ui/dialog.tsx)
- Side panels → [`packages/web/src/shared/ui/sheet.tsx`](./packages/web/src/shared/ui/sheet.tsx)
- Selects → [`packages/web/src/shared/ui/select.tsx`](./packages/web/src/shared/ui/select.tsx)
- Dropdown menus → [`packages/web/src/shared/ui/dropdown-menu.tsx`](./packages/web/src/shared/ui/dropdown-menu.tsx)
- Command palette → [`packages/web/src/shared/ui/command.tsx`](./packages/web/src/shared/ui/command.tsx)
- Destructive confirms → `confirmDialog()` from [`packages/web/src/shared/ui/confirm-dialog.tsx`](./packages/web/src/shared/ui/confirm-dialog.tsx)

When wrapping a Radix overlay that the parent mounts conditionally (`{show && <Modal />}`), use [`packages/web/src/shared/lib/useDeferredClose.ts`](./packages/web/src/shared/lib/useDeferredClose.ts) so the exit animation has time to play before the parent unmounts.

Native `<select>` and `window.confirm` are banned (see [AGENTS.md §9](./AGENTS.md#9-hard-rules)). Use the primitives above.

---

## 8. Backend specifics

The API is mid-migration to Clean Architecture per [`REFACTOR_PLAN.md`](./REFACTOR_PLAN.md). For a module already migrated (Issue, Project, JoinRequest):

- Routes go through `*.controller.ts` → `*.use-case.ts` → `<X>Repository` port → `*.prisma.repository.ts`.
- Domain logic lives in `domain/<entity>.ts` (with `.spec.ts` next to it).
- Vendor SDK calls go through ports in `packages/api/src/common/ports/`:
  - `MessagingPort` (Slack) → `SlackAdapter`
  - `FileStoragePort` (S3) → `S3Adapter`
  - `AiCompletionPort` (Anthropic) → `AnthropicAdapter`
- Side-effect events go through the Outbox (see [`docs/changelogs/core-changelog.md`](./docs/changelogs/core-changelog.md) for the rollout flags).

For a module **not yet migrated**, follow the existing pattern — don't half-migrate.

---

## 9. Testing

Quick sanity checklist Claude should run before declaring "done":

```bash
pnpm --filter @bb-pm/web lint            # zero errors
pnpm --filter @bb-pm/web build           # vite build succeeds
pnpm --filter @bb-pm/api build           # nest build succeeds
pnpm --filter @bb-pm/api test            # unit tests green
pnpm --filter @bb-pm/api test:e2e        # DI smoke test green (app.e2e-spec.ts failure is pre-existing scaffold cruft)
```

If any of these fail in a way the change introduced, fix before reporting done.

---

## 10. Changelog discipline (read before every commit)

**Every behaviour-changing commit MUST update the matching per-domain changelog under [`docs/changelogs/`](./docs/changelogs/), in the same commit (or the same series of commits — never as a follow-up).** This is non-negotiable. See [AGENTS.md §6 / §9](./AGENTS.md#6-domain-history) for the same rule from the vendor-neutral side.

Mapping (commit scope → file):

| Scope of change | Changelog |
|---|---|
| `packages/api/src/external/` (the `/api/external/*` surface used by MCP/agents) | `external-api-changelog.md` |
| `packages/api/src/issue/`, `comment/`, `activity/`, web issue detail / activity / board | `issue-changelog.md` |
| `packages/web/src/shared/ui/` primitives, theme, shortcuts, app shell | `ui-changelog.md` |
| `packages/api/src/auth/`, `api-key/`, refresh-token plumbing | `auth-changelog.md` |
| `packages/api/src/notification/`, in-app + Slack DM delivery | `notification-changelog.md` |
| Slack OAuth + bot + slash commands | `slack-changelog.md` |
| Specifications, dashboards, standups, GitHub PR sync, etc. | use the matching `*-changelog.md` |
| MCP server schema / agent-facing tools | `mcp-changelog.md` |

Each entry: date heading (`### YYYY-MM-DD — Title (ISSUE-KEY, commit-sha)`), an **Added / Changed / Fixed** verb, a 2–3-sentence narrative including the *why*, then `- Source:` bullets listing the touched files. Match the style of the existing entries — read the top of the target file before writing.

**Do this every commit. If you forget, the next session will silently drift away from history.**

## 11. What not to do

- **Don't** invent commands. Use the slash commands in [`.claude/commands/`](./.claude/commands/).
- **Don't** create a top-level `CHANGELOG.md`. Use the per-domain files under [`docs/changelogs/`](./docs/changelogs/).
- **Don't** ship a feature commit without the matching changelog entry in the same commit (see §10).
- **Don't** write multi-paragraph docstrings or summary comments. One short line when the *why* is non-obvious.
- **Don't** add backwards-compat shims for code only this repo uses — delete the old usage and update callers.
- **Don't** narrate your reasoning in user-facing text. Show results, not deliberation.
