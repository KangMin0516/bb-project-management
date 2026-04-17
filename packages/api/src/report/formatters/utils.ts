const SLACK_MRKDWN_LIMIT = 2900; // Slack limit is 3000, keep margin

/**
 * Push mrkdwn section blocks, splitting into multiple blocks if text exceeds Slack's 3000-char limit.
 */
export function pushMrkdwnBlocks(
  blocks: unknown[],
  header: string,
  lines: string[],
): void {
  if (lines.length === 0) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: header },
    });
    return;
  }

  let current = header;
  for (const line of lines) {
    const next = current + '\n' + line;
    if (next.length > SLACK_MRKDWN_LIMIT) {
      // Flush current block
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: current },
      });
      current = line;
    } else {
      current = next;
    }
  }

  // Flush remaining
  if (current) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: current },
    });
  }
}
