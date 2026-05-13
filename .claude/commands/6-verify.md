# Stage 6: Verify (`/6-verify`)

After deploy, confirm the service is healthy and the change works in the deployed environment. Final stage of the pipeline.

## Execution mode: subagent spawn (context isolation)

> **Always spawn a subagent.** Verification needs a clean context, free of the deployer's chatter.

### Procedure

1. Read `.claude/config.md` for service URLs and `critical_paths`.
2. Read `.claude/outputs/stage-5-deploy.md` to confirm the deploy succeeded and get the merge commit SHA.
   - Missing → instruct the user to run `/5-deploy` first.
3. **Spawn the verifier subagent**:
   ```
   Agent(
     subagent_type: "general-purpose",
     description: "Post-deploy verification",
     prompt: "Read .claude/agents/verifier.md and follow it exactly. Verify the deployed change against the production environment: health checks, change-scoped functional tests, critical-path regression. Return the full Stage 6 report."
   )
   ```
4. **Receive** the verifier's report. Save it to `.claude/outputs/stage-6-verify.md`.
5. **Surface Critical findings at the top** when reporting to the user — they may need to roll back immediately.

## Recovery matrix

| Situation | Recovery |
|---|---|
| Service down                                  | → `/0-run` to restart → re-run `/6-verify`. |
| Minor regression                              | → `/2-implement` → `/4-test` → `/5-deploy` → `/6-verify`. |
| Major regression in a critical path           | → `/2-implement` → `/3-review` → `/4-test` → `/5-deploy` → `/6-verify`. |
| **Critical** issue (data loss, security, broken auth, broken core flow) | **Roll back immediately** (`git revert -m 1 <merge-sha>` → new PR → merge), then restart the pipeline from `/2-implement`. |
| Chrome extension disconnected                 | Verification cannot complete. Pause and ask the user to enable it. |

## Next stage

- Verification passes → **Pipeline complete.** Mark the work as shipped.
- Verification fails → follow the recovery matrix.

---

Starting post-deploy verification. Spawning the verifier subagent.
