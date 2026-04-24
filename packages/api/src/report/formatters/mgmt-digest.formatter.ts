import { pushMrkdwnBlocks } from './utils.js';

export interface ProjectStats {
  projectId: string;
  projectName: string;
  projectKey: string;
  active: number;
  inProgress: number;
  completedToday: number;
  createdToday: number;
}

export interface MemberStats {
  userId: string;
  name: string;
  focus: number;
  inProgress: number;
  completedToday: number;
}

export interface OverdueIssue {
  projectKey: string;
  projectId: string;
  number: number;
  title: string;
  assigneeName: string | null;
  dueDate: Date;
}

export interface StalledIssue {
  projectKey: string;
  projectId: string;
  number: number;
  title: string;
  assigneeName: string | null;
  lastActivityAt: Date | null;
}

export interface DigestData {
  projectStats: ProjectStats[];
  memberStats: MemberStats[];
  overdueIssues: OverdueIssue[];
  stalledIssues: StalledIssue[];
  unassignedCount: number;
  standupMissing: string[]; // member names who didn't submit standup
}

function dateStr(): string {
  return new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatMorningDigest(
  data: DigestData,
  baseUrl: string,
): { blocks: unknown[]; text: string } {
  const blocks: unknown[] = [];
  const title = `Management Digest (Morning) -- ${dateStr()}`;

  // Header
  blocks.push({
    type: 'header',
    text: { type: 'plain_text', text: title, emoji: true },
  });

  // Section 1: Project Summary
  const activeProjects = data.projectStats.filter(
    (p) =>
      p.active > 0 ||
      p.inProgress > 0 ||
      p.completedToday > 0 ||
      p.createdToday > 0,
  );

  if (activeProjects.length > 0) {
    const projectLines = activeProjects.map((p) => {
      const link = `<${baseUrl}/projects/${p.projectId}/issues|${p.projectKey}>`;
      return `  ${link}  Active: ${p.active}  |  In Progress: ${p.inProgress}  |  Created Today: ${p.createdToday}`;
    });
    pushMrkdwnBlocks(blocks, ':clipboard: *Project Summary*', projectLines);
  }

  // Section 2: Member Check
  blocks.push({ type: 'divider' });
  if (data.memberStats.length > 0) {
    const memberLines = data.memberStats.map((m) => {
      const flags: string[] = [];
      if (m.focus + m.inProgress === 0) flags.push(':warning: No active work');
      if (m.inProgress > 5) flags.push(':fire: Overloaded');
      const flagStr = flags.length > 0 ? `  ${flags.join('  ')}` : '';
      return `  :bust_in_silhouette: *${m.name}*  Focus: ${m.focus}  |  In Progress: ${m.inProgress}${flagStr}`;
    });
    pushMrkdwnBlocks(
      blocks,
      ':busts_in_silhouette: *Member Status*',
      memberLines,
    );
  }

  // Section 3: Alerts
  blocks.push({ type: 'divider' });
  const alertLines: string[] = [];

  if (data.overdueIssues.length > 0) {
    alertLines.push(
      `:warning: *Overdue Issues (${data.overdueIssues.length})*`,
    );
    for (const i of data.overdueIssues) {
      const key = `${i.projectKey}-${i.number}`;
      const link = `<${baseUrl}/projects/${i.projectId}/issues|${key}>`;
      const dueStr = new Date(i.dueDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      alertLines.push(
        `  ${link}  ${i.title}  :bust_in_silhouette: ${i.assigneeName ?? 'Unassigned'}  :calendar: ${dueStr}`,
      );
    }
  }

  if (data.unassignedCount > 0) {
    alertLines.push(
      `\n:inbox_tray: Unassigned issues: *${data.unassignedCount}*`,
    );
  }

  if (alertLines.length > 0) {
    pushMrkdwnBlocks(blocks, ':rotating_light: *Needs Attention*', alertLines);
  } else {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: ':white_check_mark: No alerts this morning.',
      },
    });
  }

  return { blocks, text: title };
}

