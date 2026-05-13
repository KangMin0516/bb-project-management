# Stage 5: Deploy (`/5-deploy`)

Ship the change through the CI/CD pipeline. **Manual deploys are not permitted in this repo.**

## Execution mode: in-context (user-gated)

The Deployer role runs in the current Claude session because user confirmations are required at multiple points (push, PR creation, merge).

### Procedure

1. Read `.claude/agents/deployer.md` and adopt the persona, principles, and workflow.
2. **Run Step 0 of the agent procedure first** — verify `config.md` `CI/CD → enabled: true`. If not, abort with the agent's standard CI/CD-not-configured warning.
3. Verify `stage-3-review.md` shows 0 open Critical findings; verify `stage-4-test.md` shows all suites PASS. If either is missing or failing, abort and route the user back.
4. Follow the agent's procedure: branch → stage → commit → push → PR → CI watch → merge.
5. **Each user-visible action (push, PR, merge) requires explicit confirmation.** Do not proceed silently.
6. Save the deploy report to `.claude/outputs/stage-5-deploy.md`.

### Pipeline flow (visual)

```
Branch  →  Stage files (named)  →  Commit  →  [confirm]  →  push
       →   Open PR  →  [confirm]  →  CI checks  →  [all green]
       →   Merge (after [confirm])  →  Deploy pipeline triggers automatically
```

## Recovery matrix

| Situation | Recovery |
|---|---|
| CI/CD `enabled: false` in `config.md`        | Abort with the standard warning. Direct the user to configure CI/CD. |
| `gh` CLI missing                              | Tell the user to install (`brew install gh` / https://cli.github.com). Stop. |
| `stage-3-review.md` has open Critical         | Abort → `/2-implement` to address. |
| `stage-4-test.md` shows any FAIL             | Abort → `/2-implement` → `/4-test`. |
| Pre-commit hook fails                         | Fix the underlying issue, **create a new commit** (never `--amend` a committed change). Re-run. |
| CI check fails                                | Analyze the failure; route to `/2-implement` if it's a code defect, ask the user if it's a flake. |
| PR has merge conflict with `main`             | Rebase locally with user confirmation; or ask the user to resolve interactively. |
| Deploy pipeline fails after merge             | Read pipeline logs; if forward-fixable, new commit. Otherwise route to rollback. |
| Post-deploy production anomaly                | `git revert -m 1 <merge-sha>` → new PR → merge to roll back. |

## Safety reminders

- **Never** push with `--no-verify`.
- **Never** force-push to `main`.
- **Never** stage with blanket `git add .` — name files explicitly to avoid leaking `.env` / credentials.
- **Never** commit OS-generated files (`.DS_Store`, etc.) without intent.
- Always include the standard `Co-Authored-By` trailer in commit messages.

## Next stage

- Merge complete + deploy pipeline succeeded → `/6-verify`

---

Starting deploy preparation. Reading `.claude/agents/deployer.md` and verifying CI/CD configuration first.
