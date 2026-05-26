import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  MESSAGING_PORT,
  type MessageBlock,
  type MessagingPort,
} from '../common/ports/messaging.port.js';
import type { UpdateReportConfigDto } from './dto/update-report-config.dto.js';
import { formatMorningReport } from './formatters/morning.formatter.js';
import { formatLunchReport } from './formatters/lunch.formatter.js';
import { formatEveningReport } from './formatters/evening.formatter.js';

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(MESSAGING_PORT) private messaging: MessagingPort,
    private config: ConfigService,
  ) {}

  private get baseUrl(): string {
    return this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
  }

  // ─── Config CRUD ─────────────────────────────────────────

  async getConfig(projectId: string) {
    return this.prisma.dailyReportConfig.findUnique({
      where: { projectId },
      include: { slackIntegration: { select: { id: true, teamName: true } } },
    });
  }

  async upsertConfig(projectId: string, dto: UpdateReportConfigDto) {
    const data = {
      ...(dto.enabled !== undefined && { enabled: dto.enabled }),
      ...(dto.timezone !== undefined && { timezone: dto.timezone }),
      ...(dto.morningTime !== undefined && { morningTime: dto.morningTime }),
      ...(dto.morningChannelId !== undefined && {
        morningChannelId: dto.morningChannelId,
      }),
      ...(dto.morningChannelName !== undefined && {
        morningChannelName: dto.morningChannelName,
      }),
      ...(dto.lunchTime !== undefined && { lunchTime: dto.lunchTime }),
      ...(dto.lunchChannelId !== undefined && {
        lunchChannelId: dto.lunchChannelId,
      }),
      ...(dto.lunchChannelName !== undefined && {
        lunchChannelName: dto.lunchChannelName,
      }),
      ...(dto.eveningTime !== undefined && { eveningTime: dto.eveningTime }),
      ...(dto.eveningChannelId !== undefined && {
        eveningChannelId: dto.eveningChannelId,
      }),
      ...(dto.eveningChannelName !== undefined && {
        eveningChannelName: dto.eveningChannelName,
      }),
      ...(dto.skipWeekends !== undefined && {
        skipWeekends: dto.skipWeekends,
      }),
      ...(dto.slackIntegrationId !== undefined && {
        slackIntegrationId: dto.slackIntegrationId,
      }),
    };

    const existing = await this.prisma.dailyReportConfig.findUnique({
      where: { projectId },
    });

    if (existing) {
      return this.prisma.dailyReportConfig.update({
        where: { projectId },
        data,
        include: {
          slackIntegration: { select: { id: true, teamName: true } },
        },
      });
    }

    if (!dto.slackIntegrationId) {
      throw new ForbiddenException(
        'slackIntegrationId is required to create a report config',
      );
    }

    return this.prisma.dailyReportConfig.create({
      data: {
        projectId,
        slackIntegrationId: dto.slackIntegrationId,
        ...data,
      },
      include: {
        slackIntegration: { select: { id: true, teamName: true } },
      },
    });
  }

  // ─── Report Generation ───────────────────────────────────

  async generateMorningReport(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException('Project not found');

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const issues = await this.prisma.issue.findMany({
      where: {
        projectId,
        archivedAt: null,
        status: { in: ['TODO', 'IN_PROGRESS'] },
      },
      include: {
        assignee: true,
        project: { select: { key: true } },
      },
      orderBy: [{ assigneeId: 'asc' }, { priority: 'asc' }],
    });

    const overdueIssues = await this.prisma.issue.findMany({
      where: {
        projectId,
        archivedAt: null,
        // EPIC 자체는 자식 이슈를 묶는 컨테이너라 epic.dueDate 기준 overdue는
        // PM 입장에서 실제 작업 단위가 아니다. 자식 이슈는 그대로 잡힌다.
        type: { not: 'EPIC' },
        dueDate: { lt: todayStart },
        status: { notIn: ['DONE', 'CANCELED'] },
      },
      include: {
        assignee: true,
        project: { select: { key: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    return formatMorningReport(
      project.name,
      issues,
      overdueIssues,
      this.baseUrl,
    );
  }

  async generateLunchReport(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException('Project not found');

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const activities = await this.prisma.activity.findMany({
      where: {
        // Skip activities tied to issues that are now archived — they
        // show up as orphaned history in the lunch digest, which
        // confuses the team. Activities on still-active issues only.
        issue: { projectId, archivedAt: null },
        createdAt: { gte: todayStart },
      },
      include: {
        issue: {
          include: { project: { select: { key: true } } },
        },
        user: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return formatLunchReport(project.name, activities, this.baseUrl);
  }

  async generateEveningReport(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException('Project not found');

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Completed today: issues with a status activity changing to DONE
    // today. Filter out activities tied to issues that were archived
    // after completion — those moved off the board, no need to
    // re-celebrate them in the evening report.
    const completedActivities = await this.prisma.activity.findMany({
      where: {
        issue: { projectId, archivedAt: null },
        field: 'status',
        newValue: 'DONE',
        createdAt: { gte: todayStart },
      },
      select: { issueId: true },
      distinct: ['issueId'],
    });
    const completedIds = completedActivities.map((a) => a.issueId);

    const completedToday =
      completedIds.length > 0
        ? await this.prisma.issue.findMany({
            where: { id: { in: completedIds }, archivedAt: null },
            include: {
              assignee: true,
              project: { select: { key: true } },
            },
          })
        : [];

    // In progress — snapshot of active work, so archived issues are
    // out of scope (matches the "Overall: X/Y done" denominator).
    const inProgress = await this.prisma.issue.findMany({
      where: { projectId, archivedAt: null, status: 'IN_PROGRESS' },
      include: {
        assignee: true,
        project: { select: { key: true } },
      },
      orderBy: { priority: 'asc' },
    });

    // Overdue — same scope as In progress. Archived overdue rows are
    // historical drift; surfacing them in the daily report just
    // creates noise the team can't act on anymore. EPIC도 자식 이슈를
    // 묶는 컨테이너라 epic 자체의 dueDate 기준 overdue는 의미가 약하다.
    const overdueIssues = await this.prisma.issue.findMany({
      where: {
        projectId,
        archivedAt: null,
        type: { not: 'EPIC' },
        dueDate: { lt: todayStart },
        status: { notIn: ['DONE', 'CANCELED'] },
      },
      include: {
        assignee: true,
        project: { select: { key: true } },
      },
    });

    // Created today
    const createdTodayCount = await this.prisma.issue.count({
      where: { projectId, archivedAt: null, createdAt: { gte: todayStart } },
    });

    // Overall progress — count only ACTIVE work. Archived issues are
    // out of scope (already shipped + cleared off the board); counting
    // them in the denominator inflated the "% done" number so that a
    // project with 2 active DONE out of 10 active issues was reading
    // 89% just because 69 historical DONE rows were archived.
    const totalAll = await this.prisma.issue.count({
      where: { projectId, archivedAt: null },
    });
    const totalDone = await this.prisma.issue.count({
      where: { projectId, archivedAt: null, status: 'DONE' },
    });

    return formatEveningReport(
      project.name,
      completedToday,
      inProgress,
      overdueIssues,
      createdTodayCount,
      totalDone,
      totalAll,
      this.baseUrl,
    );
  }

  // ─── Send Report ─────────────────────────────────────────

  async sendReport(
    projectId: string,
    type: 'morning' | 'lunch' | 'evening',
    opts: { bypassEmpty?: boolean } = {},
  ): Promise<void> {
    const config = await this.prisma.dailyReportConfig.findUnique({
      where: { projectId },
    });

    if (!config) {
      throw new NotFoundException('Report config not found');
    }

    let channelId: string | null = null;
    if (type === 'morning') channelId = config.morningChannelId;
    else if (type === 'lunch') channelId = config.lunchChannelId;
    else channelId = config.eveningChannelId;

    if (!channelId) {
      this.logger.warn(
        `No channel configured for ${type} report on project ${projectId}`,
      );
      return;
    }

    let report: { blocks: MessageBlock[]; text: string; isEmpty: boolean };
    if (type === 'morning') {
      report = await this.generateMorningReport(projectId);
    } else if (type === 'lunch') {
      report = await this.generateLunchReport(projectId);
    } else {
      report = await this.generateEveningReport(projectId);
    }

    if (report.isEmpty && !opts.bypassEmpty) {
      this.logger.log(
        `Skipping empty ${type} report for project ${projectId} — nothing to report`,
      );
      return;
    }

    await this.messaging.sendChannelMessage(
      config.slackIntegrationId,
      channelId,
      report.text,
      report.blocks,
    );
  }
}
