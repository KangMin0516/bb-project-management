import { describe, expect, it, jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import type { IssueRepository } from './ports/issue.repository.js';
import { CreateIssueUseCase } from './create-issue.use-case.js';

function makeRepo(overrides: Partial<IssueRepository> = {}): IssueRepository {
  return {
    createWithSequenceAndActivity: jest.fn(async () => ({ id: 'i-new' })),
    fetchParentType: jest.fn(async () => null),
    resolveComponentDefaultAssignee: jest.fn(async () => null),
    ...overrides,
  } as unknown as IssueRepository;
}

describe('CreateIssueUseCase — hierarchy invariants (I-C1..I-C3)', () => {
  it('rejects EPIC under a TASK (parent must be DOMAIN)', async () => {
    const repo = makeRepo({ fetchParentType: jest.fn(async () => 'TASK') });
    const uc = new CreateIssueUseCase(repo);
    await expect(
      uc.execute({
        projectId: 'p',
        creatorId: 'u',
        title: 't',
        type: 'EPIC' as const,
        parentId: 'parent-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects DOMAIN with a parent', async () => {
    const repo = makeRepo({ fetchParentType: jest.fn(async () => 'DOMAIN') });
    const uc = new CreateIssueUseCase(repo);
    await expect(
      uc.execute({
        projectId: 'p',
        creatorId: 'u',
        title: 't',
        type: 'DOMAIN' as const,
        parentId: 'parent-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts EPIC under a DOMAIN', async () => {
    const repo = makeRepo({ fetchParentType: jest.fn(async () => 'DOMAIN') });
    const uc = new CreateIssueUseCase(repo);
    await expect(
      uc.execute({
        projectId: 'p',
        creatorId: 'u',
        title: 't',
        type: 'EPIC' as const,
        parentId: 'd-1',
      }),
    ).resolves.toBeDefined();
  });

  it('rejects SUB_TASK without a parent', async () => {
    const uc = new CreateIssueUseCase(makeRepo());
    await expect(
      uc.execute({
        projectId: 'p',
        creatorId: 'u',
        title: 't',
        type: 'SUB_TASK' as const,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when parent does not exist', async () => {
    const repo = makeRepo({ fetchParentType: jest.fn(async () => null) });
    const uc = new CreateIssueUseCase(repo);
    await expect(
      uc.execute({
        projectId: 'p',
        creatorId: 'u',
        title: 't',
        type: 'TASK' as const,
        parentId: 'nope',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when parent is a SUB_TASK', async () => {
    const repo = makeRepo({
      fetchParentType: jest.fn(async () => 'SUB_TASK'),
    });
    const uc = new CreateIssueUseCase(repo);
    await expect(
      uc.execute({
        projectId: 'p',
        creatorId: 'u',
        title: 't',
        type: 'TASK' as const,
        parentId: 'sub',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts TASK under EPIC', async () => {
    const repo = makeRepo({
      fetchParentType: jest.fn(async () => 'EPIC'),
    });
    const uc = new CreateIssueUseCase(repo);
    await expect(
      uc.execute({
        projectId: 'p',
        creatorId: 'u',
        title: 't',
        type: 'TASK' as const,
        parentId: 'epic-1',
      }),
    ).resolves.toBeDefined();
  });
});

describe('CreateIssueUseCase — defaults + auto-fill', () => {
  it('defaults type=TASK, status=BACKLOG, priority=MEDIUM when omitted', async () => {
    const createSpy = jest.fn(async () => ({ id: 'i-1' }));
    const uc = new CreateIssueUseCase(
      makeRepo({ createWithSequenceAndActivity: createSpy }),
    );

    await uc.execute({ projectId: 'p', creatorId: 'u', title: 't' });

    const payload = (createSpy as jest.Mock).mock.calls[0][0] as {
      type: string;
      status: string;
      priority: string;
    };
    expect(payload.type).toBe('TASK');
    expect(payload.status).toBe('BACKLOG');
    expect(payload.priority).toBe('MEDIUM');
  });

  it('auto-fills assignee from component default when assigneeId is omitted (I-C4)', async () => {
    const createSpy = jest.fn(async () => ({ id: 'i-1' }));
    const repo = makeRepo({
      createWithSequenceAndActivity: createSpy,
      resolveComponentDefaultAssignee: jest.fn(async () => 'u-default'),
    });
    const uc = new CreateIssueUseCase(repo);

    await uc.execute({
      projectId: 'p',
      creatorId: 'u',
      title: 't',
      componentIds: ['c-1', 'c-2'],
    });

    const payload = (createSpy as jest.Mock).mock.calls[0][0] as {
      assigneeId: string | null;
    };
    expect(payload.assigneeId).toBe('u-default');
  });

  it('does NOT auto-fill when assigneeId is provided explicitly (I-C5)', async () => {
    const createSpy = jest.fn(async () => ({ id: 'i-1' }));
    const componentLookup = jest.fn(async () => 'u-default');
    const repo = makeRepo({
      createWithSequenceAndActivity: createSpy,
      resolveComponentDefaultAssignee: componentLookup,
    });
    const uc = new CreateIssueUseCase(repo);

    await uc.execute({
      projectId: 'p',
      creatorId: 'u',
      title: 't',
      assigneeId: 'u-explicit',
      componentIds: ['c-1'],
    });

    expect(componentLookup).not.toHaveBeenCalled();
    const payload = (createSpy as jest.Mock).mock.calls[0][0] as {
      assigneeId: string | null;
    };
    expect(payload.assigneeId).toBe('u-explicit');
  });

  it('leaves assigneeId null when neither explicit nor any component has default', async () => {
    const createSpy = jest.fn(async () => ({ id: 'i-1' }));
    const uc = new CreateIssueUseCase(
      makeRepo({
        createWithSequenceAndActivity: createSpy,
        resolveComponentDefaultAssignee: jest.fn(async () => null),
      }),
    );

    await uc.execute({
      projectId: 'p',
      creatorId: 'u',
      title: 't',
      componentIds: ['c-1'],
    });

    const payload = (createSpy as jest.Mock).mock.calls[0][0] as {
      assigneeId: string | null;
    };
    expect(payload.assigneeId).toBeNull();
  });
});

describe('CreateIssueUseCase — default reviewer (PM-81)', () => {
  it('defaults reviewerAssigneeId to creatorId when omitted', async () => {
    const createSpy = jest.fn(async () => ({ id: 'i-1' }));
    const uc = new CreateIssueUseCase(
      makeRepo({ createWithSequenceAndActivity: createSpy }),
    );

    await uc.execute({ projectId: 'p', creatorId: 'u-creator', title: 't' });

    const payload = (createSpy as jest.Mock).mock.calls[0][0] as {
      reviewerAssigneeId: string | null;
    };
    expect(payload.reviewerAssigneeId).toBe('u-creator');
  });

  it('honours explicit null (opt-out) and leaves reviewerAssigneeId null', async () => {
    const createSpy = jest.fn(async () => ({ id: 'i-1' }));
    const uc = new CreateIssueUseCase(
      makeRepo({ createWithSequenceAndActivity: createSpy }),
    );

    await uc.execute({
      projectId: 'p',
      creatorId: 'u-creator',
      title: 't',
      reviewerAssigneeId: null,
    });

    const payload = (createSpy as jest.Mock).mock.calls[0][0] as {
      reviewerAssigneeId: string | null;
    };
    expect(payload.reviewerAssigneeId).toBeNull();
  });

  it('respects an explicit non-creator reviewer', async () => {
    const createSpy = jest.fn(async () => ({ id: 'i-1' }));
    const uc = new CreateIssueUseCase(
      makeRepo({ createWithSequenceAndActivity: createSpy }),
    );

    await uc.execute({
      projectId: 'p',
      creatorId: 'u-creator',
      title: 't',
      reviewerAssigneeId: 'u-teammate',
    });

    const payload = (createSpy as jest.Mock).mock.calls[0][0] as {
      reviewerAssigneeId: string | null;
    };
    expect(payload.reviewerAssigneeId).toBe('u-teammate');
  });
});
