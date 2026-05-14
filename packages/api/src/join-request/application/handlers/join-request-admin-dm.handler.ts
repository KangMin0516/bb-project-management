import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  MESSAGING_PORT,
  type MessageBlock,
  type MessagingPort,
} from '../../../common/ports/messaging.port.js';
import type { ClaimedOutboxRow } from '../../../outbox/outbox.repository.js';

/** Routing key for the per-admin Slack DM delivery event. */
export const JOIN_REQUEST_ADMIN_DM_DELIVERY = 'JoinRequestAdminDmDelivery';

/**
 * Payload shape published by `CreateJoinRequestUseCase` when the
 * outbox flag is on. One row per admin, so a Slack failure for one
 * recipient retries independently (vs the legacy single-loop that
 * couldn't recover individual misses).
 */
export interface JoinRequestAdminDmPayload {
  adminSlackUserId: string;
  projectName: string;
  projectKey: string;
  requesterName: string;
  message: string | null;
  settingsUrl: string;
}

/**
 * Renders the Slack Block Kit for a join-request admin DM and posts
 * via the messaging port. Throws on adapter failure so the outbox
 * publisher records the retry (vs the legacy "swallow + log" that
 * lost transient failures).
 */
@Injectable()
export class JoinRequestAdminDmHandler {
  private readonly logger = new Logger(JoinRequestAdminDmHandler.name);

  constructor(
    @Inject(MESSAGING_PORT) private readonly messaging: MessagingPort,
  ) {}

  async handle(row: ClaimedOutboxRow): Promise<void> {
    const payload = row.payload as JoinRequestAdminDmPayload;

    const blocks: MessageBlock[] = [
      { type: 'header', text: '📋 Project join request' },
      {
        type: 'section',
        text: `*${payload.requesterName}* has requested to join *${payload.projectName}*.`,
      },
      ...(payload.message
        ? ([
            { type: 'section', text: `> ${payload.message}` },
          ] satisfies MessageBlock[])
        : []),
      {
        type: 'button_link',
        text: 'Approve / Reject',
        url: payload.settingsUrl,
        style: 'primary',
      },
    ];
    const fallbackText = `${payload.requesterName} has requested to join ${payload.projectName}.`;

    const result = await this.messaging.sendDirectMessage(
      payload.adminSlackUserId,
      fallbackText,
      blocks,
    );
    if (!result.delivered) {
      // Throw so the publisher's retry budget kicks in. Unrecoverable
      // reasons (e.g. user left the workspace) eventually park the
      // row at MAX_ATTEMPTS.
      throw new Error(
        `Slack DM not delivered to ${payload.adminSlackUserId}: ${result.reason}`,
      );
    }
    this.logger.debug(
      `Delivered join-request DM to ${payload.adminSlackUserId} (${payload.projectKey})`,
    );
  }
}
