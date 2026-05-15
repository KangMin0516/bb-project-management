import { describe, expect, it, jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import type { JoinRequestRepository } from './ports/join-request.repository.js';
import { JoinRequest } from '../domain/join-request.entity.js';
import { CancelJoinRequestUseCase } from './cancel-join-request.use-case.js';

const REQUESTER_ID = 'u-req';

function makeRepo(
  request: JoinRequest | null,
  deleteSpy?: jest.Mock,
): JoinRequestRepository {
  return {
    findById: jest.fn(async () => request),
    delete: deleteSpy ?? jest.fn(async () => undefined),
  } as unknown as JoinRequestRepository;
}

describe('CancelJoinRequestUseCase', () => {
  it('throws NotFound when request id does not exist', async () => {
    const uc = new CancelJoinRequestUseCase(makeRepo(null));
    await expect(
      uc.execute({ requestId: 'missing', userId: REQUESTER_ID }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFound (legacy parity) when caller is not the requester (J-7)', async () => {
    const request = JoinRequest.create({
      id: 'jr-1',
      projectId: 'p-1',
      requesterId: REQUESTER_ID,
    });
    const uc = new CancelJoinRequestUseCase(makeRepo(request));

    await expect(
      uc.execute({ requestId: 'jr-1', userId: 'u-imposter' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws when status is APPROVED (only PENDING can be canceled)', async () => {
    const request = JoinRequest.create({
      id: 'jr-1',
      projectId: 'p-1',
      requesterId: REQUESTER_ID,
    });
    request.approve('u-admin');
    const uc = new CancelJoinRequestUseCase(makeRepo(request));

    await expect(
      uc.execute({ requestId: 'jr-1', userId: REQUESTER_ID }),
    ).rejects.toThrow();
  });

  it('deletes the row on happy path', async () => {
    const request = JoinRequest.create({
      id: 'jr-1',
      projectId: 'p-1',
      requesterId: REQUESTER_ID,
    });
    const deleteSpy = jest.fn(async () => undefined);
    const uc = new CancelJoinRequestUseCase(makeRepo(request, deleteSpy));

    const result = await uc.execute({
      requestId: 'jr-1',
      userId: REQUESTER_ID,
    });

    expect(result).toEqual({ deleted: true });
    expect(deleteSpy).toHaveBeenCalledWith('jr-1');
  });
});
