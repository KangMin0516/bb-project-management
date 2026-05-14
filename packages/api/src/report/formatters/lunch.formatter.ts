import type {
  Activity,
  Issue,
  User,
} from '../../../generated/prisma/client.js';
import type { MessageBlock } from '../../common/ports/messaging.port.js';
import { pushMrkdwnSections } from './utils.js';

type ActivityWithRelations = Activity & {
  issue: Issue & { project: { key: string } };
  user: User | null;
};

export function formatLunchReport(
  projectName: string,
  activities: ActivityWithRelations[],
  baseUrl: string,
): { blocks: MessageBlock[]; text: string } {
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const headerText = `[${projectName}] Midday Update -- ${dateStr}`;
  const blocks: MessageBlock[] = [{ type: 'header', text: headerText }];

  if (activities.length === 0) {
    blocks.push({ type: 'section', text: 'No changes today so far.' });
    return { blocks, text: headerText };
  }

  const relevant = activities.filter(
    (a) => a.field === 'status' || a.field === 'created',
  );

  const lines: string[] = [];
  let started = 0;
  let completed = 0;
  let created = 0;

  for (const a of relevant) {
    const key = `${a.issue.project.key}-${a.issue.number}`;
    const link = `<${baseUrl}/projects/${a.issue.projectId}/issues|${key}>`;
    const actor = a.user?.name ?? 'Unknown';

    if (a.field === 'status') {
      const line = `  ${link}  ${a.issue.title}      ${a.oldValue ?? '?'} -> ${a.newValue ?? '?'}     :bust_in_silhouette: ${actor}`;
      lines.push(line);
      if (a.newValue === 'DONE') completed++;
      if (a.newValue === 'IN_PROGRESS') started++;
    } else if (a.field === 'created') {
      lines.push(
        `  ${link}  ${a.issue.title}      :sparkles: Created               :bust_in_silhouette: ${actor}`,
      );
      created++;
    }
  }

  pushMrkdwnSections(
    blocks,
    `:arrows_counterclockwise: *Changes Today (${relevant.length})*`,
    lines,
  );

  blocks.push({ type: 'divider' });
  blocks.push({
    type: 'context',
    text: `:chart_with_upwards_trend: Today: ${started} started · ${completed} completed · ${created} created`,
  });

  return { blocks, text: headerText };
}
