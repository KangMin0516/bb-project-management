import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SlackService } from '../slack/slack.service.js';
import { NotificationService } from '../notification/notification.service.js';
import { USER_SELECT } from '../common/constants.js';
import type { CreateJoinRequestDto } from './dto/create-join-request.dto.js';
import type { RejectJoinRequestDto } from './dto/reject-join-request.dto.js';

@Injectable()
export class JoinRequestService {
  private readonly logger = new Logger(JoinRequestService.name);

  constructor(
    private prisma: PrismaService,
    private slackService: SlackService,
    private notificationService: NotificationService,
  ) {}

  async create(projectId: string, requesterId: string, dto: CreateJoinRequestDto) {
    // Resolve project key to UUID if needed
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
    if (!isUuid) {
      const project = await this.prisma.project.findUnique({
        where: { key: projectId },
        select: { id: true },
      });
      if (!project) {
        throw new NotFoundException('프로젝트를 찾을 수 없습니다');
      }
      projectId = project.id;
    }

    // Check if already a member
    const existingMember = await this.prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: requesterId, projectId } },
    });
    if (existingMember) {
      throw new BadRequestException('이미 프로젝트 멤버입니다');
    }

    // Check for existing PENDING request
    const existingRequest = await this.prisma.projectJoinRequest.findUnique({
      where: { requesterId_projectId: { requesterId, projectId } },
    });

    if (existingRequest) {
      if (existingRequest.status === 'PENDING') {
        throw new BadRequestException('이미 요청이 진행 중입니다');
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
    if (!request) throw new NotFoundException('요청을 찾을 수 없습니다');
    if (request.projectId !== projectId) throw new BadRequestException('프로젝트가 일치하지 않습니다');
    if (request.status !== 'PENDING') throw new BadRequestException('이미 처리된 요청입니다');
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
        where: { userId_projectId: { userId: request.requesterId, projectId: request.projectId } },
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
      message: `${request.project.name} 프로젝트 참여 요청이 승인되었습니다`,
      userId: request.requesterId,
      projectId: request.projectId,
      actorId: resolvedById,
    });

    return updatedRequest;
  }

  async reject(projectId: string, requestId: string, resolvedById: string, dto: RejectJoinRequestDto) {
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
      message: `${request.project.name} 프로젝트 참여 요청이 거절되었습니다`,
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
      throw new NotFoundException('요청을 찾을 수 없습니다');
    }
    if (request.status !== 'PENDING') {
      throw new BadRequestException('대기 중인 요청만 취소할 수 있습니다');
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
    const slackStatus = await this.slackService.getStatus();
    if (!slackStatus.connected || !slackStatus.integrationId) {
      return;
    }

    const adminsAndPms = await this.prisma.projectMember.findMany({
      where: {
        projectId: joinRequest.project.id,
        role: { in: ['ADMIN', 'PM'] },
      },
      include: {
        user: { select: { slackUserId: true } },
      },
    });

    const frontendUrl = process.env.FRONTEND_URL ?? 'https://pm.burningbros.kr';
    const settingsUrl = `${frontendUrl}/projects/${joinRequest.project.key}/settings?tab=requests`;

    const blocks = [
      {
        type: 'header',
        text: { type: 'plain_text', text: '📋 프로젝트 참여 요청' },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${joinRequest.requester.name}*님이 *${joinRequest.project.name}* 프로젝트 참여를 요청했습니다.`,
        },
      },
      ...(joinRequest.message
        ? [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `> ${joinRequest.message}`,
              },
            },
          ]
        : []),
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: '승인/거절하기' },
            url: settingsUrl,
            style: 'primary',
          },
        ],
      },
    ];

    const text = `${joinRequest.requester.name}님이 ${joinRequest.project.name} 프로젝트 참여를 요청했습니다.`;

    for (const member of adminsAndPms) {
      if (member.user.slackUserId) {
        try {
          await this.slackService.sendMessage(
            slackStatus.integrationId,
            member.user.slackUserId,
            blocks,
            text,
          );
        } catch (err) {
          this.logger.warn(
            `Failed to send Slack DM to ${member.user.slackUserId}: ${(err as Error).message}`,
          );
        }
      }
    }
  }
}
