import { describe, expect, it, jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import type {
  IssueRepository,
  IssueRowForUpdate,
  ReorderIssuePayload,
} from './ports/issue.repository.js';
import { ReorderIssueUseCase } from './reorder-issue.use-case.js';

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

function makeRepo(
  existing: IssueRowForUpdate | null,
  reorderSpy = jest.fn(async () => ({ id: 'i-1' })),
): IssueRepository {
  return {
    findForUpdate: jest.fn(async () => existing),
    reorderInTransaction: reorderSpy,
  } as unknown as IssueRepository;
}

describe('ReorderIssueUseCase', () => {
  it('throws NotFound when issue missing or wrong project', async () => {
    const uc = new ReorderIssueUseCase(makeRepo(null));
    await expect(
      uc.execute({
        projectId: 'p-1',
        issueId: 'x',
        targetStatus: 'DONE',
        targetOrder: 1000,
        actorId: 'u',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('emits a status activity when status changes', async () => {
    const spy = jest.fn(async () => ({ id: 'i-1' }));
    const uc = new ReorderIssueUseCase(makeRepo(EXISTING, spy));

    await uc.execute({
      projectId: 'p-1',
      issueId: 'i-1',
      targetStatus: 'DONE',
      targetOrder: 5000,
      actorId: 'u',
    });

    const payload = (spy as jest.Mock).mock.calls[0][0] as ReorderIssuePayload;
    expect(payload.activities).toEqual([
      { field: 'status', oldValue: 'TODO', newValue: 'DONE' },
    ]);
  });

  it('no status activity when status unchanged', async () => {
    const spy = jest.fn(async () => ({ id: 'i-1' }));
    const uc = new ReorderIssueUseCase(makeRepo(EXISTING, spy));

    await uc.execute({
      projectId: 'p-1',
      issueId: 'i-1',
      targetStatus: 'TODO',
      targetOrder: 2000,
      actorId: 'u',
    });

    const payload = (spy as jest.Mock).mock.calls[0][0] as ReorderIssuePayload;
    expect(payload.activities).toEqual([]);
  });

  it('rounds non-integer orders before writing to the Int column', async () => {
    const spy = jest.fn(async () => ({ id: 'i-1' }));
    const uc = new ReorderIssueUseCase(makeRepo(EXISTING, spy));

    await uc.execute({
      projectId: 'p-1',
      issueId: 'i-1',
      targetStatus: 'TODO',
      targetOrder: 1000.5,
      actorId: 'u',
    });

    const payload = (spy as jest.Mock).mock.calls[0][0] as ReorderIssuePayload;
    expect(payload.targetOrder).toBe(1001);
  });

  it('resets archive when dragging out of DONE/CANCELED to active column', async () => {
    const spy = jest.fn(async () => ({ id: 'i-1' }));
    const uc = new ReorderIssueUseCase(
      makeRepo(
        { ...EXISTING, status: 'DONE', archivedAt: new Date('2025-01-01') },
        spy,
      ),
    );

    await uc.execute({
      projectId: 'p-1',
      issueId: 'i-1',
      targetStatus: 'IN_PROGRESS',
      targetOrder: 1000,
      actorId: 'u',
    });

    const payload = (spy as jest.Mock).mock.calls[0][0] as ReorderIssuePayload;
    expect(payload.resetArchive).toBe(true);
  });

  it('sets isRecheck=true when dragging back to IN_PROGRESS from a later stage', async () => {
    const spy = jest.fn(async () => ({ id: 'i-1' }));
    const uc = new ReorderIssueUseCase(
      makeRepo({ ...EXISTING, status: 'REVIEW_QA' }, spy),
    );

    await uc.execute({
      projectId: 'p-1',
      issueId: 'i-1',
      targetStatus: 'IN_PROGRESS',
      targetOrder: 1000,
      actorId: 'u',
    });

    const payload = (spy as jest.Mock).mock.calls[0][0] as ReorderIssuePayload;
    expect(payload.recheckUpdate).toBe(true);
  });
});
