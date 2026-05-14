import { describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { NotificationService } from '../../notification/notification.service.js';
import type {
  IssueRepository,
  IssueRowForUpdate,
} from './ports/issue.repository.js';
import { UpdateIssueUseCase } from './update-issue.use-case.js';

const EXISTING: IssueRowForUpdate = {
  id: 'i-1',
  projectId: 'p-1',
  number: 42,
  title: 'Original',
  description: null,
  type: 'TASK',
  status: 'BACKLOG',
  priority: 'MEDIUM',
  parentId: null,
  assigneeId: null,
  reviewerAssigneeId: null,
  startDate: null,
  dueDate: null,
  focusDate: null,
  isRecheck: false,
  archivedAt: null,
};

function makeRepo(overrides: Partial<IssueRepository> = {}): IssueRepository {
  return {
    findForUpdate: jest.fn(async () => EXISTING),
    parentChainContains: jest.fn(async () => false),
    fetchParentType: jest.fn(async () => 'EPIC'),
    findRecentActivityForCoalesce: jest.fn(async () => null),
    deleteActivity: jest.fn(async () => undefined),
    updateWithLinksAndActivities: jest.fn(async () => ({ id: 'i-1' })),
    fetchProjectKey: jest.fn(async () => 'ALP'),
    fetchUserName: jest.fn(async () => 'Alice'),
    findUnassignedChildren: jest.fn(async () => []),
    bulkAssignChildren: jest.fn(async () => undefined),
    createWithSequenceAndActivity: jest.fn(),
    resolveComponentDefaultAssignee: jest.fn(),
    ...overrides,
  } as unknown as IssueRepository;
}

function makeNotifications(): NotificationService {
  return {
    scheduleAssignmentNotification: jest.fn(),
    cancelPendingAssignment: jest.fn(),
  } as unknown as NotificationService;
}

describe('UpdateIssueUseCase — lookup + scoping', () => {
  it('throws NotFound when issue does not exist', async () => {
    const uc = new UpdateIssueUseCase(
      makeRepo({ findForUpdate: jest.fn(async () => null) }),
      makeNotifications(),
    );
    await expect(
      uc.execute({
        projectId: 'p-1',
        issueId: 'missing',
        actorId: 'u',
        changes: { title: 'x' },
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFound when issue belongs to a different project', async () => {
    const uc = new UpdateIssueUseCase(
      makeRepo({
        findForUpdate: jest.fn(async () => ({
          ...EXISTING,
          projectId: 'p-OTHER',
        })),
      }),
      makeNotifications(),
    );
    await expect(
      uc.execute({
        projectId: 'p-1',
        issueId: 'i-1',
        actorId: 'u',
        changes: { title: 'x' },
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('UpdateIssueUseCase — hierarchy (I-U1 / I-U2)', () => {
  it('rejects setting parent to self', async () => {
    const uc = new UpdateIssueUseCase(makeRepo(), makeNotifications());
    await expect(
      uc.execute({
        projectId: 'p-1',
        issueId: 'i-1',
        actorId: 'u',
        changes: { parentId: 'i-1' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects cycle (parent chain reaches self)', async () => {
    const uc = new UpdateIssueUseCase(
      makeRepo({
        parentChainContains: jest.fn(async () => true),
        fetchParentType: jest.fn(async () => 'TASK'),
      }),
      makeNotifications(),
    );
    await expect(
      uc.execute({
        projectId: 'p-1',
        issueId: 'i-1',
        actorId: 'u',
        changes: { parentId: 'i-grandchild' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when new parent type is SUB_TASK', async () => {
    const uc = new UpdateIssueUseCase(
      makeRepo({ fetchParentType: jest.fn(async () => 'SUB_TASK') }),
      makeNotifications(),
    );
    await expect(
      uc.execute({
        projectId: 'p-1',
        issueId: 'i-1',
        actorId: 'u',
        changes: { parentId: 'i-sub' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('UpdateIssueUseCase — archive reset (I-U4) + isRecheck transitions (I-U3)', () => {
  it('clears archivedAt when moving out of DONE/CANCELED', async () => {
    const updateSpy = jest.fn(async () => ({ id: 'i-1' }));
    const uc = new UpdateIssueUseCase(
      makeRepo({
        findForUpdate: jest.fn(async () => ({
          ...EXISTING,
          status: 'DONE',
          archivedAt: new Date('2025-01-01'),
        })),
        updateWithLinksAndActivities: updateSpy,
      }),
      makeNotifications(),
    );

    await uc.execute({
      projectId: 'p-1',
      issueId: 'i-1',
      actorId: 'u',
      changes: { status: 'IN_PROGRESS' },
    });

    const payload = (updateSpy as jest.Mock).mock.calls[0][0] as {
      fieldUpdates: Record<string, unknown>;
    };
    expect(payload.fieldUpdates.archivedAt).toBeNull();
  });

  it('sets isRecheck=true when returning to IN_PROGRESS from a later stage', async () => {
    const updateSpy = jest.fn(async () => ({ id: 'i-1' }));
    const uc = new UpdateIssueUseCase(
      makeRepo({
        findForUpdate: jest.fn(async () => ({
          ...EXISTING,
          status: 'REVIEW_QA',
        })),
        updateWithLinksAndActivities: updateSpy,
      }),
      makeNotifications(),
    );

    await uc.execute({
      projectId: 'p-1',
      issueId: 'i-1',
      actorId: 'u',
      changes: { status: 'IN_PROGRESS' },
    });

    const payload = (updateSpy as jest.Mock).mock.calls[0][0] as {
      fieldUpdates: Record<string, unknown>;
    };
    expect(payload.fieldUpdates.isRecheck).toBe(true);
  });

  it('clears isRecheck when moving away from IN_PROGRESS', async () => {
    const updateSpy = jest.fn(async () => ({ id: 'i-1' }));
    const uc = new UpdateIssueUseCase(
      makeRepo({
        findForUpdate: jest.fn(async () => ({
          ...EXISTING,
          status: 'IN_PROGRESS',
          isRecheck: true,
        })),
        updateWithLinksAndActivities: updateSpy,
      }),
      makeNotifications(),
    );

    await uc.execute({
      projectId: 'p-1',
      issueId: 'i-1',
      actorId: 'u',
      changes: { status: 'TODO' },
    });

    const payload = (updateSpy as jest.Mock).mock.calls[0][0] as {
      fieldUpdates: Record<string, unknown>;
    };
    expect(payload.fieldUpdates.isRecheck).toBe(false);
  });
});

describe('UpdateIssueUseCase — activity diff (I-U12)', () => {
  it('emits activity rows for changed tracked fields only', async () => {
    const updateSpy = jest.fn(async () => ({ id: 'i-1' }));
    const uc = new UpdateIssueUseCase(
      makeRepo({ updateWithLinksAndActivities: updateSpy }),
      makeNotifications(),
    );

    await uc.execute({
      projectId: 'p-1',
      issueId: 'i-1',
      actorId: 'u',
      changes: {
        title: 'Original', // unchanged → no activity
        priority: 'HIGH', // changed
      },
    });

    const payload = (updateSpy as jest.Mock).mock.calls[0][0] as {
      activities: Array<{ field: string }>;
    };
    expect(payload.activities.map((a) => a.field)).toEqual(['priority']);
  });
});

describe('UpdateIssueUseCase — assignment + silent (I-U5 / I-U11)', () => {
  it('schedules a Slack DM when assignee changes', async () => {
    const notifications = makeNotifications();
    const uc = new UpdateIssueUseCase(makeRepo(), notifications);

    await uc.execute({
      projectId: 'p-1',
      issueId: 'i-1',
      actorId: 'u-actor',
      changes: { assigneeId: 'u-new' },
    });

    expect(notifications.scheduleAssignmentNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ASSIGNED',
        userId: 'u-new',
        issueId: 'i-1',
      }),
    );
  });

  it('cancels pending DM (no schedule) when silent=true', async () => {
    const notifications = makeNotifications();
    const uc = new UpdateIssueUseCase(makeRepo(), notifications);

    await uc.execute({
      projectId: 'p-1',
      issueId: 'i-1',
      actorId: 'u-actor',
      silent: true,
      changes: { assigneeId: 'u-new' },
    });

    expect(notifications.scheduleAssignmentNotification).not.toHaveBeenCalled();
    expect(notifications.cancelPendingAssignment).toHaveBeenCalledWith(
      'i-1',
      'ASSIGNED',
    );
  });

  it('drops the assignee activity row + cancels DM on net no-op A→B→A (I-U7)', async () => {
    const updateSpy = jest.fn(async () => ({ id: 'i-1' }));
    const deleteSpy = jest.fn(async () => undefined);
    const notifications = makeNotifications();
    const uc = new UpdateIssueUseCase(
      makeRepo({
        findForUpdate: jest.fn(async () => ({
          ...EXISTING,
          assigneeId: 'u-B', // existing reflects the most-recent change
        })),
        // Recent activity row was A→B by the same user; now they re-assign to A.
        findRecentActivityForCoalesce: jest.fn(async () => ({
          id: 'act-old',
          oldValue: 'u-A',
        })),
        deleteActivity: deleteSpy,
        updateWithLinksAndActivities: updateSpy,
      }),
      notifications,
    );

    await uc.execute({
      projectId: 'p-1',
      issueId: 'i-1',
      actorId: 'u-actor',
      changes: { assigneeId: 'u-A' },
    });

    expect(deleteSpy).toHaveBeenCalledWith('act-old');
    const payload = (updateSpy as jest.Mock).mock.calls[0][0] as {
      activities: Array<{ field: string }>;
    };
    expect(
      payload.activities.find((a) => a.field === 'assigneeId'),
    ).toBeUndefined();
    expect(notifications.scheduleAssignmentNotification).not.toHaveBeenCalled();
    expect(notifications.cancelPendingAssignment).toHaveBeenCalledWith(
      'i-1',
      'ASSIGNED',
    );
  });
});

describe('UpdateIssueUseCase — auto-assign children (I-U8 / I-U9)', () => {
  it('cascades to unassigned children when EPIC assignee changes', async () => {
    const bulkSpy = jest.fn(async () => undefined);
    const notifications = makeNotifications();
    const uc = new UpdateIssueUseCase(
      makeRepo({
        findForUpdate: jest.fn(async () => ({ ...EXISTING, type: 'EPIC' })),
        findUnassignedChildren: jest.fn(async () => [
          { id: 'c-1', number: 7, title: 'Child One' },
          { id: 'c-2', number: 8, title: 'Child Two' },
        ]),
        bulkAssignChildren: bulkSpy,
      }),
      notifications,
    );

    await uc.execute({
      projectId: 'p-1',
      issueId: 'i-1',
      actorId: 'u-actor',
      changes: { assigneeId: 'u-new' },
    });

    expect(bulkSpy).toHaveBeenCalledWith(['c-1', 'c-2'], 'u-new', 'u-actor');
    // 1 parent + 2 children = 3 schedules
    expect(notifications.scheduleAssignmentNotification).toHaveBeenCalledTimes(
      3,
    );
  });

  it('does NOT cascade when silent=true', async () => {
    const bulkSpy = jest.fn(async () => undefined);
    const uc = new UpdateIssueUseCase(
      makeRepo({
        findForUpdate: jest.fn(async () => ({ ...EXISTING, type: 'EPIC' })),
        bulkAssignChildren: bulkSpy,
      }),
      makeNotifications(),
    );

    await uc.execute({
      projectId: 'p-1',
      issueId: 'i-1',
      actorId: 'u-actor',
      silent: true,
      changes: { assigneeId: 'u-new' },
    });

    expect(bulkSpy).not.toHaveBeenCalled();
  });
});
