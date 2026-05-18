import { describe, expect, it } from '@jest/globals';
import { formatEveningReport } from './evening.formatter.js';

const mkIssue = (number: number, title: string) =>
  ({
    id: `i${number}`,
    number,
    title,
    priority: 'MEDIUM',
    status: 'IN_PROGRESS',
    projectId: 'p1',
    project: { key: 'PRJ' },
    assignee: { id: 'u1', name: 'Alice' },
  }) as unknown as Parameters<typeof formatEveningReport>[1][number];

describe('formatEveningReport', () => {
  it('marks empty when all four counters are zero', () => {
    const { isEmpty } = formatEveningReport(
      'Project',
      [], // completedToday
      [], // inProgress
      [], // overdue
      0, // createdTodayCount
      71, // totalDone (historical, ignored for emptiness)
      80, // totalAll (historical, ignored)
      '',
    );
    expect(isEmpty).toBe(true);
  });

  it('marks non-empty when only completedToday has content', () => {
    const { isEmpty } = formatEveningReport(
      'Project',
      [mkIssue(1, 'Done today')],
      [],
      [],
      0,
      71,
      80,
      '',
    );
    expect(isEmpty).toBe(false);
  });

  it('marks non-empty when only inProgress has content', () => {
    const { isEmpty } = formatEveningReport(
      'Project',
      [],
      [mkIssue(2, 'WIP')],
      [],
      0,
      71,
      80,
      '',
    );
    expect(isEmpty).toBe(false);
  });

  it('marks non-empty when only overdue has content (overdue counts)', () => {
    const { isEmpty } = formatEveningReport(
      'Project',
      [],
      [],
      [mkIssue(3, 'Old bug')],
      0,
      71,
      80,
      '',
    );
    expect(isEmpty).toBe(false);
  });

  it('marks non-empty when only createdTodayCount > 0', () => {
    const { isEmpty } = formatEveningReport(
      'Project',
      [],
      [],
      [],
      1,
      71,
      80,
      '',
    );
    expect(isEmpty).toBe(false);
  });
});
