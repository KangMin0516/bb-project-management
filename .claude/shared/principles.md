# Shared Principles

These principles apply to **every** agent under `.claude/agents/` and every slash command under `.claude/commands/`. They are non-negotiable.

If a principle conflicts with a specific agent's instructions, the principle wins — agents must adapt or escalate to the user, never quietly bypass.

---

## 1. Minimal-change principle

- **Implement only what was requested.** No surrounding "while I'm here" cleanup, no proactive refactoring, no speculative abstractions.
- **Comments, docstrings, and type annotations** are added only to the code you actually touched.
- **Do not create new files** unless the plan explicitly requires them. Prefer editing existing files.
- **Do not introduce new dependencies** without flagging it to the user. If a third-party package is needed, justify it and wait for approval before installing.
- **A bug fix is not a refactor.** Three similar lines are better than a premature abstraction.

---

## 2. Read-before-write principle

- **Read the file before you edit it.** Even small edits require reading the surrounding ~30 lines for context.
- **Match existing patterns.** Same module → same import style, same naming, same control-flow shape. Inconsistency is technical debt.
- **Don't trust a diff alone.** A diff hides surrounding control flow, decorators, guards, and feature flags. Read the full function and its callers when the change is non-trivial.
- **For Prisma-touching changes**, verify the schema in `packages/api/prisma/schema.prisma` before assuming a column exists.

---

## 3. User-confirmation principle

The following operations **must** request explicit user confirmation before execution:

| Category | Examples |
|---|---|
| Destructive data ops | `docker compose down -v`, `make clean`, `prisma migrate reset`, dropping tables, `git reset --hard`, `git push --force` |
| Branch/PR mutations | creating a PR, merging a PR, deleting a branch (local or remote) |
| Production-impacting | running `/5-deploy`, modifying CI workflow files, rotating secrets, changing env vars in prod |
| Cross-stage progression | advancing from Stage N to Stage N+1 (the user explicitly approves each handoff) |

If you are uncertain, **ask**. The cost of a confirmation prompt is small; the cost of an unwanted destructive action is large.

---

## 4. `config.md` is the source of truth

- All project-specific values — paths, ports, commands, URLs, credentials, CI/CD settings — come from `.claude/config.md`.
- **Never hard-code these values** in an agent file, a command file, or a generated script. If a value is missing or wrong, fix `config.md`, not the consumer.
- If you discover that `config.md` is out of date (e.g., a port changed), pause and ask the user to update it before proceeding.

---

## 5. File-based stage handoff

The 6-stage pipeline passes data between stages **via files**, not via conversation context. This means:

- Every stage writes a single canonical report to `.claude/outputs/stage-N-<name>.md`.
- The next stage's agent **reads** the previous report as its first action.
- If the expected input file does not exist, the agent refuses to proceed and instructs the user to run the missing stage.
- Stage files are overwritten on re-run; the `/1-plan` command archives the previous run into `.claude/outputs/history/<YYYY-MM-DD>_<slug>/` before overwriting.

> **Why files, not context?** Stages may run in different Claude sessions, different agents, or hours apart. Context windows are ephemeral; files are durable.

---

## 6. Scope-of-review principle

- **Never review code that was not part of the current change.** Agents review the diff and the files immediately surrounding the diff — not the rest of the codebase.
- **Distinguish pre-existing issues from new issues** in every report. A test that was already failing on `main` is not a regression introduced by this change.
- The boundary is `git diff <base-branch>...HEAD` plus any newly-untracked files.

---

## 7. Evidence-based reporting

- **Numbers, not adjectives.** "Fast" is not a report — "P95 230ms over 100 requests" is.
- **Quote error messages verbatim** when reporting failures. Don't paraphrase.
- **Include exact reproduction steps** for any failure: command, environment, expected output, actual output.
- **Cite file paths with line numbers** (`packages/api/src/issue/issue.service.ts:447`) so the user can jump straight to the relevant code.

---

## 8. Stay in role

- Each agent has a defined scope. The Planner does not write code. The Code Reviewer does not fix the bugs it finds. The Tester does not modify implementations to make tests pass.
- If you discover work that belongs to a different stage, **report it and stop** — do not silently do the next agent's job. The orchestration is the user's; agents are specialists.

---

## 9. Fail loud, not silent

- **Never swallow an error** in a `try/catch` without either re-throwing or logging it with full context.
- If a tool call fails (a Bash command, a file read, an MCP call), surface the failure to the user. Do not retry blindly more than once.
- If a precondition is missing (no `.env`, no `gh` CLI, no Chrome extension), stop and tell the user — do not invent a workaround.
