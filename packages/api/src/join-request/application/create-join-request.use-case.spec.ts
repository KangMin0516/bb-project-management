/* eslint-disable @typescript-eslint/no-unsafe-assignment,
                   @typescript-eslint/no-unsafe-member-access,
                   @typescript-eslint/no-unsafe-argument,
                   @typescript-eslint/no-unsafe-return */
import { describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type {
  MessagingPort,
  SendResult,
} from '../../common/ports/messaging.port.js';
import type { JoinRequestRepository } from './ports/join-request.repository.js';
import { JoinRequest } from '../domain/join-request.entity.js';
import { CreateJoinRequestUseCase } from './create-join-request.use-case.js';

const PROJECT = { id: 'p-1', name: 'Alpha', key: 'ALP' };
const REQUESTER = {
  id: 'u-1',
  name: 'Alice',
  email: 'alice@example.com',
  avatar: null,
};

function makeRepo(
  overrides: Partial<JoinRequestRepository> = {},
): JoinRequestRepository {
  return {
    resolveProjectId: jest.fn(async () => PROJECT.id),
    isMemberOfProject: jest.fn(async () => false),
    findActiveForRequester: jest.fn(async () => null),
    findById: jest.fn(),
    findInProject: jest.fn(),
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

function makeMessaging(): MessagingPort {
  return {
    getWorkspaceStatus: jest.fn(async () => ({ connected: false })),
    sendDirectMessage: jest.fn(
      async () => ({ delivered: true }) satisfies SendResult,
    ),
    sendChannelMessage: jest.fn(async () => undefined),
  };
}

function makeConfig(): ConfigService {
  return {
    get: jest.fn(() => 'https://pm.example.com'),
  } as unknown as ConfigService;
}

describe('CreateJoinRequestUseCase', () => {
  it('throws NotFound when project key does not resolve', async () => {
    const repo = makeRepo({ resolveProjectId: jest.fn(async () => null) });
    const uc = new CreateJoinRequestUseCase(
      repo,
      makeMessaging(),
      makeConfig(),
    );

    await expect(
      uc.execute({ projectIdOrKey: 'XXX', requesterId: 'u-1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws BadRequest when requester is already a member (J-2)', async () => {
    const repo = makeRepo({
      isMemberOfProject: jest.fn(async () => true),
    });
    const uc = new CreateJoinRequestUseCase(
      repo,
      makeMessaging(),
      makeConfig(),
    );

    await expect(
      uc.execute({ projectIdOrKey: 'p-1', requesterId: 'u-1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws BadRequest when a PENDING request already exists (J-1)', async () => {
    const existing = JoinRequest.create({
      id: 'jr-old',
      projectId: PROJECT.id,
      requesterId: REQUESTER.id,
    });
    const repo = makeRepo({
      findActiveForRequester: jest.fn(async () => existing),
    });
    const uc = new CreateJoinRequestUseCase(
      repo,
      makeMessaging(),
      makeConfig(),
    );

    await expect(
      uc.execute({ projectIdOrKey: 'p-1', requesterId: REQUESTER.id }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deletes a prior APPROVED/REJECTED request before creating new one (re-request)', async () => {
    const existing = JoinRequest.create({
      id: 'jr-old',
      projectId: PROJECT.id,
      requesterId: REQUESTER.id,
    });
    existing.reject('u-admin', 'no');

    const deleteSpy = jest.fn(async () => undefined);
    const saveSpy = jest.fn(async () => undefined);
    const repo = makeRepo({
      findActiveForRequester: jest.fn(async () => existing),
      delete: deleteSpy,
      save: saveSpy,
    });
    const uc = new CreateJoinRequestUseCase(
      repo,
      makeMessaging(),
      makeConfig(),
    );

    await uc.execute({ projectIdOrKey: 'p-1', requesterId: REQUESTER.id });

    expect(deleteSpy).toHaveBeenCalledWith('jr-old');
    expect(saveSpy).toHaveBeenCalledTimes(1);
  });

  it('returns the new request + project + requester on happy path', async () => {
    const uc = new CreateJoinRequestUseCase(
      makeRepo(),
      makeMessaging(),
      makeConfig(),
    );

    const result = await uc.execute({
      projectIdOrKey: 'p-1',
      requesterId: REQUESTER.id,
      message: 'Please',
    });

    expect(result.request.status).toBe('PENDING');
    expect(result.request.message).toBe('Please');
    expect(result.project).toEqual(PROJECT);
    expect(result.requester).toEqual(REQUESTER);
  });
});
