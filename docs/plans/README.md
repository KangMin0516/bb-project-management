# Plans

Concrete implementation plans, one file per feature. Each plan is the artifact that `/1-plan` produces and `/2-implement` consumes.

> A plan is **what we're about to build**, not what we've already built. After a plan ships, the relevant per-domain entry in [`docs/changelogs/`](../changelogs/) is updated and the plan stays as a historical record of the decision.

## Index

| File | Status | Domain | Summary |
|---|---|---|---|
| [`filter-persistence.md`](./filter-persistence.md) | **Proposed** | `ui`, frontend cross-cutting | Board / Issues / Timeline filters survive reload via URL searchParams sync. |
| [`slack-assignment-notification.md`](./slack-assignment-notification.md) | **Proposed** | `slack`, `notification` | When an issue's assignee changes, the new assignee receives a Slack DM (in addition to the existing in-app notification). |

## Convention

- File name: kebab-case, one feature per file.
- Status flow: `Proposed → Approved → In Progress → Shipped`. When `Shipped`, also list the merge commit SHA.
- Structure follows `.claude/agents/planner.md`:
  1. Requirement summary (the *what* + *why*).
  2. Affected services / files (with `file.ts:line` anchors).
  3. Proposed implementation, step by step.
  4. API / UI changes.
  5. Risks & considerations.
  6. Out of scope.
  7. Estimated effort.
