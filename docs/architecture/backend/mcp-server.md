# MCP Server

> **Moved.** The full MCP server architecture now lives at
> [`../mcp/`](../mcp/) as a three-doc corpus following the
> architecture-doc-writer template (HLD + phased plan + component deep-dive).

## Why this file is short

The architecture grew past what fits in a single backend-folder doc. The
[`docs/architecture/mcp/`](../mcp/) corpus has three reading lenses (HLD,
phased plan, OAuth deep-dive) plus a navigation README. Follow that link.

## Quick orientation

| Question | Where to look |
|---|---|
| What is MCP doing in BB-PM today? | [`../mcp/mcp-architecture.md` §1](../mcp/mcp-architecture.md#1-current-state--pain-points) |
| How does Claude Code → BB-PM work? | [`../mcp/mcp-architecture.md` §5.1](../mcp/mcp-architecture.md#51-flow-local-cli-tool-call-claude-code--mcp--bb-pm) |
| How does claude.ai → BB-PM work? | [`../mcp/mcp-architecture.md` §5.2](../mcp/mcp-architecture.md#52-flow-remote-oauth-21-pkce-handshake-claudeai--bb-pm-as) |
| What's shipped, what's next? | [`../mcp/implementation-plan.md`](../mcp/implementation-plan.md) |
| OAuth 2.1 design deep-dive | [`../mcp/oauth-server-design.md`](../mcp/oauth-server-design.md) |
| Commit history of the rollout | [`../../changelogs/mcp-changelog.md`](../../changelogs/mcp-changelog.md) |

## Why MCP is in `architecture/mcp/`, not `architecture/backend/`

The MCP surface spans the API (`packages/api/src/oauth/`,
`packages/api/src/external/`, `packages/api/src/api-key/`,
`packages/api/src/common/source.ts`) **and** the React SPA
(`OAuthAuthorizePage`, `features/api-key/`) **and** a separate
`bbpm-internal-mcp` npm package. It doesn't slot cleanly into "backend"
because the consent screen and the API-key UI are first-class
participants in the design. Promoting MCP to a sibling of `backend/` and
`frontend/` reflects that.
