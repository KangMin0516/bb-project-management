import { describe, expect, it, jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import type {
  IssueRepository,
  IssueRowForUpdate,
} from './ports/issue.repository.js';
import { RemoveIssueUseCase } from './remove-issue.use-case.js';

const EXISTING: IssueRowForUpdate = {
  id: 'i-1',
  projectId: 'p-1',
  number: 1,
  title: 't',
  description: null,
  type: 'TASK',
  status: 'TODO',
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

describe('RemoveIssueUseCase', () => {
  it('throws NotFound when issue is missing', async () => {
    const uc = new RemoveIssueUseCase({
      findForUpdate: jest.fn(async () => null),
    } as unknown as IssueRepository);

    await expect(
      uc.execute({ projectId: 'p-1', issueId: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFound when issue belongs to another project', async () => {
    const uc = new RemoveIssueUseCase({
      findForUpdate: jest.fn(async () => ({ ...EXISTING, projectId: 'p-2' })),
      delete: jest.fn(),
    } as unknown as IssueRepository);

    await expect(
      uc.execute({ projectId: 'p-1', issueId: 'i-1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes the row on happy path', async () => {
    const deleteSpy = jest.fn(async () => undefined);
    const uc = new RemoveIssueUseCase({
      findForUpdate: jest.fn(async () => EXISTING),
      delete: deleteSpy,
    } as unknown as IssueRepository);

    const result = await uc.execute({ projectId: 'p-1', issueId: 'i-1' });

    expect(deleteSpy).toHaveBeenCalledWith('i-1');
    expect(result).toEqual({ deleted: true });
  });
});
