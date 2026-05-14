import type { MessageBlock } from '../../common/ports/messaging.port.js';

/**
 * Translates the neutral `MessageBlock` DTOs from the port into Slack
 * Block Kit JSON. Kept as a pure function so callers can snapshot-test
 * the output without booting Nest or hitting Slack.
 *
 * Type is `unknown[]` because Slack's KnownBlock is a sprawling union
 * not worth importing into the domain side — the adapter passes it
 * straight into `chat.postMessage({ blocks })` where it's typed as
 * `(KnownBlock | Block)[]`.
 */
export function toSlackBlocks(blocks: MessageBlock[]): unknown[] {
  return blocks.map(toSlackBlock);
}

function toSlackBlock(block: MessageBlock): unknown {
  switch (block.type) {
    case 'header':
      return {
        type: 'header',
        text: { type: 'plain_text', text: block.text },
      };

    case 'section':
      return {
        type: 'section',
        text: { type: 'mrkdwn', text: block.text },
      };

    case 'fields':
      return {
        type: 'section',
        fields: block.fields.map((text) => ({ type: 'mrkdwn', text })),
      };

    case 'divider':
      return { type: 'divider' };

    case 'button_link': {
      const button: Record<string, unknown> = {
        type: 'button',
        text: { type: 'plain_text', text: block.text },
        url: block.url,
      };
      if (block.style) button.style = block.style;
      return {
        type: 'actions',
        elements: [button],
      };
    }

    case 'context':
      return {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: block.text }],
      };
  }
}
