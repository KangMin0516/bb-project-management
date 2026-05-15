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
 * Inspect the User-Agent header and decide which client made the call.
 * Called by `ApiKeyGuard` after validating the key so the same routing
 * can be reused regardless of which endpoint accepts API keys.
 */
export function detectSourceFromUserAgent(
  userAgent: string | undefined,
): SourceLiteral {
  if (!userAgent) return 'API';
  const ua = userAgent.toLowerCase();
  if (ua.includes('bbpm-mcp')) return 'MCP';
  if (ua.includes('slack') || ua.includes('slackbot')) return 'SLACK';
  if (ua.includes('github-hookshot') || ua.includes('webhook')) return 'WEBHOOK';
  return 'API';
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
