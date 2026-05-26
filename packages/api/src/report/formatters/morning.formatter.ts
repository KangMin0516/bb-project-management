import type { Issue, User } from '../../../generated/prisma/client.js';
import type { MessageBlock } from '../../common/ports/messaging.port.js';
import { pushMrkdwnSections } from './utils.js';

type IssueWithAssignee = Issue & {
  assignee: User | null;
  project: { key: string };
};

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
): { blocks: MessageBlock[]; text: string; isEmpty: boolean } {
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const blocks: MessageBlock[] = [];
  const headerText = `[${projectName}] Morning Report -- ${dateStr}`;
  const isEmpty = issues.length === 0 && overdueIssues.length === 0;

  blocks.push({ type: 'header', text: headerText });

  if (isEmpty) {
    // Caller (ReportService.sendReport) should skip delivery when isEmpty.
    // Blocks still rendered so manual/preview callers see something coherent.
    blocks.push({ type: 'section', text: 'No tasks for today. :tada:' });
    return { blocks, text: headerText, isEmpty };
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
    text: `:dart: *Today's Tasks (${issues.length})*`,
  });

  for (const [assignee, assigneeIssues] of grouped) {
    const lines = assigneeIssues.map((i) => {
      const key = `${i.project.key}-${i.number}`;
      const link = `<${baseUrl}/projects/${i.projectId}/issues|${key}>`;
      const prio = priorityEmoji[i.priority] ?? '';
      return `  ${link}  ${i.title}    ${i.status}  ${prio}`;
    });

    pushMrkdwnSections(
      blocks,
      `:bust_in_silhouette: *${assignee} (${assigneeIssues.length})*`,
      lines,
    );
  }

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
      // Surface current status so REVIEW_QA/RECHECK items are visible at a
      // glance — PM 입장에서 "이미 검수 단계인지" 여부가 즉시 보여야 한다.
      return `  ${link}  ${i.title}    ${i.status}  :bust_in_silhouette: ${assignee}    :calendar: Due: ${dueStr}`;
    });

    pushMrkdwnSections(
      blocks,
      `:warning: *Overdue (${overdueIssues.length})*`,
      overdueLines,
    );
  }

  return { blocks, text: headerText, isEmpty };
}
