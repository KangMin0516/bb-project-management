---
name: architecture-doc-writer
description: Write production-grade system architecture documents — event-driven designs, migration plans, component breakdowns with Mermaid diagrams, sequence flows, state machines, queue topology, SQL schema changes, phased rollout plans, risk registers and SLOs. Use whenever the user asks for "kiến trúc", "architecture document", "system design doc", "migration plan", "tech design", "RFC", "high-level design", "HLD", "C4 diagram", "event-driven architecture writeup", or wants to document how a backend/distributed system should be refactored. Trigger even if the user only describes the system informally and asks you to "document it" or "viết tài liệu kiến trúc". Prefer this skill over freeform writing for any non-trivial system design longer than a few paragraphs.
---

# Architecture Doc Writer

A reusable skill for producing **deep, opinionated, diagram-rich** system architecture documents in the style of the `wg-marketing-be/docs/architecture_system/` corpus — event-driven backend designs, migration plans, and component deep-dives that engineers can actually build from.

Output language: **English** (technical English with crisp prose). If the user explicitly asks for Vietnamese, switch to Vietnamese + English technical terms.

---

## When to use

Trigger this skill whenever the user wants:

- A new architecture / HLD / RFC / tech design document
- A migration plan from a current (POC) state to a target state
- A deep-dive on a specific subsystem (autoscaler, message broker, provider abstraction, encoder pool, etc.)
- A cost-optimization or scaling strategy writeup
- Any document that needs C4 diagrams, sequence diagrams, state machines, ER diagrams, queue topologies, or phased Gantt timelines

If the user only gives a vague brief ("write me an arch doc for X"), follow the **Capture intent** section before writing.

---

## Core principles (apply to every document)

These are the design fingerprints of the reference corpus — keep them visible in everything you produce:

1. **Lead with a goal statement** in a blockquote. State the *user-visible* outcome (e.g., "100 livestreams → 100 elastic encoder instances, auto-stop when done"), not the implementation.
2. **Always include a "Hiện trạng & vấn đề" / "Current state & pain points"** section. Enumerate *numbered* pain points (P1, P2…) — they become the rationale for every design decision later.
3. **Architecture diagrams are mandatory.** At minimum: one C4-style context diagram + one container diagram. Prefer Mermaid; fall back to ASCII for fenced topology diagrams when ordering/columns matter.
4. **Every event-driven design specifies four things:** the event catalog (table), the queue topology (Mermaid graph), the routing key convention (code block), and at least one full sequence diagram per critical flow.
5. **State machines are diagrams, not prose.** Use Mermaid `stateDiagram-v2`.
6. **Schema changes go in a fenced SQL block** with explicit `ALTER TABLE` / `CREATE TABLE` statements, comments per column, and indexes.
7. **Migration is phased** — M0 / M1 / M2 … or Phase 0 / Phase 1 …, each with output, risk level, and a feature-flag rollback story. Include a Mermaid Gantt for the overall timeline.
8. **Decisions are traceable** — every choice gets a trade-off table (Decision · Pros · Cons · Mitigation) and a risk register (`#`, Risk, P, I, Mitigation).
9. **Quantify with SLOs** — give numeric acceptance criteria (P95 latency, throughput, queue lag) at the end.
10. **Cross-link related docs** in the front-matter blockquote (`> Related: ../foo.md`).

If any one of these is missing, the document is not done.

---

## How to write a document (workflow)

### Step 1 — Capture intent

Before producing anything, confirm:

1. **System scope** — what subsystem(s), which services, which schemas?
2. **Current state** — POC? Greenfield? Existing production?
3. **Driving forces** — performance, cost, reliability, multi-tenancy, vendor migration?
4. **Target scale** — concrete numbers (RPS, concurrent jobs, data volume)
5. **Constraints** — cloud provider, language/framework lock-in, team skillset
6. **Document type** — architecture overview, migration plan, deep-dive on one component, or cost-optimization alternative?
7. **Related docs** — does this slot under an existing architecture corpus? (Ask for paths.)

If the user can't answer all of these, ask the 2–3 most load-bearing ones via `AskUserQuestion`. Don't write past missing critical info.

### Step 2 — Pick a template variant

Read `assets/template-architecture.md` and pick (or compose) one of these variants:

| Variant | Use when | Section count |
|---|---|---|
| **Full architecture** | Net-new domain or major redesign | 12–14 sections |
| **Migration plan** | Moving from current state X to target Y, phased | 8–10 sections + Gantt |
| **Component deep-dive** | One service (autoscaler, provider abstraction) | 6–8 sections |
| **Cost / strategy alternative** | Trade-off oriented, multi-scenario projections | 10–14 sections |

When in doubt: full architecture for the first doc in a domain, then deep-dives that link back.

### Step 3 — Draft section by section

