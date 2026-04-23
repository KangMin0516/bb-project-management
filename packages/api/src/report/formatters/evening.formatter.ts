import type { Issue, User } from '../../../generated/prisma/client.js';
import { pushMrkdwnBlocks } from './utils.js';

type IssueWithAssignee = Issue & {
  assignee: User | null;
  project: { key: string };
};

const priorityEmoji: Record<string, string> = {
  HIGH: ':red_circle:',
  MEDIUM: ':large_yellow_circle:',
  LOW: ':white_circle:',
};

export function formatEveningReport(
  projectName: string,
  completedToday: IssueWithAssignee[],
  inProgress: IssueWithAssignee[],
  overdueIssues: IssueWithAssignee[],
  createdTodayCount: number,
  totalDone: number,
  totalAll: number,
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
      text: `[${projectName}] End of Day -- ${dateStr}`,
      emoji: true,
    },
  });

  // Summary stats
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `:bar_chart: *Today's Summary*\n  :white_check_mark: Completed: ${completedToday.length}  |  :arrows_counterclockwise: In Progress: ${inProgress.length}  |  :sparkles: Created: ${createdTodayCount}`,
    },
  });

  // Completed Today
  if (completedToday.length > 0) {
    blocks.push({ type: 'divider' });
    const lines = completedToday.map((i) => {
      const key = `${i.project.key}-${i.number}`;
      const link = `<${baseUrl}/projects/${i.projectId}/issues|${key}>`;
      const assignee = i.assignee?.name ?? 'Unassigned';
      return `  ${link}  ${i.title}    :bust_in_silhouette: ${assignee}`;
    });

    pushMrkdwnBlocks(blocks, `:white_check_mark: *Completed Today*`, lines);
  }

  // Still in progress
  if (inProgress.length > 0) {
    blocks.push({ type: 'divider' });
    const lines = inProgress.map((i) => {
      const key = `${i.project.key}-${i.number}`;
      const link = `<${baseUrl}/projects/${i.projectId}/issues|${key}>`;
      const assignee = i.assignee?.name ?? 'Unassigned';
      const prio = priorityEmoji[i.priority] ?? '';
      return `  ${link}  ${i.title}  :bust_in_silhouette: ${assignee}  ${prio}`;
    });

    pushMrkdwnBlocks(
      blocks,
      `:arrows_counterclockwise: *Still In Progress*`,
      lines,
    );
  }

  // Overdue
  if (overdueIssues.length > 0) {
    blocks.push({ type: 'divider' });
    const lines = overdueIssues.map((i) => {
      const key = `${i.project.key}-${i.number}`;
      const link = `<${baseUrl}/projects/${i.projectId}/issues|${key}>`;
      const assignee = i.assignee?.name ?? 'Unassigned';
      const dueStr = i.dueDate
        ? new Date(i.dueDate).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })
        : '';
      return `  ${link}  ${i.title}       :bust_in_silhouette: ${assignee}  :calendar: ${dueStr}`;
    });

    pushMrkdwnBlocks(
      blocks,
      `:warning: *Overdue (${overdueIssues.length})*`,
      lines,
    );
  }

  // Overall progress
  const percent = totalAll > 0 ? Math.round((totalDone / totalAll) * 100) : 0;
  blocks.push({ type: 'divider' });
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `:chart_with_upwards_trend: Overall: ${totalDone}/${totalAll} done (${percent}%)`,
      },
    ],
  });

  return { blocks, text: `[${projectName}] End of Day -- ${dateStr}` };
}
