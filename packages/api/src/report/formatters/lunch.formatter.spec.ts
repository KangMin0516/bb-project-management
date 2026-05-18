import { describe, expect, it } from '@jest/globals';
import { formatLunchReport } from './lunch.formatter.js';

const mkActivity = (id: string, field: 'status' | 'created') =>
  ({
    id,
    field,
    oldValue: field === 'status' ? 'TODO' : null,
    newValue: field === 'status' ? 'IN_PROGRESS' : null,
    issue: {
      id: 'i1',
      number: 1,
      title: 'Demo',
      projectId: 'p1',
      project: { key: 'PRJ' },
    },
    user: { id: 'u1', name: 'Alice' },
  }) as unknown as Parameters<typeof formatLunchReport>[1][number];

describe('formatLunchReport', () => {
  it('marks empty when no activities', () => {
    const { isEmpty } = formatLunchReport('Project', [], '');
    expect(isEmpty).toBe(true);
  });

  it('marks non-empty when there are activities', () => {
    const { isEmpty } = formatLunchReport(
      'Project',
      [mkActivity('a1', 'status')],
      '',
    );
    expect(isEmpty).toBe(false);
  });
});
