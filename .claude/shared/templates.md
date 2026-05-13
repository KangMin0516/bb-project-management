# Shared Templates

Canonical output formats used by every stage agent. Copy the relevant block, fill in the bracketed placeholders, and write to the appropriate `.claude/outputs/stage-N-*.md`.

---

## Report header (use at the top of every stage report)

```markdown
# Stage N: <Stage Name> Report

- **Written at**: <YYYY-MM-DD HH:mm timezone>
- **Branch**: <current git branch>
- **Base branch**: <e.g., main>
- **Affected services**: <api | web | shared | db | infra | ci>
- **Previous-stage input**: `.claude/outputs/stage-(N-1)-<name>.md` (read: yes/no)
- **Task summary**: <one-sentence description of what this run is for>
```

---

## Test case format (Stage 4 — QA Engineer)

Test cases are written in **English**, regardless of the user-facing language.

```markdown
| ID     | Section          | Scenario                                       | Type             | Input                          | Expected                                          |
|--------|------------------|------------------------------------------------|------------------|--------------------------------|---------------------------------------------------|
| API-01 | POST /projects   | Create project with valid payload              | Happy            | { name, key, description }     | 201, returns project with auto-seeded labels      |
| API-02 | POST /projects   | Reject duplicate project key                   | Error            | { key: <existing> }            | 409 Conflict, message "Project key … already exists" |
| API-03 | POST /projects   | Reject missing required field                  | Validation       | { name: "x" } (no key)         | 400, ValidationPipe rejects "key" as missing      |
| E2E-01 | Board page       | Drag issue BACKLOG → TODO                      | Happy            | one existing issue             | UI optimistic update; refresh shows TODO          |
| E2E-02 | Board page       | Drag issue → DONE → refresh                    | Happy            | one issue in IN_PROGRESS       | status persists; activity row "status: → DONE"    |
| E2E-03 | Board page       | Drag rapid sequence (10 cards / 5s)            | Edge             | full BACKLOG column            | no order conflicts; column renormalizes silently  |
```

**Type values**: `Happy`, `Validation`, `Edge`, `Error`, `Authorization`, `Performance`.

---

## Test result format

```markdown
| ID     | Result | HTTP / UI state | Duration | Notes              |
|--------|--------|-----------------|----------|--------------------|
| API-01 | PASS   | 201             | 142ms    |                    |
| API-02 | PASS   | 409             | 38ms     |                    |
| API-03 | FAIL   | 200 (expected 400) | 71ms  | ValidationPipe allowed missing `key` — see BR-01 |
```

Roll-up line: `API Total: <N> | PASS: <N> | FAIL: <N>  ·  E2E Total: <N> | PASS: <N> | FAIL: <N>`.

---

## Bug report format

One block per defect; use the next available `BR-<NN>` ID.

```markdown
### BR-01 — <one-line title>

- **Severity**: Critical | Major | Minor
- **Found in**: <Stage 3 review | Stage 4 test | Stage 6 verify>
- **Affected files**: `packages/api/src/project/project.service.ts:42`
- **Reproduction**:
  1. <step 1>
  2. <step 2>
  3. <step 3>
- **Expected**: <what should happen>
- **Actual**: <what actually happened, including the exact error message>
- **Evidence**: <screenshot path, log excerpt, curl output>
- **Suggested fix**: <one or two sentences; do not implement — flag for `/2-implement`>
- **Routing**: → `/2-implement` to fix, then `/3-review` → `/4-test`
```

---

## Severity classification (used across stages)

| Level | Definition | Examples | Action |
|---|---|---|---|
| **Critical** | Service down, data loss, security exposure, broken authentication | secret leaked in logs, SQL injection, infinite loop, 500 on login | Immediate rollback / block release |
| **Major / Warning** | Core feature broken, severe perf regression, regression of a tested flow | bulk delete deletes wrong rows, page load >5s, board drag persists wrong status | Must fix before merge |
| **Minor / Info** | UI cosmetic, non-core feature defect, small perf regression | misaligned button, dropdown z-index, ms-level slowdown | Track but may ship |

