# Section Checklist

Use this as a literal pass-through after drafting each section. Each row is a "must hit" beat for that section.

---

## Section 0 — Front matter

- [ ] `# Architecture: <Title>` heading
- [ ] Blockquote goal statement under the title (one to three sentences, user-visible outcome)
- [ ] Sub-blockquote with: `**Scope:**`, `**Yêu cầu cốt lõi / Core requirements:**` (bulleted), and `**Related:**` (relative links)
- [ ] `---` divider before section 1

---

## Section 1 — Current state & problems

- [ ] Two subsections: `### 1.1. Current state (POC / production)` and `### 1.2. Pain points`
- [ ] Current state lists **files / components** (not just concepts) with their responsibility — a table works well
- [ ] Pain points are **numbered** `P1, P2, …` with an `Impact` column — these IDs are referenced by phases later
- [ ] Each pain point has a *concrete* failure mode, not "could be better"

Bad: "Database is slow."
Good: "P3 — Sync cron iterates orders serially; with 1000 active orders the 5-minute tick doesn't finish in time → status stale."

---

## Section 2 — High-level architecture

- [ ] At least one diagram (Mermaid C4 context, or ASCII boxed topology if column alignment matters)
- [ ] Legend below the diagram if colour-coded
- [ ] One paragraph "reading the diagram" explanation
- [ ] Container diagram (Mermaid `graph LR` with subgraphs) if the system has 3+ runtime components

---

## Section 3 — Component breakdown

- [ ] One `### 3.N. <Component>` subsection per major service
- [ ] Each component has: **Responsibility** (bulleted), **Why this exists** (one paragraph), and either pseudo-code or a config example
- [ ] If the component is *new*, mark it; if it's *refactored*, link to the file it replaces
- [ ] At least one component shows the canonical loop / lifecycle (consume → process → ack → publish event)

---

## Section 4 — Domain events & queue topology

- [ ] Event catalog **table**: `Event | Producer | Consumer(s) | Purpose`
- [ ] Queue topology **diagram** (Mermaid `graph TB` with `Exchanges`, `Work Queues`, `DLQ` subgraphs)
- [ ] Routing key **convention** in a fenced code block (one key per line)
- [ ] Note on idempotency: how consumers dedupe (Redis key, DB unique constraint, etc.)
- [ ] Note on DLQ: where dead messages land, who gets alerted

---

## Section 5 — Core flows (sequence diagrams)

- [ ] One sequence diagram per *user-visible* flow (create, schedule, cancel, retry, failure)
- [ ] One sequence diagram per *failure mode* (provider down + circuit breaker, race condition + lock, retry exhaustion + DLQ)
- [ ] Each diagram uses `actor` for humans and `participant` for services
- [ ] `alt` / `par` / `loop` blocks for branching and concurrency
- [ ] `Note over X,Y: ...` for non-obvious context

---

## Section 6 — State machines

- [ ] One `stateDiagram-v2` per long-lived entity (order, livestream, VM, etc.)
- [ ] Every state name uppercase: `PENDING`, `PROCESSING`, `COMPLETED`, …
- [ ] Terminal states clearly marked with `--> [*]`
- [ ] State names match the values in the SQL enum exactly
- [ ] If a state has special semantics (circuit-breaker driven, manual-intervention required), add a `note right of <STATE>`

---

## Section 7 — Schema changes

- [ ] Fenced `sql` block(s) with `ALTER TABLE` and `CREATE TABLE` statements
- [ ] Every new column has a comment on what it's for (inline `--` or after the block)
- [ ] New indexes listed explicitly, with `WHERE` clauses for partial indexes when appropriate
- [ ] Outbox table included if the design is event-driven
- [ ] Audit / provider-call log table included if calling external APIs

---

## Section 8 — End-to-end scenario(s)

- [ ] At least one *realistic* timeline showing how the system behaves under target load
- [ ] Timestamps (`T0`, `T0+1s`, `T0+5s`, `T2h30`, …) to make latency visible
- [ ] At least one *failure* scenario (broker down, provider down, VM crashes mid-job)

---

## Section 9 — Tech stack

- [ ] Table: `Component | Tech | Why`
- [ ] Versions where they matter (e.g., `RabbitMQ 3.13+ cluster (3 nodes)`)
- [ ] Justification column is *concrete*, not "popular choice"

---

## Section 10 — Migration plan

- [ ] Mermaid `gantt` chart with all phases
- [ ] Table: `Phase | Name | Output | Risk`
- [ ] Each phase has a one-paragraph description and an "Output" that's a verifiable artefact
- [ ] Rollback / feature-flag strategy stated explicitly

---

## Section 11 — Trade-offs

- [ ] Table: `Decision | Pros | Cons | Mitigation`
- [ ] At least one row per "you could have done X instead" question a reviewer would ask
- [ ] Mitigation column is *concrete* (a config flag, a follow-up phase, a monitoring alert)

---

## Section 12 — Acceptance criteria & SLOs

- [ ] Functional table: `# | Scenario | Expected`
- [ ] SLO table: `Metric | Target` with **numeric** targets
- [ ] Both tables together cover every pain point from Section 1

---

## Section 13 — Risk register

- [ ] Table: `# | Risk | P | I | Mitigation`
- [ ] P = Probability (Low/Med/High), I = Impact (Low/Med/High)
- [ ] At least one mitigation that's actually a follow-up phase, not just monitoring

---

## Section 14 — Next steps (optional but recommended)

- [ ] 3–5 concrete actions the reader can take immediately
- [ ] A list of "things we could go deeper on" — invites follow-up docs

---

## Final whole-document pass

- [ ] Every `P<n>` from section 1 is addressed by name somewhere later (search the doc for `P1`, `P2`, …)
- [ ] Every event in the catalog appears in at least one diagram
- [ ] Every phase in the Gantt is in the migration table and vice versa
- [ ] Every component in section 3 appears in at least one diagram
- [ ] All Mermaid blocks parse (eyeball-check brackets, arrows, and quotes)
- [ ] No "TBD" left in production-ready sections — convert to "open question" callouts in a final section
