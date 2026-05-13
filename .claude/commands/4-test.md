# Stage 4: Test + QA (`/4-test`)

Run static analysis, builds, unit tests, API tests, and E2E browser tests **in parallel** via two specialist subagents.

## Execution mode: 2 subagents in parallel

> **Always spawn subagents.** Both run simultaneously in one message to halve wall-clock time.

### Procedure

1. Read `.claude/config.md` for project context and the `E2E / Browser Automation` section.
2. Read `.claude/outputs/stage-2-implement.md` for the change scope.
3. **Spawn both agents in parallel** (single message, two `Agent` tool calls):

   **Agent A — static / build / unit tests:**
   ```
   Agent(
     subagent_type: "general-purpose",
     description: "Static + build + unit tests",
     prompt: "Read .claude/agents/tester.md and follow it exactly. Run lint, typecheck, build, and unit tests against the change described in .claude/outputs/stage-2-implement.md. Return Part A of the Stage 4 report."
   )
   ```

   **Agent B — API + E2E tests:**
   ```
   Agent(
     subagent_type: "general-purpose",
     description: "API + E2E tests",
     prompt: "Read .claude/agents/qa-engineer.md and follow it exactly. Design test cases, run API tests via curl, run E2E tests via the Claude in Chrome MCP, and return Part B of the Stage 4 report."
   )
   ```

4. **Wait** for both reports.
5. **Merge** into a single Stage 4 report and save to `.claude/outputs/stage-4-test.md`.
6. Surface the overall verdict to the user.

### Merged report shape

```markdown
## Stage 4: Test Pipeline — Consolidated Report

### Summary
- **Overall**: PASS / FAIL
- **Static / Build / Unit (Part A)**: PASS / FAIL
- **API / E2E (Part B)**: PASS / FAIL

---

### Part A — Static / Build / Unit
<verbatim output from tester agent>

---

### Part B — API / E2E
<verbatim output from qa-engineer agent>
```

## Recovery matrix

| Situation | Recovery |
|---|---|
| Lint / typecheck error                   | → `/2-implement` → re-run `/4-test` (review may be skipped if Stage 3 already passed). |
| Build failure                            | → `/2-implement` → re-run `/4-test`. |
| Unit test fails — new regression         | → `/2-implement` → `/3-review` → `/4-test`. |
| Unit test fails — pre-existing           | Mark as known failure, continue. |
| API test fails                           | → `/2-implement` → re-run `/4-test`. |
| E2E test fails                           | → `/2-implement` → re-run `/4-test`. |
| Chrome extension not connected           | Ask the user to activate it. **Do not** mark E2E PASS in its absence; re-run `/4-test`. |
| Environment problem (service down)       | → `/0-run start` to restart, then re-run `/4-test`. |

## Next stage

- All PASS → `/5-deploy`
- Any FAIL → follow the recovery matrix above

---

Starting Stage 4 for `$ARGUMENTS`. Spawning Tester and QA Engineer in parallel.
