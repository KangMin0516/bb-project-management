import type { MessageBlock } from '../../common/ports/messaging.port.js';

const MRKDWN_SECTION_LIMIT = 2900; // Slack section limit is 3000 — keep margin.

/**
 * Append `header` + `lines` as one (or more) section blocks. Long content
 * is split across multiple sections so no single block exceeds the chat
 * provider's mrkdwn ceiling.
 *
 * NB: the 2900-char ceiling is sourced from Slack's documented limit.
 * Other providers may have different limits — when adding a new
 * MessagingPort adapter, treat oversize sections as the adapter's
 * responsibility to fragment, not the formatter's.
 */
export function pushMrkdwnSections(
  blocks: MessageBlock[],
  header: string,
  lines: string[],
): void {
  if (lines.length === 0) {
    blocks.push({ type: 'section', text: header });
    return;
  }

  let current = header;
  for (const line of lines) {
    const next = current + '\n' + line;
    if (next.length > MRKDWN_SECTION_LIMIT) {
      blocks.push({ type: 'section', text: current });
      current = line;
    } else {
      current = next;
    }
  }

  if (current) blocks.push({ type: 'section', text: current });
}
