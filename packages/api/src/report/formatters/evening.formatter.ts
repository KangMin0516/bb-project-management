import type { Issue, User } from '../../../generated/prisma/client.js';
import type { MessageBlock } from '../../common/ports/messaging.port.js';
import { pushMrkdwnSections } from './utils.js';

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
): { blocks: MessageBlock[]; text: string; isEmpty: boolean } {
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const headerText = `[${projectName}] End of Day -- ${dateStr}`;
  const isEmpty =
    completedToday.length === 0 &&
    inProgress.length === 0 &&
    overdueIssues.length === 0 &&
    createdTodayCount === 0;
  const blocks: MessageBlock[] = [
    { type: 'header', text: headerText },
    {
      type: 'section',
      text: `:bar_chart: *Today's Summary*\n  :white_check_mark: Completed: ${completedToday.length}  |  :arrows_counterclockwise: In Progress: ${inProgress.length}  |  :sparkles: Created: ${createdTodayCount}`,
    },
  ];

  if (completedToday.length > 0) {
    blocks.push({ type: 'divider' });
    const lines = completedToday.map((i) => {
      const key = `${i.project.key}-${i.number}`;
      const link = `<${baseUrl}/projects/${i.projectId}/issues|${key}>`;
      const assignee = i.assignee?.name ?? 'Unassigned';
      return `  ${link}  ${i.title}    :bust_in_silhouette: ${assignee}`;
    });
    pushMrkdwnSections(blocks, `:white_check_mark: *Completed Today*`, lines);
  }

  if (inProgress.length > 0) {
    blocks.push({ type: 'divider' });
    const lines = inProgress.map((i) => {
      const key = `${i.project.key}-${i.number}`;
      const link = `<${baseUrl}/projects/${i.projectId}/issues|${key}>`;
      const assignee = i.assignee?.name ?? 'Unassigned';
      const prio = priorityEmoji[i.priority] ?? '';
      return `  ${link}  ${i.title}  :bust_in_silhouette: ${assignee}  ${prio}`;
    });
    pushMrkdwnSections(
      blocks,
      `:arrows_counterclockwise: *Still In Progress*`,
      lines,
    );
  }

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
    pushMrkdwnSections(
      blocks,
      `:warning: *Overdue (${overdueIssues.length})*`,
      lines,
    );
  }

  const percent = totalAll > 0 ? Math.round((totalDone / totalAll) * 100) : 0;
  blocks.push({ type: 'divider' });
  blocks.push({
    type: 'context',
    text: `:chart_with_upwards_trend: Overall: ${totalDone}/${totalAll} done (${percent}%)`,
  });

  return { blocks, text: headerText, isEmpty };
}
