import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  MESSAGING_PORT,
  type MessagingPort,
} from '../common/ports/messaging.port.js';
import {
  formatMorningDigest,
  formatEveningDigest,
  type DigestData,
  type ProjectStats,
  type MemberStats,
  type OverdueIssue,
  type StalledIssue,
} from './formatters/mgmt-digest.formatter.js';

@Injectable()
export class MgmtDigestService {
  private readonly logger = new Logger(MgmtDigestService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(MESSAGING_PORT) private messaging: MessagingPort,
    private config: ConfigService,
  ) {}

  private get baseUrl(): string {
    return this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
  }

  isEnabled(): boolean {
    return this.config.get<string>('MGMT_DIGEST_ENABLED') === 'true';
  }

  private get channelId(): string | undefined {
    return this.config.get<string>('MGMT_DIGEST_CHANNEL_ID');
  }

  async gatherDigestData(): Promise<DigestData> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const [
      projectStats,
      memberStats,
      overdueIssues,
      stalledIssues,
      unassignedCount,
      standupMissing,
    ] = await Promise.all([
      this.getProjectStats(todayStart),
      this.getMemberStats(todayStart),
      this.getOverdueIssues(todayStart),
      this.getStalledIssues(threeDaysAgo),
      this.getUnassignedCount(),
      this.getStandupMissing(todayStart),
    ]);

    return {
      projectStats,
      memberStats,
      overdueIssues,
      stalledIssues,
      unassignedCount,
      standupMissing,
    };
  }

  private async getProjectStats(todayStart: Date): Promise<ProjectStats[]> {
    const projects = await this.prisma.project.findMany({
      select: { id: true, name: true, key: true },
    });

    const stats: ProjectStats[] = [];

    for (const project of projects) {
      const [active, inProgress, completedTodayActivities, createdToday] =
        await Promise.all([
          this.prisma.issue.count({
            where: {
              projectId: project.id,
              status: { notIn: ['DONE', 'CANCELED'] },
            },
          }),
          this.prisma.issue.count({
            where: { projectId: project.id, status: 'IN_PROGRESS' },
          }),
          this.prisma.activity.findMany({
            where: {
              issue: { projectId: project.id },
              field: 'status',
              newValue: 'DONE',
              createdAt: { gte: todayStart },
            },
            select: { issueId: true },
            distinct: ['issueId'],
          }),
          this.prisma.issue.count({
            where: { projectId: project.id, createdAt: { gte: todayStart } },
          }),
        ]);

      const completedToday = completedTodayActivities.length;

      if (
        active > 0 ||
        inProgress > 0 ||
        completedToday > 0 ||
        createdToday > 0
      ) {
        stats.push({
          projectId: project.id,
          projectName: project.name,
          projectKey: project.key,
          active,
          inProgress,
          completedToday,
          createdToday,
        });
      }
    }

    return stats;
  }

  private async getMemberStats(todayStart: Date): Promise<MemberStats[]> {
    const users = await this.prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats: MemberStats[] = [];

    for (const user of users) {
      const [focus, inProgress, completedActivities] = await Promise.all([
        this.prisma.issue.count({
          where: {
            assigneeId: user.id,
            focusDate: today,
            status: { notIn: ['DONE', 'CANCELED'] },
          },
        }),
        this.prisma.issue.count({
          where: {
            assigneeId: user.id,
            status: 'IN_PROGRESS',
          },
        }),
        this.prisma.activity.findMany({
          where: {
            issue: { assigneeId: user.id },
            field: 'status',
            newValue: 'DONE',
            createdAt: { gte: todayStart },
          },
          select: { issueId: true },
          distinct: ['issueId'],
        }),
      ]);

      stats.push({
        userId: user.id,
        name: user.name,
        focus,
        inProgress,
        completedToday: completedActivities.length,
      });
    }

    return stats;
  }

  private async getOverdueIssues(todayStart: Date): Promise<OverdueIssue[]> {
    const issues = await this.prisma.issue.findMany({
      where: {
        dueDate: { lt: todayStart },
        status: { notIn: ['DONE', 'CANCELED'] },
      },
      include: {
        assignee: { select: { name: true } },
        project: { select: { key: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 15,
    });

    return issues.map((i) => ({
      projectKey: i.project.key,
      projectId: i.projectId,
      number: i.number,
      title: i.title,
      assigneeName: i.assignee?.name ?? null,
      dueDate: i.dueDate!,
    }));
  }

  private async getStalledIssues(threeDaysAgo: Date): Promise<StalledIssue[]> {
    // IN_PROGRESS issues where the latest activity is older than 3 days
    const inProgressIssues = await this.prisma.issue.findMany({
      where: { status: 'IN_PROGRESS' },
      include: {
        assignee: { select: { name: true } },
        project: { select: { key: true } },
        activities: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        },
      },
    });

    return inProgressIssues
      .filter((i) => {
        const lastActivity = i.activities[0]?.createdAt;
        if (!lastActivity) return true; // no activity at all
        return lastActivity < threeDaysAgo;
      })
      .map((i) => ({
        projectKey: i.project.key,
        projectId: i.projectId,
        number: i.number,
        title: i.title,
        assigneeName: i.assignee?.name ?? null,
        lastActivityAt: i.activities[0]?.createdAt ?? null,
      }));
  }

  private async getUnassignedCount(): Promise<number> {
    return this.prisma.issue.count({
      where: {
        assigneeId: null,
        status: { notIn: ['DONE', 'CANCELED'] },
      },
    });
  }

  private async getStandupMissing(todayStart: Date): Promise<string[]> {
    // Get all active standup configs with their members
    const configs = await this.prisma.standupConfig.findMany({
      where: { enabled: true },
      include: {
        members: { where: { isAway: false } },
      },
    });

    if (configs.length === 0) return [];

    // Get all standup reports submitted today
    const todayReports = await this.prisma.standupReport.findMany({
      where: {
        createdAt: { gte: todayStart },
        status: 'ANSWERED',
      },
      select: { slackUserId: true },
    });

    const submittedSlackIds = new Set(todayReports.map((r) => r.slackUserId));

    // Find members who haven't submitted
    const allMembers = new Map<string, string>();
    for (const config of configs) {
      for (const member of config.members) {
        if (!submittedSlackIds.has(member.slackUserId)) {
          // Use username or slackUserId as fallback
          allMembers.set(
            member.slackUserId,
            member.username ?? member.slackUserId,
          );
        }
      }
    }

    return Array.from(allMembers.values());
  }

  async sendDigest(type: 'morning' | 'evening'): Promise<void> {
    if (!this.isEnabled()) {
      this.logger.debug('Management digest is disabled');
      return;
    }

    const channel = this.channelId;
    if (!channel) {
      this.logger.warn('MGMT_DIGEST_CHANNEL_ID is not configured');
      return;
    }

    // Find the first available Slack integration
    const integration = await this.prisma.slackIntegration.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!integration) {
      this.logger.warn('No Slack integration available for management digest');
      return;
    }

    const data = await this.gatherDigestData();

    const report =
      type === 'morning'
        ? formatMorningDigest(data, this.baseUrl)
        : formatEveningDigest(data, this.baseUrl);

    await this.messaging.sendChannelMessage(
      integration.id,
      channel,
      report.text,
      report.blocks,
    );

    this.logger.log(`Sent ${type} management digest to ${channel}`);
  }
}
