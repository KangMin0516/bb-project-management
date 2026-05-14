import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  MESSAGING_PORT,
  type MessageBlock,
  type MessagingPort,
} from '../common/ports/messaging.port.js';
import { NotificationService } from '../notification/notification.service.js';
import { USER_SELECT } from '../common/constants.js';
import type { CreateJoinRequestDto } from './dto/create-join-request.dto.js';
import type { RejectJoinRequestDto } from './dto/reject-join-request.dto.js';

@Injectable()
export class JoinRequestService {
  private readonly logger = new Logger(JoinRequestService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(MESSAGING_PORT) private messaging: MessagingPort,
    private notificationService: NotificationService,
  ) {}

  async create(
    projectId: string,
    requesterId: string,
    dto: CreateJoinRequestDto,
  ) {
    // Resolve project key to UUID if needed
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        projectId,
      );
    if (!isUuid) {
      const project = await this.prisma.project.findUnique({
        where: { key: projectId },
        select: { id: true },
      });
      if (!project) {
        throw new NotFoundException('Project not found');
      }
      projectId = project.id;
    }

    // Check if already a member
    const existingMember = await this.prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: requesterId, projectId } },
    });
    if (existingMember) {
      throw new BadRequestException('You are already a member of this project');
    }

    // Check for existing PENDING request
    const existingRequest = await this.prisma.projectJoinRequest.findUnique({
      where: { requesterId_projectId: { requesterId, projectId } },
    });

    if (existingRequest) {
      if (existingRequest.status === 'PENDING') {
        throw new BadRequestException('A join request is already pending');
      }
      // If REJECTED or APPROVED, delete old record and allow re-request
      await this.prisma.projectJoinRequest.delete({
        where: { id: existingRequest.id },
      });
    }

    const joinRequest = await this.prisma.projectJoinRequest.create({
      data: {
        projectId,
        requesterId,
        message: dto.message,
      },
      include: {
        requester: { select: USER_SELECT },
        project: { select: { id: true, name: true, key: true } },
      },
    });

    // Send Slack DM to ADMIN + PM (fire-and-forget)
    this.sendSlackNotification(joinRequest).catch((err) => {
      this.logger.warn(`Failed to send Slack notification: ${err.message}`);
    });

    return joinRequest;
  }

  async findByProject(projectId: string) {
    return this.prisma.projectJoinRequest.findMany({
      where: { projectId, status: 'PENDING' },
      include: {
        requester: { select: USER_SELECT },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findByUser(userId: string) {
    return this.prisma.projectJoinRequest.findMany({
      where: { requesterId: userId },
      include: {
        project: { select: { id: true, name: true, key: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async findPendingRequest(projectId: string, requestId: string) {
    const request = await this.prisma.projectJoinRequest.findUnique({
      where: { id: requestId },
      include: {
        project: { select: { id: true, name: true, key: true } },
      },
    });
    if (!request) throw new NotFoundException('Join request not found');
    if (request.projectId !== projectId)
      throw new BadRequestException(
        'Join request does not belong to this project',
      );
    if (request.status !== 'PENDING')
      throw new BadRequestException(
        'This join request has already been resolved',
      );
    return request;
  }

  async approve(projectId: string, requestId: string, resolvedById: string) {
    const request = await this.findPendingRequest(projectId, requestId);

    // Transaction: update request + upsert member (prevents race condition)
    const [updatedRequest] = await this.prisma.$transaction([
      this.prisma.projectJoinRequest.update({
        where: { id: requestId, status: 'PENDING' },
        data: {
          status: 'APPROVED',
          resolvedById,
          resolvedAt: new Date(),
        },
        include: {
          requester: { select: USER_SELECT },
          project: { select: { id: true, name: true, key: true } },
        },
      }),
      this.prisma.projectMember.upsert({
        where: {
          userId_projectId: {
            userId: request.requesterId,
            projectId: request.projectId,
          },
        },
        create: {
          projectId: request.projectId,
          userId: request.requesterId,
          role: 'DEVELOPER',
        },
        update: {},
      }),
    ]);

    // In-app notification to requester
    await this.notificationService.create({
      type: 'JOIN_APPROVED',
      message: `Your request to join "${request.project.name}" has been approved`,
      userId: request.requesterId,
      projectId: request.projectId,
      actorId: resolvedById,
    });

    return updatedRequest;
  }

  async reject(
    projectId: string,
    requestId: string,
    resolvedById: string,
    dto: RejectJoinRequestDto,
  ) {
    const request = await this.findPendingRequest(projectId, requestId);

    const updatedRequest = await this.prisma.projectJoinRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        rejectionReason: dto.reason,
        resolvedById,
        resolvedAt: new Date(),
      },
      include: {
        requester: { select: USER_SELECT },
        project: { select: { id: true, name: true, key: true } },
      },
    });

    // In-app notification to requester
    await this.notificationService.create({
      type: 'JOIN_REJECTED',
      message: `Your request to join "${request.project.name}" was rejected`,
      userId: request.requesterId,
      projectId: request.projectId,
      actorId: resolvedById,
    });

    return updatedRequest;
  }

  async cancel(requestId: string, userId: string) {
    const request = await this.prisma.projectJoinRequest.findUnique({
      where: { id: requestId },
    });

    if (!request || request.requesterId !== userId) {
      throw new NotFoundException('Join request not found');
    }
    if (request.status !== 'PENDING') {
      throw new BadRequestException('Only pending requests can be canceled');
    }

    await this.prisma.projectJoinRequest.delete({ where: { id: requestId } });
    return { deleted: true };
  }

  // ─── Slack Notification ─────────────────────────────

  private async sendSlackNotification(joinRequest: {
    requester: { name: string };
    project: { id: string; name: string; key: string };
    message: string | null;
  }) {
    const status = await this.messaging.getWorkspaceStatus();
    if (!status.connected) return;

    const adminsAndPms = await this.prisma.projectMember.findMany({
      where: {
        projectId: joinRequest.project.id,
        role: { in: ['ADMIN', 'PM'] },
      },
      include: {
        user: { select: { slackUserId: true } },
      },
    });

    // P9 — FRONTEND_URL bypass intentionally preserved until M3 ConfigService cleanup.
    const frontendUrl = process.env.FRONTEND_URL ?? 'https://pm.burningbros.kr';
    const settingsUrl = `${frontendUrl}/projects/${joinRequest.project.key}/settings?tab=requests`;

    const blocks: MessageBlock[] = [
      { type: 'header', text: '📋 Project join request' },
      {
        type: 'section',
        text: `*${joinRequest.requester.name}* has requested to join *${joinRequest.project.name}*.`,
      },
      ...(joinRequest.message
        ? ([
            { type: 'section', text: `> ${joinRequest.message}` },
          ] satisfies MessageBlock[])
        : []),
      {
        type: 'button_link',
        text: 'Approve / Reject',
        url: settingsUrl,
        style: 'primary',
      },
    ];
    const fallbackText = `${joinRequest.requester.name} has requested to join ${joinRequest.project.name}.`;

    for (const member of adminsAndPms) {
      if (!member.user.slackUserId) continue;
      const result = await this.messaging.sendDirectMessage(
        member.user.slackUserId,
        fallbackText,
        blocks,
      );
      if (!result.delivered) {
        this.logger.warn(
          `Failed to DM admin ${member.user.slackUserId}: ${result.reason}`,
        );
      }
    }
  }
}