---

## Recovery-flow table format

Used in every command file to describe error → next-step routing.

```markdown
| Situation | Recovery |
|---|---|
| <symptom> | → <slash command> (and optionally an explanation) |
```

Example:
```markdown
| Lint / typecheck error          | → `/2-implement` to fix → re-run `/4-test` (review may be skipped) |
| Unit test fails (new regression) | → `/2-implement` → `/3-review` → `/4-test`                          |
| Unit test fails (pre-existing)   | Mark as known-failing, continue                                     |
```

---

## Deploy checklist format (Stage 5 — Deployer)

```markdown
### Preconditions
- [ ] Stage 3 (review) approved with no Critical findings
- [ ] Stage 4 (test) — all suites PASS
- [ ] Production build succeeds locally (`pnpm build`)
- [ ] No new env vars required, OR new vars are documented and added to prod secret store
- [ ] No DB migration pending, OR migration is reviewed and rollout-safe

### Per service
- [ ] api — Docker image builds (`make prod-build`)
- [ ] web — production bundle builds with no warnings
- [ ] db — Prisma migration applies cleanly on a fresh dev DB

### Infra
- [ ] No changes to `docker-compose.prod.yml` resource limits without approval
- [ ] No port / volume / network changes without approval
- [ ] `.env.example` updated if new vars were introduced
```

---

## Maintainability score format (Stage 3 — CTO Reviewer)

```markdown
### Maintainability score: <X>/10

| Axis            | Score | Notes                                  |
|-----------------|-------|----------------------------------------|
| Readability     | X/10  | <one-line reason>                      |
| Consistency     | X/10  | <one-line reason — pattern parity>     |
| Extensibility   | X/10  | <one-line reason — adding next thing>  |
| Testability     | X/10  | <one-line reason — pure-ness, DI use>  |
```

Use whole numbers. Don't grade your own work above 8 without explicit justification.

---

## Refactor suggestion format (Stage 3 — CTO Reviewer)

```markdown
### [Refactor] `packages/api/src/issue/issue.service.ts:447`

**Why**: The `update()` method now has 130+ lines, mutates the DTO in-place, and mixes 4 concerns (validation, side-effect activity rows, recheck flag, archive reset). New reviewers will struggle to trace which branch fires.

**Before**:
```typescript
if (data.startDate !== undefined) {
  (data as Record<string, unknown>).startDate = data.startDate
    ? new Date(data.startDate)
    : null;
}
// ... three identical blocks ...
```

**After**:
```typescript
const normalizeDate = (k: 'startDate' | 'dueDate' | 'focusDate') => {
  if (data[k] !== undefined) {
    (data as Record<string, unknown>)[k] = data[k] ? new Date(data[k]!) : null;
  }
};
normalizeDate('startDate'); normalizeDate('dueDate'); normalizeDate('focusDate');
```
```

---

## Pipeline summary table (Stage 6 — Verifier)

End every Stage 6 report with this rollup.

```markdown
### End-to-end pipeline summary

| Stage          | Status | Artifact                                  | Notes |
|----------------|--------|-------------------------------------------|-------|
| 1. Plan        | ✓ Done | `.claude/outputs/stage-1-plan.md`         |       |
| 2. Implement   | ✓ Done | `.claude/outputs/stage-2-implement.md`    | N files changed |
| 3. Review      | ✓ Approved | `.claude/outputs/stage-3-review.md`   | 0 Critical, 1 Warning |
| 4. Test        | ✓ Pass | `.claude/outputs/stage-4-test.md`         | API 12/12, E2E 8/8 |
| 5. Deploy      | ✓ Merged to `main` | `.claude/outputs/stage-5-deploy.md` | PR #123, CI green |
| 6. Verify      | ✓ Pass | `.claude/outputs/stage-6-verify.md`       | This file |
```
