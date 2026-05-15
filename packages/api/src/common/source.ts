import type { Request } from 'express';

/**
 * Where a write originated from. Stored verbatim as a string on
 * `issues.source`, `activities.source`, `comments.source` so the DB
 * column stays open for future clients without a schema migration.
 *
 * - WEB:     interactive browser session (JwtAuthGuard)
 * - MCP:     bbpm-internal-mcp / Claude — detected via User-Agent
 * - SLACK:   Slack webhook (slash command, interaction)
 * - WEBHOOK: GitHub PR webhook, etc.
 * - API:     API-key client with no recognised User-Agent
 * - SYSTEM:  scheduled jobs (ReportScheduler, OutboxPublisher handlers)
 */
export type SourceLiteral =
  | 'WEB'
  | 'MCP'
  | 'SLACK'
  | 'WEBHOOK'
  | 'API'
  | 'SYSTEM';

/** Symbol attached to the Express request by the auth guards. */
const REQUEST_SOURCE_KEY = 'bbpmSource';

interface AugmentedRequest extends Request {
  [REQUEST_SOURCE_KEY]?: SourceLiteral;
}

/**
 * Decide which client made the request. Priority:
 *
 * 1. `X-Client-Source` header — explicit declaration from clients we
 *    own (bbpm-internal-mcp sends this). Wins because Node's http
 *    layer can rewrite User-Agent in subtle ways.
 * 2. `User-Agent` sniffing — best-effort fallback for third-party
 *    integrations (Slack, GitHub webhooks).
 * 3. Generic `API` when nothing matches.
 *
 * Called by `ApiKeyGuard` after validating the key so any endpoint
 * accepting API keys gets the same source resolution.
 */
export function detectSourceFromHeaders(headers: {
  'x-client-source'?: string | string[];
  'user-agent'?: string | string[];
}): SourceLiteral {
  const explicit = normaliseHeader(headers['x-client-source'])?.toUpperCase();
  if (explicit && isSourceLiteral(explicit)) return explicit;

  const userAgent = normaliseHeader(headers['user-agent']);
  if (!userAgent) return 'API';
  const ua = userAgent.toLowerCase();
  if (ua.includes('bbpm-mcp')) return 'MCP';
  if (ua.includes('slack') || ua.includes('slackbot')) return 'SLACK';
  if (ua.includes('github-hookshot') || ua.includes('webhook')) return 'WEBHOOK';
  return 'API';
}

/** Legacy entry point retained for any callers still passing UA only. */
export function detectSourceFromUserAgent(
  userAgent: string | undefined,
): SourceLiteral {
  return detectSourceFromHeaders({ 'user-agent': userAgent });
}

function normaliseHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function isSourceLiteral(s: string): s is SourceLiteral {
  return (
    s === 'WEB' ||
    s === 'MCP' ||
    s === 'SLACK' ||
    s === 'WEBHOOK' ||
    s === 'API' ||
    s === 'SYSTEM'
  );
}

/** Set the source on the request — called by guards once. */
export function setRequestSource(
  request: AugmentedRequest,
  source: SourceLiteral,
): void {
  request[REQUEST_SOURCE_KEY] = source;
}

/**
 * Read the source the active guard attached. Falls back to `WEB` so
 * legacy callers that haven't been threaded through a guard still
 * persist a sensible value.
 */
export function getRequestSource(request: AugmentedRequest): SourceLiteral {
  return request[REQUEST_SOURCE_KEY] ?? 'WEB';
}
