import { describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type {
  BulkParentTargetRow,
  IssueRepository,
} from './ports/issue.repository.js';
import { BulkSetParentUseCase } from './bulk-set-parent.use-case.js';

function makeRepo(overrides: Partial<IssueRepository> = {}): IssueRepository {
  return {
    findIssueProjectAndType: jest.fn(async () => null),
    findMinimalForParentBulk: jest.fn(async () => []),
    bulkSetParent: jest.fn(async () => undefined),
    ...overrides,
  } as unknown as IssueRepository;
}

const EPIC_ROW = (
  id: string,
  parentId: string | null = null,
): BulkParentTargetRow => ({
  id,
  type: 'EPIC',
  parentId,
  number: 1,
  title: 'Epic ' + id,
});

describe('BulkSetParentUseCase', () => {
  it('rejects empty issueIds', async () => {
    const uc = new BulkSetParentUseCase(makeRepo());
    await expect(
      uc.execute({
        projectId: 'p-1',
        actorId: 'u',
        issueIds: [],
        parentId: 'd-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when parent not found', async () => {
    const uc = new BulkSetParentUseCase(
      makeRepo({ findIssueProjectAndType: jest.fn(async () => null) }),
    );
    await expect(
      uc.execute({
        projectId: 'p-1',
        actorId: 'u',
        issueIds: ['e-1'],
        parentId: 'd-missing',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects when parent is from a different project', async () => {
    const uc = new BulkSetParentUseCase(
      makeRepo({
        findIssueProjectAndType: jest.fn(async () => ({
          projectId: 'p-OTHER',
          type: 'DOMAIN',
        })),
      }),
    );
    await expect(
      uc.execute({
        projectId: 'p-1',
        actorId: 'u',
        issueIds: ['e-1'],
        parentId: 'd-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when parent type is not DOMAIN', async () => {
    const uc = new BulkSetParentUseCase(
      makeRepo({
        findIssueProjectAndType: jest.fn(async () => ({
          projectId: 'p-1',
          type: 'TASK',
        })),
      }),
    );
    await expect(
      uc.execute({
        projectId: 'p-1',
        actorId: 'u',
        issueIds: ['e-1'],
        parentId: 't-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when some issueIds are missing from the project', async () => {
    const uc = new BulkSetParentUseCase(
      makeRepo({
        findIssueProjectAndType: jest.fn(async () => ({
          projectId: 'p-1',
          type: 'DOMAIN',
        })),
        findMinimalForParentBulk: jest.fn(async () => [EPIC_ROW('e-1')]),
      }),
    );
    await expect(
      uc.execute({
        projectId: 'p-1',
        actorId: 'u',
        issueIds: ['e-1', 'e-missing'],
        parentId: 'd-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when input contains non-Epic issues', async () => {
    const uc = new BulkSetParentUseCase(
      makeRepo({
        findIssueProjectAndType: jest.fn(async () => ({
          projectId: 'p-1',
          type: 'DOMAIN',
        })),
        findMinimalForParentBulk: jest.fn(async () => [
          EPIC_ROW('e-1'),
          { id: 't-1', type: 'TASK', parentId: null, number: 2, title: 'T' },
        ]),
      }),
    );
    await expect(
      uc.execute({
        projectId: 'p-1',
        actorId: 'u',
        issueIds: ['e-1', 't-1'],
        parentId: 'd-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('writes and returns updated count when all Epics valid', async () => {
    const bulkSetParent = jest.fn(async () => undefined);
    const uc = new BulkSetParentUseCase(
      makeRepo({
        findIssueProjectAndType: jest.fn(async () => ({
          projectId: 'p-1',
          type: 'DOMAIN',
        })),
        findMinimalForParentBulk: jest.fn(async () => [
          EPIC_ROW('e-1'),
          EPIC_ROW('e-2'),
        ]),
        bulkSetParent,
      }),
    );
    const result = await uc.execute({
      projectId: 'p-1',
      actorId: 'u',
      issueIds: ['e-1', 'e-2'],
      parentId: 'd-1',
    });
    expect(result).toEqual({ updated: 2 });
    expect(bulkSetParent).toHaveBeenCalled();
  });

  it('accepts null parentId (unparent)', async () => {
    const bulkSetParent = jest.fn(async () => undefined);
    const findParent = jest.fn(async () => null);
    const uc = new BulkSetParentUseCase(
      makeRepo({
        findIssueProjectAndType: findParent,
        findMinimalForParentBulk: jest.fn(async () => [
          EPIC_ROW('e-1', 'd-old'),
        ]),
        bulkSetParent,
      }),
    );
    await uc.execute({
      projectId: 'p-1',
      actorId: 'u',
      issueIds: ['e-1'],
      parentId: null,
    });
    expect(findParent).not.toHaveBeenCalled();
    expect(bulkSetParent).toHaveBeenCalled();
  });
});
