import type { Issue, User } from '../../../generated/prisma/client.js';
import { pushMrkdwnBlocks } from './utils.js';

type IssueWithAssignee = Issue & { assignee: User | null; project: { key: string } };

const priorityEmoji: Record<string, string> = {
  HIGH: ':red_circle: HIGH',
  MEDIUM: ':large_yellow_circle: MED',
  LOW: ':white_circle: LOW',
};

export function formatMorningReport(
  projectName: string,
  issues: IssueWithAssignee[],
  overdueIssues: IssueWithAssignee[],
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
      text: `[${projectName}] Morning Report -- ${dateStr}`,
      emoji: true,
    },
  });

  if (issues.length === 0 && overdueIssues.length === 0) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: 'No tasks for today. :tada:' },
    });
    return { blocks, text: `[${projectName}] Morning Report -- ${dateStr}` };
  }

  // Group by assignee
  const grouped = new Map<string, IssueWithAssignee[]>();
  for (const issue of issues) {
    const name = issue.assignee?.name ?? 'Unassigned';
    if (!grouped.has(name)) grouped.set(name, []);
    grouped.get(name)!.push(issue);
  }

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `:dart: *Today's Tasks (${issues.length})*`,
    },
  });

  for (const [assignee, assigneeIssues] of grouped) {
    const lines = assigneeIssues.map((i) => {
      const key = `${i.project.key}-${i.number}`;
      const link = `<${baseUrl}/projects/${i.projectId}/issues|${key}>`;
      const prio = priorityEmoji[i.priority] ?? '';
      return `  ${link}  ${i.title}    ${i.status}  ${prio}`;
    });

    pushMrkdwnBlocks(blocks, `:bust_in_silhouette: *${assignee} (${assigneeIssues.length})*`, lines);
  }

  // Overdue
  if (overdueIssues.length > 0) {
    blocks.push({ type: 'divider' });
    const overdueLines = overdueIssues.map((i) => {
      const key = `${i.project.key}-${i.number}`;
      const link = `<${baseUrl}/projects/${i.projectId}/issues|${key}>`;
      const assignee = i.assignee?.name ?? 'Unassigned';
      const dueStr = i.dueDate
        ? new Date(i.dueDate).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })
        : '';
      return `  ${link}  ${i.title}    :bust_in_silhouette: ${assignee}    :calendar: Due: ${dueStr}`;
    });

    pushMrkdwnBlocks(blocks, `:warning: *Overdue (${overdueIssues.length})*`, overdueLines);
  }

  return { blocks, text: `[${projectName}] Morning Report -- ${dateStr}` };
}
