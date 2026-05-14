import { Issue, IssueDomainError } from './issue.entity.js';
import { IssueAssignedEvent } from './events/issue-assigned.event.js';
import { IssueCreatedEvent } from './events/issue-created.event.js';
import { validateTypeWithParent } from './issue-type.vo.js';
import { isTerminal } from './issue-status.vo.js';

const baseInput = {
  id: 'issue-1',
  projectId: 'project-1',
  number: 1,
  title: 'Add login flow',
  creatorId: 'user-creator',
  order: 1000,
};

describe('validateTypeWithParent (I-C1 / I-C2 / I-C3 / I-U2)', () => {
  it('rejects EPIC with a parent', () => {
    expect(validateTypeWithParent('EPIC', 'parent-1', 'TASK')).toBe(
      'EPIC_CANNOT_HAVE_PARENT',
    );
  });

  it('rejects SUB_TASK without a parent', () => {
    expect(validateTypeWithParent('SUB_TASK', null, null)).toBe(
      'SUB_TASK_REQUIRES_PARENT',
    );
  });

  it('rejects parent that is itself a SUB_TASK', () => {
    expect(validateTypeWithParent('TASK', 'parent-1', 'SUB_TASK')).toBe(
      'PARENT_CANNOT_BE_SUB_TASK',
    );
  });

  it('rejects self as parent', () => {
    expect(validateTypeWithParent('TASK', 'issue-1', 'TASK', 'issue-1')).toBe(
      'CANNOT_BE_OWN_PARENT',
    );
  });

  it('accepts TASK under EPIC', () => {
    expect(validateTypeWithParent('TASK', 'epic-1', 'EPIC')).toBeNull();
  });

  it('accepts SUB_TASK under TASK', () => {
    expect(validateTypeWithParent('SUB_TASK', 'task-1', 'TASK')).toBeNull();
  });
});

describe('Issue.create', () => {
  it('emits IssueCreatedEvent', () => {
    const issue = Issue.create({ ...baseInput, type: 'TASK' });
    const events = issue.pullEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(IssueCreatedEvent);
  });

  it('drain is idempotent — pullEvents twice gives empty the second time', () => {
    const issue = Issue.create({ ...baseInput, type: 'TASK' });
    issue.pullEvents();
    expect(issue.pullEvents()).toEqual([]);
  });

  it('defaults status=BACKLOG and priority=MEDIUM', () => {
    const issue = Issue.create({ ...baseInput, type: 'TASK' });
    expect(issue.status).toBe('BACKLOG');
    expect(issue.priority).toBe('MEDIUM');
  });

  it('rejects creation that violates hierarchy', () => {
    expect(() =>
      Issue.create({ ...baseInput, type: 'EPIC', parentId: 'p1' }),
    ).toThrow(IssueDomainError);
  });
});

describe('Issue.assign (I-U5 / I-U6 / I-U7)', () => {
  it('records assign event on first non-null assignment', () => {
    const issue = Issue.create({ ...baseInput, type: 'TASK' });
    issue.pullEvents(); // drain creation event
    issue.assign('user-a', 'user-creator');
    const events = issue.pullEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(IssueAssignedEvent);
    const evt = events[0] as IssueAssignedEvent;
    expect(evt.previousAssigneeId).toBeNull();
    expect(evt.newAssigneeId).toBe('user-a');
  });

  it('is a no-op when assigning the same user twice (no event emitted)', () => {
    const issue = Issue.create({
      ...baseInput,
      type: 'TASK',
      assigneeId: 'user-a',
    });
    issue.pullEvents();
    issue.assign('user-a', 'user-creator');
    expect(issue.pullEvents()).toEqual([]);
  });

  it('does not emit an event when unassigning to null', () => {
    // Per I-U5 the event is for delivery via Slack DM; unassign has no
    // DM equivalent, so the domain just records the state change.
    const issue = Issue.create({
      ...baseInput,
      type: 'TASK',
      assigneeId: 'user-a',
    });
    issue.pullEvents();
    issue.assign(null, 'user-creator');
    expect(issue.assigneeId).toBeNull();
    expect(issue.pullEvents()).toEqual([]);
  });

  it('rejects assignment on an archived issue', () => {
    const issue = Issue.create({ ...baseInput, type: 'TASK' });
    issue.archive();
    expect(() => issue.assign('user-a', 'actor')).toThrow(IssueDomainError);
  });

  it('captures previous assignee in the event so the deliverer can detect net no-op A→B→A', () => {
    const issue = Issue.create({
      ...baseInput,
      type: 'TASK',
      assigneeId: 'user-a',
    });
    issue.pullEvents();
    issue.assign('user-b', 'user-creator');
    const ev1 = issue.pullEvents()[0] as IssueAssignedEvent;
    issue.assign('user-a', 'user-creator');
    const ev2 = issue.pullEvents()[0] as IssueAssignedEvent;
    expect(ev1.previousAssigneeId).toBe('user-a');
    expect(ev1.newAssigneeId).toBe('user-b');
    expect(ev2.previousAssigneeId).toBe('user-b');
    expect(ev2.newAssigneeId).toBe('user-a');
    // Outbox deliverer can compare final DB state vs ev2.newAssigneeId
    // to decide skip on net no-op.
  });
});

describe('Issue.changeParent', () => {
  it('rejects cycle: cannot set parent to self', () => {
    const issue = Issue.create({ ...baseInput, type: 'TASK' });
    expect(() => issue.changeParent('issue-1', 'TASK')).toThrow(
      IssueDomainError,
    );
  });

  it('rejects setting parent to a SUB_TASK', () => {
    const issue = Issue.create({ ...baseInput, type: 'TASK' });
    expect(() => issue.changeParent('sub-1', 'SUB_TASK')).toThrow(
      IssueDomainError,
    );
  });

  it('no-op when parent unchanged', () => {
    const issue = Issue.create({
      ...baseInput,
      type: 'TASK',
      parentId: 'epic-1',
      parentType: 'EPIC',
    });
    const before = issue.toJSON().updatedAt;
    // Wait nothing — same value passed
    issue.changeParent('epic-1', 'EPIC');
    expect(issue.toJSON().updatedAt).toBe(before);
  });
});

describe('Issue.archive / unarchive', () => {
  it('archive sets archivedAt', () => {
    const issue = Issue.create({ ...baseInput, type: 'TASK' });
    expect(issue.isArchived).toBe(false);
    issue.archive();
    expect(issue.isArchived).toBe(true);
    expect(issue.archivedAt).toBeInstanceOf(Date);
  });

  it('unarchive clears archivedAt', () => {
    const issue = Issue.create({ ...baseInput, type: 'TASK' });
    issue.archive();
    issue.unarchive();
    expect(issue.isArchived).toBe(false);
  });
});

describe('IssueStatus VO', () => {
  it('treats DONE and CANCELED as terminal', () => {
    expect(isTerminal('DONE')).toBe(true);
    expect(isTerminal('CANCELED')).toBe(true);
  });

  it('treats other statuses as non-terminal', () => {
    expect(isTerminal('BACKLOG')).toBe(false);
    expect(isTerminal('IN_PROGRESS')).toBe(false);
    expect(isTerminal('REVIEW_QA')).toBe(false);
  });
});
