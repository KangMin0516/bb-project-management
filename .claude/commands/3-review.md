# Stage 3: Code Review (`/3-review`)

A 2-step review pipeline. Two specialist subagents review the same change from complementary angles, then the command merges their findings.

## Execution mode: subagent spawn (context isolation)

> **Always spawn subagents.** Reviewers need a clean context — they should not be tainted by the implementation session's chatter. Use the `Agent` tool with `subagent_type: general-purpose`.

### Procedure

1. Read `.claude/config.md` to understand the project context.
2. Read `.claude/outputs/stage-2-implement.md` so you know what to review.
3. **Spawn the two reviewers in parallel** (single message, two `Agent` tool calls):

   **Reviewer A — functional correctness, security, performance:**
   ```
   Agent(
     subagent_type: "general-purpose",
     description: "Functional/security code review",
     prompt: "Read .claude/agents/code-reviewer.md and follow it exactly to review the changes described in .claude/outputs/stage-2-implement.md. Return Part A of the Stage 3 report."
   )
   ```

   **Reviewer B — maintainability, conventions, architecture:**
   ```
   Agent(
     subagent_type: "general-purpose",
     description: "Maintainability/CTO code review",
     prompt: "Read .claude/agents/cto.md and follow it exactly to review the changes described in .claude/outputs/stage-2-implement.md. Return Part B of the Stage 3 report."
   )
   ```

4. **Merge** Part A (from Reviewer A) and Part B (from Reviewer B) into a single document and save to `.claude/outputs/stage-3-review.md`. Surface the verdicts at the top.
5. **Report to the user** with the consolidated verdict and the count of Critical / Warning / Info findings.

### Merge rules

- **Severity conflicts (same file, same issue, different severity)**: take the higher severity.
- **Topical conflicts (different recommendations)**: CTO findings win for maintainability/style; Code Reviewer findings win for correctness/security. State the conflict and the resolution in the merged report.
- **Do not invent findings.** Only include what the subagents reported.
- **Do not re-review unchanged code.**

## Recovery matrix

| Situation | Recovery |
|---|---|
| ≥1 Critical finding             | → `/2-implement` to fix → `/3-review` again. **Block** progression to test. |
| Warnings only                   | User decides: `/2-implement` to address, or proceed to `/4-test` and revisit later. |
| Info only / no findings         | Approved → `/4-test`. |
| Subagent A returns malformed report | Re-spawn Reviewer A with a corrective prompt. |
| Both subagents disagree on a flag | Apply the merge rules above; surface the disagreement in the merged report so the user can override. |

## Next stage

- Approved (0 Critical) → `/4-test`

---

Starting 2-step review on the most recent change. Spawning both reviewers in parallel.