Use `references/section-checklist.md` to make sure each section hits the required beats. Skip sections that genuinely don't apply, but don't skip them silently — add a one-line note explaining why (e.g., "No schema changes for this doc — pure orchestration").

### Step 4 — Diagrams pass

Read `references/diagram-patterns.md` for ready-to-adapt Mermaid snippets covering:

- C4 context + container diagrams (with the `classDef` for "new vs existing vs external" colouring)
- Sequence diagrams with `actor`, `participant`, `loop`, `alt`, `par`, and `Note over`
- `stateDiagram-v2` for entity lifecycles
- `graph TB/LR` for queue topology (with subgraphs for Exchanges / Work Queues / DLQ)
- ASCII boxed diagrams for high-level topology when columns matter (see `references/diagram-patterns.md` for the box-drawing kit)
- Gantt charts for migration timelines
- ER diagrams (`erDiagram`) with `[NEW]`, `[CHG]`, `[DEL]` annotations on column comments

Every diagram needs a one-line caption above and a "Legend" or interpretive paragraph below if it uses colour coding or unusual notation.

### Step 5 — Tables pass

The reference corpus uses tables heavily. Make sure you have:

- **Event catalog table** — `Event | Producer | Consumer(s) | Purpose`
- **Tech stack table** — `Component | Tech | Why`
- **Trade-off table** — `Decision | Pros | Cons | Mitigation`
- **Migration phases table** — `Phase | Name | Output | Risk`
- **Risk register** — `# | Risk | P | I | Mitigation`
- **SLO table** — `Metric | Target`
- **Acceptance criteria table** — `# | Scenario | Expected`

### Step 6 — Self-review

Run through `references/section-checklist.md` once more as a literal checklist. Then verify:

- Every numbered pain point (P1, P2…) from the current-state section is addressed by at least one phase or component in the design
- Every event in the catalog appears in at least one sequence diagram or queue topology
- The Gantt's phase names match the migration table's phase names exactly
- The risk register cross-references mitigations that actually exist somewhere in the doc

---

## File layout for a new architecture doc

When the doc is being added to an existing corpus (like `docs/architecture_system/`), keep the same structure:

```
docs/architecture_system/
├── <domain>/
│   ├── <domain>-architecture.md       ← main HLD
│   ├── implementation-plan.md         ← phased plan w/ Gantt
│   ├── <component>-design.md          ← deep-dives
│   └── cost-optimization.md           ← strategy alternatives
└── entities-er-diagram.md             ← cross-domain ER (one per corpus)
```

For a greenfield project, propose this same layout in your first reply and create the directory.

---

## Output rules

- Use ATX headings (`#`, `##`, …) only — never setext.
- Top-level title is `# Architecture: <Title>` or `# <Domain>: <Subtitle>`.
- Wrap the goal statement in a blockquote (`>`) at the very top.
- Use Mermaid for any flow / sequence / state / graph / Gantt / ER diagram.
- Use fenced code blocks with explicit language tags (`sql`, `typescript`, `bash`, `mermaid`, `yaml`).
- Tables get header separators with `|---|---|`.
- Section dividers between top-level sections: `---` on its own line.
- Section numbering: `## 1. Title`, `### 1.1. Subtitle` — keep it consistent.
- File length: 400–1500 lines is normal for full architecture docs. Don't over-condense — depth is the point.

---

## Anti-patterns (do not do)

- **Don't summarize the current code as the design.** The doc is a *target* state, not a code tour.
- **Don't list events without showing how they flow.** Every event must appear in a sequence or topology diagram.
- **Don't write migration phases without rollback semantics.** Each phase needs a feature flag or a reversible deploy story.
- **Don't omit numbers from SLOs.** "Low latency" is not an SLO; "P95 < 300ms" is.
- **Don't invent details the user didn't confirm.** If you don't know the cloud provider, ask. If you don't know the message broker constraints, ask.
- **Don't skip the trade-off table for a major decision.** If you picked RabbitMQ over Kafka, justify it in a comparison table.

---

## Bundled references (read on demand)

- [`references/section-checklist.md`](references/section-checklist.md) — per-section beats and acceptance bar; read while drafting
- [`references/diagram-patterns.md`](references/diagram-patterns.md) — ready-to-adapt Mermaid + ASCII snippets
- [`references/sql-patterns.md`](references/sql-patterns.md) — outbox table, advisory locks, audit tables, idempotency keys
- [`references/event-driven-patterns.md`](references/event-driven-patterns.md) — outbox publisher, prefetch=1, DLQ, idempotency, circuit breaker, token bucket
- [`assets/template-architecture.md`](assets/template-architecture.md) — full skeleton to copy and fill
- [`assets/template-migration-plan.md`](assets/template-migration-plan.md) — phased migration skeleton
- [`assets/template-component-deepdive.md`](assets/template-component-deepdive.md) — one-component deep-dive skeleton

Load these only when you need them — don't dump them into context upfront.
