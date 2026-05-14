import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import {
  MESSAGING_PORT,
  type MessageBlock,
  type MessagingPort,
} from '../../common/ports/messaging.port.js';
import {
  JOIN_REQUEST_REPOSITORY,
  type JoinRequestRepository,
} from './ports/join-request.repository.js';
import { JoinRequest } from '../domain/join-request.entity.js';

export interface CreateJoinRequestCommand {
  projectIdOrKey: string;
  requesterId: string;
  message?: string;
}

export interface CreateJoinRequestResult {
  request: JoinRequest;
  requester: { id: string; name: string; email: string; avatar: string | null };
  project: { id: string; name: string; key: string };
}

/**
 * Create a new project join request. Mirrors the legacy
 * JoinRequestService.create flow:
 *  1. Resolve project key/id → uuid (J-* invariants)
 *  2. Reject if requester is already a member (J-2)
 *  3. Replace any APPROVED/REJECTED prior request (re-request flow)
 *  4. Reject if a PENDING request already exists (J-1)
 *  5. Persist the new request
 *  6. Best-effort Slack DM to project admins/PMs (J-3)
 */
@Injectable()
export class CreateJoinRequestUseCase {
  private readonly logger = new Logger(CreateJoinRequestUseCase.name);

  constructor(
    @Inject(JOIN_REQUEST_REPOSITORY)
    private readonly repo: JoinRequestRepository,
    @Inject(MESSAGING_PORT) private readonly messaging: MessagingPort,
    private readonly config: ConfigService,
  ) {}

  async execute(
    cmd: CreateJoinRequestCommand,
  ): Promise<CreateJoinRequestResult> {
    const projectId = await this.repo.resolveProjectId(cmd.projectIdOrKey);
    if (!projectId) throw new NotFoundException('Project not found');

    if (await this.repo.isMemberOfProject(cmd.requesterId, projectId)) {
      throw new BadRequestException('You are already a member of this project');
    }

    const existing = await this.repo.findActiveForRequester(
      cmd.requesterId,
      projectId,
    );
    if (existing) {
      if (existing.isPending) {
        throw new BadRequestException('A join request is already pending');
      }
      // Re-request after a prior APPROVED/REJECTED row — delete it so
      // the unique (requesterId, projectId) constraint allows the new
      // create.
      await this.repo.delete(existing.id);
    }

    const request = JoinRequest.create({
      id: randomUUID(),
      projectId,
      requesterId: cmd.requesterId,
      message: cmd.message,
    });
    await this.repo.save(request);

    const [project, requester] = await Promise.all([
      this.repo.loadProjectMeta(projectId),
      this.repo.loadRequesterMeta(cmd.requesterId),
    ]);
    if (!project || !requester) {
      // Shouldn't happen — we just verified above — but keep the type
      // narrow without `!` casts.
      throw new NotFoundException('Project or requester missing post-create');
    }

    // Fire-and-forget Slack fan-out. Failures stay logged at warn — the
    // join request row is authoritative.
    void this.notifyAdmins({ project, requester, request }).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to send Slack notification: ${msg}`);
    });

    return { request, requester, project };
  }

  private async notifyAdmins(input: {
    project: { id: string; name: string; key: string };
    requester: { name: string };
    request: JoinRequest;
  }) {
    const { connected } = await this.messaging.getWorkspaceStatus();
    if (!connected) return;

    const admins = await this.repo.listAdminsAndPms(input.project.id);
    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'https://pm.burningbros.kr';
    const settingsUrl = `${frontendUrl}/projects/${input.project.key}/settings?tab=requests`;

    const blocks: MessageBlock[] = [
      { type: 'header', text: '📋 Project join request' },
      {
        type: 'section',
        text: `*${input.requester.name}* has requested to join *${input.project.name}*.`,
      },
      ...(input.request.message
        ? ([
            { type: 'section', text: `> ${input.request.message}` },
          ] satisfies MessageBlock[])
        : []),
      {
        type: 'button_link',
        text: 'Approve / Reject',
        url: settingsUrl,
        style: 'primary',
      },
    ];
    const fallbackText = `${input.requester.name} has requested to join ${input.project.name}.`;

    for (const admin of admins) {
      if (!admin.slackUserId) continue;
      const result = await this.messaging.sendDirectMessage(
        admin.slackUserId,
        fallbackText,
        blocks,
      );
      if (!result.delivered) {
        this.logger.warn(
          `Failed to DM admin ${admin.slackUserId}: ${result.reason}`,
        );
      }
    }
  }
}
