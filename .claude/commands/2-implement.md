# Stage 2: Implement (`/2-implement`)

Translate the approved plan from Stage 1 into code. **Implements only what the plan says.**

## Execution mode: in-context

The Implementer role runs in the current Claude session (no subagent spawn).

### Procedure

1. Read `.claude/agents/implementer.md` and adopt the persona, principles, and workflow.
2. Read `.claude/outputs/stage-1-plan.md` to anchor on the approved plan.
   - Missing → check the conversation context for an inline plan. If neither exists, **stop** and instruct the user to run `/1-plan`.
3. Follow the agent's workflow: re-read every target file before editing it, implement plan-step by plan-step, then run the self-check checklist.
4. Save the implementation report to `.claude/outputs/stage-2-implement.md`.
5. **Wait for the user** before suggesting the next stage.

## Error recovery

| Situation | Recovery |
|---|---|
| Plan file missing                       | → `/1-plan` first.                                                              |
| Plan is ambiguous mid-implementation    | Ask the user; do not invent the missing detail.                                  |
| Existing code conflicts with the plan   | Report the conflict; ask the user whether to amend the plan or pivot the change. |
| New dependency required, not in plan    | Stop and ask before installing.                                                  |
| Discovered the change is bigger than planned | Report it, propose a phased approach, ask the user.                          |

## Next stage

- Implementation complete → `/3-review`

---

Starting implementation of `$ARGUMENTS`. Reading the plan and `.claude/agents/implementer.md` first.
