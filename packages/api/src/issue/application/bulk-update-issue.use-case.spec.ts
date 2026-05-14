import { describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { NotificationService } from '../../notification/notification.service.js';
import type {
  BulkIssueRow,
  IssueRepository,
} from './ports/issue.repository.js';
import { BulkUpdateIssueUseCase } from './bulk-update-issue.use-case.js';

const ROW_A: BulkIssueRow = {
  id: 'a',
  status: 'TODO',
  priority: 'LOW',
  assigneeId: null,
  number: 1,
  title: 'A',
};
const ROW_B: BulkIssueRow = {
  id: 'b',
  status: 'IN_PROGRESS',
  priority: 'MEDIUM',
  assigneeId: 'u-other',
  number: 2,
  title: 'B',
};

function makeRepo(overrides: Partial<IssueRepository> = {}): IssueRepository {
  return {
    findMinimalForBulk: jest.fn(async () => [ROW_A, ROW_B]),
    fetchProjectKey: jest.fn(async () => 'ALP'),
    fetchUserName: jest.fn(async () => 'Alice'),
    bulkUpdateInTransaction: jest.fn(
      async (rows, _changes, _actorId, onUpdated) => {
        for (const row of rows) onUpdated(row);
      },
    ),
    ...overrides,
  } as unknown as IssueRepository;
}

function makeNotifications(): NotificationService {
  return {
    scheduleAssignmentNotification: jest.fn(),
  } as unknown as NotificationService;
}

describe('BulkUpdateIssueUseCase', () => {
  it('throws NotFound when zero rows match', async () => {
    const repo = makeRepo({ findMinimalForBulk: jest.fn(async () => []) });
    const uc = new BulkUpdateIssueUseCase(repo, makeNotifications());

    await expect(
      uc.execute({
        projectId: 'p-1',
        actorId: 'u',
        issueIds: ['x'],
        changes: {},
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws BadRequest when some ids are cross-project', async () => {
    const repo = makeRepo({
      findMinimalForBulk: jest.fn(async () => [ROW_A]),
    });
    const uc = new BulkUpdateIssueUseCase(repo, makeNotifications());

    await expect(
      uc.execute({
        projectId: 'p-1',
        actorId: 'u',
        issueIds: ['a', 'b'],
        changes: {},
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('schedules an assignee DM per row whose assigneeId actually changed', async () => {
    const notifications = makeNotifications();
    const uc = new BulkUpdateIssueUseCase(makeRepo(), notifications);

    await uc.execute({
      projectId: 'p-1',
      actorId: 'u',
      issueIds: ['a', 'b'],
      changes: { assigneeId: 'u-new' },
    });

    // ROW_A.assigneeId was null → changes, ROW_B.assigneeId was 'u-other' →
    // changes too. Both should fire.
    expect(notifications.scheduleAssignmentNotification).toHaveBeenCalledTimes(
      2,
    );
  });

  it('does not schedule when assigneeId matches existing value', async () => {
    const notifications = makeNotifications();
    const uc = new BulkUpdateIssueUseCase(
      makeRepo({
        findMinimalForBulk: jest.fn(async () => [
          { ...ROW_A, assigneeId: 'u-new' },
        ]),
      }),
      notifications,
    );

    await uc.execute({
      projectId: 'p-1',
      actorId: 'u',
      issueIds: ['a'],
      changes: { assigneeId: 'u-new' },
    });

    expect(notifications.scheduleAssignmentNotification).not.toHaveBeenCalled();
  });

  it('returns the updated count', async () => {
    const uc = new BulkUpdateIssueUseCase(makeRepo(), makeNotifications());
    const out = await uc.execute({
      projectId: 'p-1',
      actorId: 'u',
      issueIds: ['a', 'b'],
      changes: { status: 'DONE' },
    });
    expect(out).toEqual({ updated: 2 });
  });
});
