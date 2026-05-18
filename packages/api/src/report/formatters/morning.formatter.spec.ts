import { describe, expect, it } from '@jest/globals';
import { formatMorningReport } from './morning.formatter.js';

const mkIssue = (
  number: number,
  title: string,
  overrides: Partial<{ priority: string; status: string }> = {},
) =>
  ({
    id: `i${number}`,
    number,
    title,
    priority: overrides.priority ?? 'MEDIUM',
    status: overrides.status ?? 'TODO',
    projectId: 'p1',
    project: { key: 'PRJ' },
    assignee: { id: 'u1', name: 'Alice' },
  }) as unknown as Parameters<typeof formatMorningReport>[1][number];

describe('formatMorningReport', () => {
  it('marks empty when no issues and no overdues', () => {
    const { isEmpty, blocks } = formatMorningReport('Project', [], [], '');
    expect(isEmpty).toBe(true);
    expect(blocks.some((b) => b.type === 'header')).toBe(true);
  });

  it('marks non-empty when there are today issues', () => {
    const { isEmpty } = formatMorningReport(
      'Project',
      [mkIssue(1, 'Ship it')],
      [],
      '',
    );
    expect(isEmpty).toBe(false);
  });

  it('marks non-empty when only overdue exists (overdue counts as content)', () => {
    const { isEmpty } = formatMorningReport(
      'Project',
      [],
      [mkIssue(2, 'Old bug')],
      '',
    );
    expect(isEmpty).toBe(false);
  });
});