export function formatEveningDigest(
  data: DigestData,
  baseUrl: string,
): { blocks: unknown[]; text: string } {
  const blocks: unknown[] = [];
  const title = `Management Digest (Evening) -- ${dateStr()}`;

  // Header
  blocks.push({
    type: 'header',
    text: { type: 'plain_text', text: title, emoji: true },
  });

  // Section 1: Project Summary
  const activeProjects = data.projectStats.filter(
    (p) =>
      p.active > 0 ||
      p.inProgress > 0 ||
      p.completedToday > 0 ||
      p.createdToday > 0,
  );

  if (activeProjects.length > 0) {
    const projectLines = activeProjects.map((p) => {
      const link = `<${baseUrl}/projects/${p.projectId}/issues|${p.projectKey}>`;
      return `  ${link}  Completed: ${p.completedToday}  |  In Progress: ${p.inProgress}  |  Created: ${p.createdToday}`;
    });
    pushMrkdwnBlocks(blocks, ':bar_chart: *Project Summary*', projectLines);
  }

  // Section 2: Member Performance
  blocks.push({ type: 'divider' });
  if (data.memberStats.length > 0) {
    const memberLines = data.memberStats.map((m) => {
      const flags: string[] = [];
      if (m.focus + m.inProgress === 0) flags.push(':warning: No active work');
      if (m.inProgress > 5) flags.push(':fire: Overloaded');
      const flagStr = flags.length > 0 ? `  ${flags.join('  ')}` : '';
      return `  :bust_in_silhouette: *${m.name}*  Completed: ${m.completedToday}  |  In Progress: ${m.inProgress}${flagStr}`;
    });
    pushMrkdwnBlocks(
      blocks,
      ':busts_in_silhouette: *Member Performance*',
      memberLines,
    );
  }

  // Section 3: Alerts
  blocks.push({ type: 'divider' });
  const alertLines: string[] = [];

  if (data.stalledIssues.length > 0) {
    alertLines.push(
      `:hourglass: *Stalled Issues (${data.stalledIssues.length})*`,
    );
    for (const i of data.stalledIssues) {
      const key = `${i.projectKey}-${i.number}`;
      const link = `<${baseUrl}/projects/${i.projectId}/issues|${key}>`;
      const lastStr = i.lastActivityAt
        ? new Date(i.lastActivityAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })
        : 'never';
      alertLines.push(
        `  ${link}  ${i.title}  :bust_in_silhouette: ${i.assigneeName ?? 'Unassigned'}  Last: ${lastStr}`,
      );
    }
  }

  if (data.overdueIssues.length > 0) {
    alertLines.push(
      `\n:warning: *Overdue Issues (${data.overdueIssues.length})*`,
    );
    for (const i of data.overdueIssues) {
      const key = `${i.projectKey}-${i.number}`;
      const link = `<${baseUrl}/projects/${i.projectId}/issues|${key}>`;
      const dueStr = new Date(i.dueDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      alertLines.push(
        `  ${link}  ${i.title}  :bust_in_silhouette: ${i.assigneeName ?? 'Unassigned'}  :calendar: ${dueStr}`,
      );
    }
  }

  if (data.unassignedCount > 0) {
    alertLines.push(
      `\n:inbox_tray: Unassigned issues: *${data.unassignedCount}*`,
    );
  }

  if (data.standupMissing.length > 0) {
    alertLines.push(
      `\n:mega: *Standup not submitted (${data.standupMissing.length}):* ${data.standupMissing.join(', ')}`,
    );
  }

  if (alertLines.length > 0) {
    pushMrkdwnBlocks(blocks, ':rotating_light: *Needs Attention*', alertLines);
  } else {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: ':white_check_mark: All clear today!' },
    });
  }

  return { blocks, text: title };
}
