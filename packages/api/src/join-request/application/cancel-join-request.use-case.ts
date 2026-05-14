import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  JOIN_REQUEST_REPOSITORY,
  type JoinRequestRepository,
} from './ports/join-request.repository.js';
import { JoinRequestDomainError } from '../domain/join-request.entity.js';

export interface CancelJoinRequestCommand {
  requestId: string;
  userId: string;
}

/**
 * Cancel a pending join request. Permission + state checks are
 * domain-level (`ensureCancellableBy`); persistence is a hard delete
 * (matches legacy behavior — re-request flow expects no PENDING row).
 *
 * Legacy returned NotFound when "not found OR not yours" was true;
 * preserved here by treating wrong-requester as 404 too.
 */
@Injectable()
export class CancelJoinRequestUseCase {
  constructor(
    @Inject(JOIN_REQUEST_REPOSITORY)
    private readonly repo: JoinRequestRepository,
  ) {}

  async execute(cmd: CancelJoinRequestCommand): Promise<{ deleted: true }> {
    const request = await this.repo.findById(cmd.requestId);
    if (!request) throw new NotFoundException('Join request not found');

    try {
      request.ensureCancellableBy(cmd.userId);
    } catch (err) {
      if (err instanceof JoinRequestDomainError) {
        // Hide "exists but not yours" as a 404 (legacy parity).
        if (err.code === 'NOT_REQUESTER') {
          throw new NotFoundException('Join request not found');
        }
        throw new BadRequestException(err.message);
      }
      throw err;
    }

    await this.repo.delete(cmd.requestId);
    return { deleted: true };
  }
}
