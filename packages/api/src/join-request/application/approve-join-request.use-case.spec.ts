import { describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { NotificationService } from '../../notification/notification.service.js';
import type { JoinRequestRepository } from './ports/join-request.repository.js';
import { JoinRequest } from '../domain/join-request.entity.js';
import { ApproveJoinRequestUseCase } from './approve-join-request.use-case.js';

const PROJECT = { id: 'p-1', name: 'Alpha', key: 'ALP' };
const REQUESTER = {
  id: 'u-req',
  name: 'Alice',
  email: 'alice@example.com',
  avatar: null,
};

function makeRequest(): JoinRequest {
  return JoinRequest.create({
    id: 'jr-1',
    projectId: PROJECT.id,
    requesterId: REQUESTER.id,
  });
}

function makeRepo(
  overrides: Partial<JoinRequestRepository> = {},
): JoinRequestRepository {
  return {
    findInProject: jest.fn(async () => makeRequest()),
    findById: jest.fn(async () => makeRequest()),
    findActiveForRequester: jest.fn(async () => null),
    resolveProjectId: jest.fn(async () => PROJECT.id),
    isMemberOfProject: jest.fn(async () => false),
    save: jest.fn(async () => undefined),
    delete: jest.fn(async () => undefined),
    loadProjectMeta: jest.fn(async () => PROJECT),
    loadRequesterMeta: jest.fn(async () => REQUESTER),
    listPendingForProject: jest.fn(async () => []),
    listForRequester: jest.fn(async () => []),
    listAdminsAndPms: jest.fn(async () => []),
    approveAndAddMember: jest.fn(async () => undefined),
    ...overrides,
  } as unknown as JoinRequestRepository;
}

function makeNotifications(): NotificationService {
  return {
    create: jest.fn(async () => null),
  } as unknown as NotificationService;
}

describe('ApproveJoinRequestUseCase', () => {
  it('throws NotFound when request id does not exist anywhere', async () => {
    const repo = makeRepo({
      findInProject: jest.fn(async () => null),
      findById: jest.fn(async () => null),
    });
    const uc = new ApproveJoinRequestUseCase(repo, makeNotifications());

    await expect(
      uc.execute({
        projectId: 'p-1',
        requestId: 'missing',
        resolvedById: 'u-x',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws BadRequest when request belongs to a different project', async () => {
    const otherProject = JoinRequest.create({
      id: 'jr-2',
      projectId: 'p-OTHER',
      requesterId: 'u-req',
    });
    const repo = makeRepo({
      findInProject: jest.fn(async () => null),
      findById: jest.fn(async () => otherProject),
    });
    const uc = new ApproveJoinRequestUseCase(repo, makeNotifications());

    await expect(
      uc.execute({ projectId: 'p-1', requestId: 'jr-2', resolvedById: 'u-x' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws BadRequest when request was already resolved', async () => {
    const alreadyApproved = makeRequest();
    alreadyApproved.approve('u-prev');
    const repo = makeRepo({
      findInProject: jest.fn(async () => alreadyApproved),
    });
    const uc = new ApproveJoinRequestUseCase(repo, makeNotifications());

    await expect(
      uc.execute({ projectId: 'p-1', requestId: 'jr-1', resolvedById: 'u-x' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('calls approveAndAddMember + creates JOIN_APPROVED notification (J-4 + J-5)', async () => {
    const approveSpy = jest.fn(async () => undefined);
    const repo = makeRepo({ approveAndAddMember: approveSpy });
    const notifications = makeNotifications();
    const uc = new ApproveJoinRequestUseCase(repo, notifications);

    const result = await uc.execute({
      projectId: 'p-1',
      requestId: 'jr-1',
      resolvedById: 'u-admin',
    });

    expect(approveSpy).toHaveBeenCalledTimes(1);
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'JOIN_APPROVED',
        userId: REQUESTER.id,
        actorId: 'u-admin',
      }),
    );
    expect(result.request.status).toBe('APPROVED');
    expect(result.request.resolvedById).toBe('u-admin');
  });
});
