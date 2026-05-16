# MCP Server — Architecture Corpus

> Documentation for the **`bbpm-internal-mcp`** rollout and the BB-PM endpoints it consumes. Three docs, each one with a different reading lens:

| Doc | Lens | Best for |
|---|---|---|
| [`mcp-architecture.md`](./mcp-architecture.md) | **HLD / current + target state** | First read. Pain points, C4 diagrams, every flow as a sequence diagram, state machines, schema, trade-offs, risk register, SLOs. |
| [`implementation-plan.md`](./implementation-plan.md) | **Phased rollout** | When you're about to ship the next phase. Gantt, per-phase tasks, acceptance criteria per phase, feature-flag rollback. |
| [`oauth-server-design.md`](./oauth-server-design.md) | **Component deep-dive on the OAuth 2.1 AS** | When you're debugging a token exchange or designing a security review. PKCE math, replay-proof invariants, failure-mode table, observability metrics. |

## Quick links

- **What is MCP doing in BB-PM today?** → [`mcp-architecture.md` §1](./mcp-architecture.md#1-current-state--pain-points)
- **Why did we pick OAuth 2.1 + opaque tokens?** → [`oauth-server-design.md` §2](./oauth-server-design.md#2-why-this-component-exists)
- **How does Claude Code talk to BB-PM?** → [`mcp-architecture.md` §5.1](./mcp-architecture.md#51-flow-local-cli-tool-call-claude-code--mcp--bb-pm)
- **How does claude.ai talk to BB-PM?** → [`mcp-architecture.md` §5.2](./mcp-architecture.md#52-flow-remote-oauth-21-pkce-handshake-claudeai--bb-pm-as)
- **What's shipped vs what's planned?** → [`implementation-plan.md` §1.2](./implementation-plan.md#12-timeline)
- **What can a stolen token actually do?** → [`oauth-server-design.md` §9.3](./oauth-server-design.md#93-what-a-stolen-credential-allows)
- **Commit-level history of the rollout?** → [`../../changelogs/mcp-changelog.md`](../../changelogs/mcp-changelog.md)

## Reading order

1. Skim [`mcp-architecture.md`](./mcp-architecture.md) §1 (pain points) and §2 (C4 diagrams).
2. Pick the flow that matches your task in §5 (local CLI, remote OAuth, refresh, revocation, expiry).
3. If you're implementing the next phase, switch to [`implementation-plan.md`](./implementation-plan.md) §8.
4. For OAuth-specific work, [`oauth-server-design.md`](./oauth-server-design.md) §4 (state machines) and §5 (decision logic) are the load-bearing sections.

## Conventions

- **Pain points are numbered `P1`–`P10`** in `mcp-architecture.md` §1.2. Every phase in the implementation plan addresses one or more by ID; every risk in the risk register references them by ID. Search for `P<n>` across the corpus to trace a concern end-to-end.
- **Phases are numbered `P0a..P0d` (shipped) and `P1..P5` (roadmap).** Phase names in the Gantt match the names in the per-phase task table — if they ever drift, the doc is broken.
- **Mermaid only.** No external diagram tools. PRs that introduce a binary diagram (PNG, SVG without source) should be rejected.
- **Don't duplicate diagrams across docs.** The deep-dives reference the parent diagrams by section number. If a diagram needs to change, change it in the HLD; the deep-dives inherit by reference.
