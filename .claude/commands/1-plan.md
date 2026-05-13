# Stage 1: Plan (`/1-plan`)

Analyze a user requirement and produce a concrete implementation plan. No code is written at this stage.

## Execution mode: in-context

The Planner role runs in the current Claude session (no subagent spawn).

### Procedure

0. **Archive previous run** if `.claude/outputs/stage-1-plan.md` already exists. Follow `.claude/shared/procedures.md` §7 to move the existing `stage-*.md` files to `.claude/outputs/history/<YYYY-MM-DD>_<slug>/`. The slug is derived from the previous plan's title (falls back to `unknown`).
   ```bash
   # Inline summary (full version is in procedures.md §7):
   SLUG=$(head -1 .claude/outputs/stage-1-plan.md 2>/dev/null | sed -E 's/^# (Plan|기획서): *//' | tr -cd '[:alnum:]-_' | head -c 40)
   [ -z "$SLUG" ] && SLUG="unknown"
   DEST=".claude/outputs/history/$(date +%Y-%m-%d)_${SLUG}"
   mkdir -p "$DEST" && cp .claude/outputs/stage-*.md "$DEST/" 2>/dev/null && rm -f .claude/outputs/stage-*.md
   ```

1. Read `.claude/agents/planner.md` and adopt the persona, principles, and workflow.
2. Follow the agent's procedure to analyze `$ARGUMENTS`, explore the codebase, conduct the required Q&A, and write the plan.
3. Save the plan to `.claude/outputs/stage-1-plan.md`.
4. **Wait for explicit user approval** before suggesting the next stage. Do not proceed yourself.

## Error recovery

| Situation | Recovery |
|---|---|
| Requirement is ambiguous | Use `AskUserQuestion` to clarify before drafting. |
| Existing code conflicts with the proposed plan | Surface the conflict in the plan's "Risks" section; do not silently override. |
| The change is too large for a single plan | Propose a phased plan with explicit milestones; ask the user to confirm scope. |

## Next stage

- User approves the plan → `/2-implement`

---

Starting planning for `$ARGUMENTS`. Reading `.claude/agents/planner.md` first.
