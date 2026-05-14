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

export interface ApproveJoinRequestCommand {
  projectId: string;
  requestId: string;
  resolvedById: string;
}

export interface ApproveJoinRequestResult {
  request: JoinRequest;
  requester: { id: string; name: string; email: string; avatar: string | null };
  project: { id: string; name: string; key: string };
}

/**
 * Approve a pending join request:
 *  - Validate request exists in project (J-* invariants)
 *  - Entity-level state guard (PENDING required)
 *  - Atomic transaction: status → APPROVED + member upsert (J-4)
 *  - In-app notification to requester (J-5)
 *
 * Authorisation (J-8: ADMIN/PM only) is enforced upstream by
 * RolesGuard at the controller; we don't re-check here to avoid
 * duplicating the membership query.
 */
@Injectable()
export class ApproveJoinRequestUseCase {
  constructor(
    @Inject(JOIN_REQUEST_REPOSITORY)
    private readonly repo: JoinRequestRepository,
    private readonly notifications: NotificationService,
  ) {}

  async execute(
    cmd: ApproveJoinRequestCommand,
  ): Promise<ApproveJoinRequestResult> {
    const request = await this.repo.findInProject(cmd.requestId, cmd.projectId);
    if (!request) {
      // Match legacy error shape: 404 when not found, 400 when in another project.
      const anywhere = await this.repo.findById(cmd.requestId);
      if (!anywhere) throw new NotFoundException('Join request not found');
      throw new BadRequestException(
        'Join request does not belong to this project',
      );
    }

    try {
      request.approve(cmd.resolvedById);
    } catch (err) {
      if (err instanceof JoinRequestDomainError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }

    await this.repo.approveAndAddMember(request);

    const [project, requester] = await Promise.all([
      this.repo.loadProjectMeta(request.projectId),
      this.repo.loadRequesterMeta(request.requesterId),
    ]);
    if (!project || !requester) {
      throw new NotFoundException('Project or requester missing post-approve');
    }

    await this.notifications.create({
      type: 'JOIN_APPROVED',
      message: `Your request to join "${project.name}" has been approved`,
      userId: request.requesterId,
      projectId: project.id,
      actorId: cmd.resolvedById,
    });

    return { request, requester, project };
  }
}
