/**
 * MessagingPort — neutral abstraction for chat-style messaging.
 *
 * Consumers depend on this interface, not on a vendor SDK. The default
 * adapter targets Slack (`slack/infrastructure/slack.adapter.ts`); other
 * adapters (Discord, MS Teams) can be added later without touching
 * notification/report/join-request code.
 *
 * Scope (intentional): only the messaging shapes used in 4+ places —
 * DM, channel post, workspace status. Vendor-native features
 * (interactive buttons, ephemeral, user lookup) stay in the adapter
 * itself and are accessed by StandupService directly. See
 * refactor-plan.md §7.4 — "Hexagonal lite" trade-off.
 *
 * Error semantics differ by method intentionally — see method JSDoc.
 */

export const MESSAGING_PORT = Symbol('MESSAGING_PORT');

// ─── Neutral message blocks ─────────────────────────────────────
// These mirror only what existing senders use (notification DM,
// daily report, join request alert). The adapter translates these
// into Slack `KnownBlock` JSON. Adding a new block kind here is a
// breaking change — co-ordinate with adapter implementations.

export type MessageBlock =
  | { type: 'header'; text: string }
  /** Markdown-formatted section paragraph. */
  | { type: 'section'; text: string }
  /** 2-column field list — labels are inline with values, terse. */
  | { type: 'fields'; fields: string[] }
  | { type: 'divider' }
  /** Single primary action button as a deep link. */
  | {
      type: 'button_link';
      text: string;
      url: string;
      style?: 'primary' | 'danger';
    }
  /** Footer-style context line, small print. */
  | { type: 'context'; text: string };

// ─── Result types ───────────────────────────────────────────────

export type DeliveryReason =
  | 'no_integration' // No workspace installed
  | 'no_recipient' // DM channel could not be opened (user not in workspace)
  | 'rate_limited' // After max retries
  | 'unknown_error';

export interface SendResult {
  delivered: boolean;
  reason?: DeliveryReason;
}

export interface WorkspaceStatus {
  connected: boolean;
  integrationId?: string;
  teamName?: string;
}

// ─── Port ───────────────────────────────────────────────────────

export interface MessagingPort {
  /**
   * Best-effort DM to a workspace user. Caller treats the in-app
   * notification row as the source of truth — this is enrichment.
   * Never throws; returns `{ delivered: false, reason }` on any
   * failure so the caller can log without try/catch.
   *
   * Uses the most-recently-installed workspace (mirrors legacy
   * SlackService.sendDirectMessage behavior).
   */
  sendDirectMessage(
    recipientUserId: string,
    fallbackText: string,
    blocks: MessageBlock[],
  ): Promise<SendResult>;

  /**
   * Post to a channel via a specific workspace integration. Used by
   * scheduled reports + admin notifications. Throws after retry
   * budget is exhausted so the caller can log/alert — channel posts
   * are not best-effort, they're a contract.
   */
  sendChannelMessage(
    integrationId: string,
    channelId: string,
    fallbackText: string,
    blocks: MessageBlock[],
  ): Promise<void>;

  /** True if at least one workspace is connected. Cheap read. */
  getWorkspaceStatus(): Promise<WorkspaceStatus>;
}
