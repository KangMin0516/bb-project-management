import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationService } from '../../notification/notification.service.js';
import {
  JOIN_REQUEST_REPOSITORY,
  type JoinRequestRepository,
} from './ports/join-request.repository.js';
import {
  JoinRequest,
  JoinRequestDomainError,
} from '../domain/join-request.entity.js';

export interface RejectJoinRequestCommand {
  projectId: string;
  requestId: string;
  resolvedById: string;
  reason?: string | null;
}

export interface RejectJoinRequestResult {
  request: JoinRequest;
  requester: { id: string; name: string; email: string; avatar: string | null };
  project: { id: string; name: string; key: string };
}

/**
 * Reject a pending join request. No membership upsert (vs approve), so
 * a single update instead of a $transaction. In-app notification to
 * the requester carries the reason for context.
 */
@Injectable()
export class RejectJoinRequestUseCase {
  constructor(
    @Inject(JOIN_REQUEST_REPOSITORY)
    private readonly repo: JoinRequestRepository,
    private readonly notifications: NotificationService,
  ) {}

  async execute(
    cmd: RejectJoinRequestCommand,
  ): Promise<RejectJoinRequestResult> {
    const request = await this.repo.findInProject(cmd.requestId, cmd.projectId);
    if (!request) {
      const anywhere = await this.repo.findById(cmd.requestId);
      if (!anywhere) throw new NotFoundException('Join request not found');
      throw new BadRequestException(
        'Join request does not belong to this project',
      );
    }

    try {
      request.reject(cmd.resolvedById, cmd.reason ?? null);
    } catch (err) {
      if (err instanceof JoinRequestDomainError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }

    await this.repo.save(request);

    const [project, requester] = await Promise.all([
      this.repo.loadProjectMeta(request.projectId),
      this.repo.loadRequesterMeta(request.requesterId),
    ]);
    if (!project || !requester) {
      throw new NotFoundException('Project or requester missing post-reject');
    }

    await this.notifications.create({
      type: 'JOIN_REJECTED',
      message: `Your request to join "${project.name}" was rejected`,
      userId: request.requesterId,
      projectId: project.id,
      actorId: cmd.resolvedById,
    });

    return { request, requester, project };
  }
}
