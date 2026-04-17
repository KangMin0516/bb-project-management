import type { Activity, Issue, User } from '../../../generated/prisma/client.js';
import { pushMrkdwnBlocks } from './utils.js';

type ActivityWithRelations = Activity & {
  issue: Issue & { project: { key: string } };
  user: User | null;
};

export function formatLunchReport(
  projectName: string,
  activities: ActivityWithRelations[],
  baseUrl: string,
): { blocks: unknown[]; text: string } {
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const blocks: unknown[] = [];

  // Header
  blocks.push({
    type: 'header',
    text: {
      type: 'plain_text',
      text: `[${projectName}] Midday Update -- ${dateStr}`,
      emoji: true,
    },
  });

  if (activities.length === 0) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: 'No changes today so far.' },
    });
    return { blocks, text: `[${projectName}] Midday Update -- ${dateStr}` };
  }

  // Format activities
  const lines: string[] = [];
  let started = 0;
  let completed = 0;
  let created = 0;

  for (const a of activities) {
    const key = `${a.issue.project.key}-${a.issue.number}`;
    const link = `<${baseUrl}/projects/${a.issue.projectId}/issues|${key}>`;
    const actor = a.user?.name ?? 'Unknown';

    if (a.field === 'status') {
      const line = `  ${link}  ${a.issue.title}      ${a.oldValue ?? '?'} -> ${a.newValue ?? '?'}     :bust_in_silhouette: ${actor}`;
      lines.push(line);
      if (a.newValue === 'DONE') completed++;
      if (a.newValue === 'IN_PROGRESS') started++;
    } else if (a.field === 'assignee') {
      lines.push(
        `  ${link}  ${a.issue.title}      Assigned -> ${a.newValue ?? '?'}`,
      );
    } else if (a.field === 'priority') {
      lines.push(
        `  ${link}  ${a.issue.title}      Priority: ${a.oldValue ?? '?'} -> ${a.newValue ?? '?'}`,
      );
    } else if (a.field === 'created') {
      lines.push(
        `  ${link}  ${a.issue.title}      :sparkles: Created               :bust_in_silhouette: ${actor}`,
      );
      created++;
    } else {
      lines.push(
        `  ${link}  ${a.issue.title}      ${a.field}: ${a.oldValue ?? ''} -> ${a.newValue ?? ''}     :bust_in_silhouette: ${actor}`,
      );
    }
  }

  pushMrkdwnBlocks(blocks, `:arrows_counterclockwise: *Changes Today (${activities.length})*`, lines);

  // Summary line
  blocks.push({ type: 'divider' });
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `:chart_with_upwards_trend: Today: ${started} started · ${completed} completed · ${created} created`,
      },
    ],
  });

  return { blocks, text: `[${projectName}] Midday Update -- ${dateStr}` };
}
