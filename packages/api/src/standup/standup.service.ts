import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { WebClient } from '@slack/web-api';
import { PrismaService } from '../prisma/prisma.service.js';
import { SlackService } from '../slack/slack.service.js';
import { CreateQuestionDto } from './dto/create-question.dto.js';
import { UpdateQuestionDto } from './dto/update-question.dto.js';
import { CreateConfigDto } from './dto/create-config.dto.js';
import { UpdateConfigDto } from './dto/update-config.dto.js';
import { formatStandupReport } from './formatters/report.formatter.js';
import { IssueStatus } from '../../generated/prisma/enums.js';

@Injectable()
export class StandupService {
  private readonly logger = new Logger(StandupService.name);

  constructor(
    private prisma: PrismaService,
    private slackService: SlackService,
  ) {}

  // ─── Question CRUD ────────────────────────────────────────

  listQuestions() {
    return this.prisma.standupQuestion.findMany({
      orderBy: { order: 'asc' },
    });
  }

  createQuestion(dto: CreateQuestionDto) {
    return this.prisma.standupQuestion.create({
      data: {
        text: dto.text,
        ignoreText: dto.ignoreText ?? 'nothing nope none no -',
        order: dto.order ?? 0,
      },
    });
  }

  async updateQuestion(id: string, dto: UpdateQuestionDto) {
    await this.ensureQuestionExists(id);
    return this.prisma.standupQuestion.update({
      where: { id },
      data: {
        ...(dto.text !== undefined && { text: dto.text }),
        ...(dto.ignoreText !== undefined && { ignoreText: dto.ignoreText }),
        ...(dto.order !== undefined && { order: dto.order }),
      },
    });
  }

  async deleteQuestion(id: string) {
    await this.ensureQuestionExists(id);
    return this.prisma.standupQuestion.delete({ where: { id } });
  }

  // ─── Config CRUD ──────────────────────────────────────────

  listConfigs() {
    return this.prisma.standupConfig.findMany({
      include: {
        questions: {
          include: { question: true },
          orderBy: { order: 'asc' },
        },
        members: true,
        _count: { select: { reports: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createConfig(dto: CreateConfigDto) {
    return this.prisma.standupConfig.create({
      data: {
        name: dto.name,
        ...(dto.greeting && { greeting: dto.greeting }),
        ...(dto.goodbye && { goodbye: dto.goodbye }),
        channelId: dto.channelId,
        channelName: dto.channelName,
        ...(dto.cronHour && { cronHour: dto.cronHour }),
        ...(dto.cronMinute && { cronMinute: dto.cronMinute }),
        ...(dto.cronDayOfWeek && { cronDayOfWeek: dto.cronDayOfWeek }),
        ...(dto.timezone && { timezone: dto.timezone }),
        enabled: dto.enabled ?? true,
        slackIntegrationId: dto.slackIntegrationId,
        questions: dto.questions
          ? {
              create: dto.questions.map((q) => ({
                questionId: q.questionId,
                order: q.order,
              })),
            }
          : undefined,
        members: dto.members
          ? {
              create: dto.members.map((m) => ({
                slackUserId: m.slackUserId,
                username: m.username,
              })),
            }
          : undefined,
      },
      include: {
        questions: { include: { question: true }, orderBy: { order: 'asc' } },
        members: true,
      },
    });
  }

  async updateConfig(id: string, dto: UpdateConfigDto) {
    await this.ensureConfigExists(id);

    // Update scalar fields
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.greeting !== undefined) data.greeting = dto.greeting;
    if (dto.goodbye !== undefined) data.goodbye = dto.goodbye;
    if (dto.channelId !== undefined) data.channelId = dto.channelId;
    if (dto.channelName !== undefined) data.channelName = dto.channelName;
    if (dto.cronHour !== undefined) data.cronHour = dto.cronHour;
    if (dto.cronMinute !== undefined) data.cronMinute = dto.cronMinute;
    if (dto.cronDayOfWeek !== undefined) data.cronDayOfWeek = dto.cronDayOfWeek;
    if (dto.timezone !== undefined) data.timezone = dto.timezone;
    if (dto.enabled !== undefined) data.enabled = dto.enabled;

    return this.prisma.$transaction(async (tx) => {
      // Replace questions if provided
      if (dto.questions) {
        await tx.standupConfigQuestion.deleteMany({
          where: { configId: id },
        });
        await tx.standupConfigQuestion.createMany({
          data: dto.questions.map((q) => ({
            configId: id,
            questionId: q.questionId,
            order: q.order,
          })),
        });
      }

      // Replace members if provided
      if (dto.members) {
        await tx.standupConfigMember.deleteMany({
          where: { configId: id },
        });
        await tx.standupConfigMember.createMany({
          data: dto.members.map((m) => ({
            configId: id,
            slackUserId: m.slackUserId,
            username: m.username,
          })),
        });
      }

      return tx.standupConfig.update({
        where: { id },
        data,
        include: {
          questions: { include: { question: true }, orderBy: { order: 'asc' } },
          members: true,
        },
      });
    });
  }

  async deleteConfig(id: string) {
    await this.ensureConfigExists(id);
    return this.prisma.standupConfig.delete({ where: { id } });
  }

  getReports(configId: string, limit = 50) {
    return this.prisma.standupReport.findMany({
      where: { configId },
      include: {
        answers: {
          include: { question: true },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // ─── Trigger Standup ──────────────────────────────────────

  async triggerStandup(configId: string) {
    const config = await this.prisma.standupConfig.findUnique({
      where: { id: configId },
      include: {
        questions: {
          include: { question: true },
          orderBy: { order: 'asc' },
        },
        members: true,
        slackIntegration: true,
      },
    });

    if (!config) throw new NotFoundException('Config not found');
    if (config.questions.length === 0) {
      this.logger.warn(`Config ${config.name} has no questions, skipping`);
      return;
    }

    const client = this.getClient(config.slackIntegration.botToken);

    // Auto-expire ACTIVE reports older than 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const { count: expiredCount } = await this.prisma.standupReport.updateMany({
      where: {
        configId: config.id,
        status: 'ACTIVE',
        createdAt: { lt: twentyFourHoursAgo },
      },
      data: { status: 'UNANSWERED', updatedAt: new Date() },
    });
    if (expiredCount > 0) {
      this.logger.log(`Auto-expired ${expiredCount} stale ACTIVE report(s) for ${config.name}`);
    }

    // Batch-check for existing active reports to avoid N+1 queries
    const eligibleSlackIds = config.members
      .filter((m) => !m.isAway)
      .map((m) => m.slackUserId);
    const activeReports = await this.prisma.standupReport.findMany({
      where: {
        configId: config.id,
        slackUserId: { in: eligibleSlackIds },
        status: 'ACTIVE',
      },
      select: { slackUserId: true },
    });
    const activeSlackIds = new Set(activeReports.map((r) => r.slackUserId));

    for (const member of config.members) {
      if (member.isAway) continue;

      if (activeSlackIds.has(member.slackUserId)) {
        this.logger.warn(
          `Skipping ${member.slackUserId} — already has active report`,
        );
        continue;
      }

      try {
        await this.startReportForUser(client, config, member);
      } catch (err) {
        this.logger.error(
          `Failed to start standup for ${member.slackUserId}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }

    // Update lastTriggeredAt
    await this.prisma.standupConfig.update({
      where: { id: configId },
      data: { lastTriggeredAt: new Date() },
    });
  }

  private async startReportForUser(
    client: WebClient,
    config: {
      id: string;
      name: string;
      greeting: string;
      questions: Array<{
        question: { id: string; text: string };
        order: number;
      }>;
    },
    member: { slackUserId: string; username: string | null },
  ) {
    // Create report with all answers pre-created
    const report = await this.prisma.standupReport.create({
      data: {
        configId: config.id,
        slackUserId: member.slackUserId,
        username: member.username,
        currentQuestionOrder: 0,
        answers: {
          create: config.questions.map((q) => ({
            questionId: q.question.id,
            order: q.order,
          })),
        },
      },
    });

    // Open DM channel
    const dm = await client.conversations.open({
      users: member.slackUserId,
    });
    const dmChannelId = dm.channel?.id;
    if (!dmChannelId) {
      this.logger.error(`Could not open DM with ${member.slackUserId}`);
      return;
    }

    // Send greeting — support both {{var}} and ${var} formats
    const name = member.username ?? member.slackUserId;
    const greetingText = config.greeting
      .replace(/\{\{username\}\}/g, name)
      .replace(/\$\{username\}/g, name)
      .replace(/\{\{config_name\}\}/g, config.name)
      .replace(/\$\{config_name\}/g, config.name);

    await client.chat.postMessage({
      channel: dmChannelId,
      text: greetingText,
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: greetingText },
        },
        {
          type: 'actions',
          block_id: `standup_actions_${report.id}`,
          elements: [
            {
              type: 'static_select',
              action_id: 'standup_status_select',
              placeholder: {
                type: 'plain_text',
                text: 'Options...',
              },
              options: [
                {
                  text: { type: 'plain_text', text: 'Cancel' },
                  value: `cancel_${report.id}`,
                },
              ],
            },
          ],
        },
      ],
    });

    // Try Slack-User mapping and send issue list block
    const mappedUserId = await this.mapSlackUserToSystemUser(
      member.slackUserId,
      client,
    );
    if (mappedUserId) {
      await this.sendIssueListBlock(client, dmChannelId, mappedUserId);
    }

    // Send first question
    const firstQuestion = config.questions[0];
    if (firstQuestion) {
      await client.chat.postMessage({
        channel: dmChannelId,
        text: `*${firstQuestion.question.text}*`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${firstQuestion.question.text}*`,
            },
          },
        ],
      });
    }
  }

  // ─── Process DM Message ───────────────────────────────────

  async processMessage(event: {
    user: string;
    text: string;
    channel: string;
    ts: string;
  }) {
    // Find active report for this user
    const report = await this.prisma.standupReport.findFirst({
      where: {
        slackUserId: event.user,
        status: 'ACTIVE',
      },
      include: {
        answers: {
          include: { question: true },
          orderBy: { order: 'asc' },
        },
        config: {
          include: {
            questions: {
              include: { question: true },
              orderBy: { order: 'asc' },
            },
            slackIntegration: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!report) return; // No active report, ignore

    const currentOrder = report.currentQuestionOrder ?? 0;
    const currentAnswer = report.answers.find((a) => a.order === currentOrder);
    if (!currentAnswer) return;

    // Save answer + store user message ts for edit tracking
    await this.prisma.standupAnswer.update({
      where: { id: currentAnswer.id },
      data: { answer: event.text, messageTs: event.ts },
    });

    const client = this.getClient(report.config.slackIntegration.botToken);

    // Check if there's a next question
    const nextOrder = currentOrder + 1;
    const nextConfigQuestion = report.config.questions.find(
      (q) => q.order === nextOrder,
    );

    if (nextConfigQuestion) {
      // Update current question order
      await this.prisma.standupReport.update({
        where: { id: report.id },
        data: { currentQuestionOrder: nextOrder },
      });

      // Send next question
      await client.chat.postMessage({
        channel: event.channel,
        text: `*${nextConfigQuestion.question.text}*`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${nextConfigQuestion.question.text}*`,
            },
          },
        ],
      });
    } else {
      // All questions answered — mark complete
      await this.prisma.standupReport.update({
        where: { id: report.id },
        data: { status: 'ANSWERED' },
      });

      // Send goodbye — support both {{var}} and ${var} formats
      const goodbyeText = report.config.goodbye
        .replace(/\{\{username\}\}/g, report.username ?? report.slackUserId)
        .replace(/\$\{username\}/g, report.username ?? report.slackUserId)
        .replace(/\{\{config_name\}\}/g, report.config.name)
        .replace(/\$\{config_name\}/g, report.config.name);
      await client.chat.postMessage({
        channel: event.channel,
        text: goodbyeText,
      });

      // Post report to channel
      await this.postReportToChannel(report.id);
    }
  }

  // ─── Process Message Edit ─────────────────────────────────

  async processEdit(event: {
    channel: string;
    message: { user: string; text: string; ts: string };
  }) {
    // Find the answer by messageTs
    const answer = await this.prisma.standupAnswer.findFirst({
      where: { messageTs: event.message.ts },
    });

    if (answer) {
      await this.prisma.standupAnswer.update({
        where: { id: answer.id },
        data: { answer: event.message.text },
      });
    }
  }

  // ─── Handle Interactive Actions ───────────────────────────

  async handleAction(action: {
    action_id: string;
    selected_option?: { value: string };
    value?: string;
    block_id?: string;
  }) {
    if (action.action_id === 'standup_status_select') {
      await this.handleStatusSelect(action.selected_option?.value ?? '');
    } else if (action.action_id === 'standup_reassign') {
      await this.handleReassign(action.value);
    }
  }

  private async handleStatusSelect(value: string) {
    const separatorIndex = value.indexOf('_');
    if (separatorIndex === -1) return;

    const actionType = value.substring(0, separatorIndex);
    const reportId = value.substring(separatorIndex + 1);

    const report = await this.prisma.standupReport.findUnique({
      where: { id: reportId },
    });

    if (!report || report.status !== 'ACTIVE') return;

    if (actionType !== 'cancel') return;
    const newStatus = 'CANCELED';

    await this.prisma.standupReport.update({
      where: { id: reportId },
      data: { status: newStatus },
    });
    await this.postReportToChannel(reportId);
  }

  private async handleReassign(reportId?: string) {
    if (!reportId) return;

    const report = await this.prisma.standupReport.findUnique({
      where: { id: reportId },
      include: {
        config: {
          include: {
            questions: {
              include: { question: true },
              orderBy: { order: 'asc' },
            },
            slackIntegration: true,
          },
        },
      },
    });

    if (!report) return;

    // Reset report atomically
    await this.prisma.$transaction(async (tx) => {
      await tx.standupAnswer.deleteMany({
        where: { reportId: report.id },
      });
      await tx.standupReport.update({
        where: { id: report.id },
        data: { status: 'ACTIVE', currentQuestionOrder: 0 },
      });
      await tx.standupAnswer.createMany({
        data: report.config.questions.map((q) => ({
          reportId: report.id,
          questionId: q.question.id,
          order: q.order,
        })),
      });
    });

    const client = this.getClient(report.config.slackIntegration.botToken);

    const dm = await client.conversations.open({
      users: report.slackUserId,
    });
    const dmChannelId = dm.channel?.id;
    if (!dmChannelId) return;

    const firstQuestion = report.config.questions[0];
    if (firstQuestion) {
      await client.chat.postMessage({
        channel: dmChannelId,
        text: `Let's try again! *${firstQuestion.question.text}*`,
      });
    }
  }

  // ─── Post Report to Channel ───────────────────────────────

  private async postReportToChannel(reportId: string) {
    const report = await this.prisma.standupReport.findUnique({
      where: { id: reportId },
      include: {
        answers: {
          include: { question: true },
          orderBy: { order: 'asc' },
        },
        config: { include: { slackIntegration: true } },
      },
    });

    if (!report) return;

    const client = this.getClient(report.config.slackIntegration.botToken);

    // Fetch user profile for avatar and display name
    let iconUrl: string | undefined;
    let displayName = report.username ?? report.slackUserId;
    try {
      const userInfo = await client.users.info({
        user: report.slackUserId,
      });
      if (userInfo.user?.profile) {
        iconUrl =
          userInfo.user.profile.image_72 ??
          userInfo.user.profile.image_48 ??
          undefined;
        displayName =
          userInfo.user.real_name ?? userInfo.user.name ?? displayName;
      }
    } catch (err) {
      this.logger.warn(
        `Could not fetch user profile for ${report.slackUserId}`,
        err instanceof Error ? err.message : String(err),
      );
    }

    const { attachments, text } = formatStandupReport({
      username: displayName,
      configName: report.config.name,
      answers: report.answers,
      status: report.status,
    });

    await client.chat.postMessage({
      channel: report.config.channelId,
      text,
      attachments: attachments as never[],
      username: displayName,
      icon_url: iconUrl,
    });
  }

  // ─── Remind Unanswered ───────────────────────────────────

  async remindUnanswered() {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

    // Find ACTIVE reports created more than 30 min ago that haven't been reminded
    const reports = await this.prisma.standupReport.findMany({
      where: {
        status: 'ACTIVE',
        remindedAt: null,
        createdAt: { lt: thirtyMinAgo },
      },
      include: {
        config: { include: { slackIntegration: true } },
      },
    });

    for (const report of reports) {
      try {
        const client = this.getClient(report.config.slackIntegration.botToken);

        const dm = await client.conversations.open({
          users: report.slackUserId,
        });
        const dmChannelId = dm.channel?.id;
        if (!dmChannelId) continue;

        const name = report.username ?? report.slackUserId;
        await client.chat.postMessage({
          channel: dmChannelId,
          text: `:bell: Reminder: *${name}*, please complete your *${report.config.name}* standup!`,
        });

        await this.prisma.standupReport.update({
          where: { id: report.id },
          data: { remindedAt: new Date() },
        });

        this.logger.log(`Sent reminder to ${name} for ${report.config.name}`);
      } catch (err) {
        this.logger.error(
          `Failed to remind ${report.slackUserId}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
  }

  // ─── Helpers ──────────────────────────────────────────────

  private getClient(encryptedToken: string): WebClient {
    return new WebClient(this.slackService.decrypt(encryptedToken));
  }

  private async ensureQuestionExists(id: string) {
    const q = await this.prisma.standupQuestion.findUnique({ where: { id } });
    if (!q) throw new NotFoundException('Question not found');
  }

  private async ensureConfigExists(id: string) {
    const c = await this.prisma.standupConfig.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Config not found');
  }

  // ─── Slack-User Mapping ─────────────────────────────────

  private async mapSlackUserToSystemUser(
    slackUserId: string,
    client: WebClient,
  ): Promise<string | null> {
    // Skip if already mapped
    const existing = await this.prisma.user.findFirst({
      where: { slackUserId },
    });
    if (existing) return existing.id;

    try {
      const slackUser = await client.users.info({ user: slackUserId });
      const email = slackUser.user?.profile?.email;
      if (!email) {
        this.logger.warn(
          `Slack user ${slackUserId} has no email in profile — ensure the bot has users:read.email scope`,
        );
        return null;
      }

      const user = await this.prisma.user.findUnique({ where: { email } });
      if (!user) {
        this.logger.warn(
          `No system user found for Slack email ${email} (Slack ID: ${slackUserId})`,
        );
        return null;
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: { slackUserId },
      });
      this.logger.log(
        `Mapped Slack ${slackUserId} → User ${user.id} (${email})`,
      );
      return user.id;
    } catch (err) {
      this.logger.warn(
        `Failed to map Slack user ${slackUserId}`,
        err instanceof Error ? err.message : String(err),
      );
      return null;
    }
  }

  // ─── Issue List Block for DM ────────────────────────────

  private async sendIssueListBlock(
    client: WebClient,
    dmChannelId: string,
    userId: string,
  ) {
    // Use UTC date range — focusDate is stored as @db.Date (UTC midnight)
    // This matches the dashboard's date comparison logic
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setUTCHours(23, 59, 59, 999);

    const activeIssues = await this.prisma.issue.findMany({
      where: {
        assigneeId: userId,
        status: { notIn: [IssueStatus.DONE, IssueStatus.CANCELED] },
      },
      include: { project: { select: { key: true, name: true } } },
      orderBy: [
        { project: { name: 'asc' } },
        { status: 'asc' },
        { focusDate: { sort: 'desc', nulls: 'last' } },
      ],
    });

    if (activeIssues.length === 0) return;

    // Group by project → status
    const grouped = new Map<
      string,
      Map<string, typeof activeIssues>
    >();
    for (const issue of activeIssues) {
      const projName = issue.project.name;
      if (!grouped.has(projName)) grouped.set(projName, new Map());
      const statusMap = grouped.get(projName)!;
      if (!statusMap.has(issue.status)) statusMap.set(issue.status, []);
      statusMap.get(issue.status)!.push(issue);
    }

    const statusOrder = ['IN_PROGRESS', 'TODO', 'BACKLOG'];
    const parts = [`📋 *Your Active Issues (${activeIssues.length})*`];

    for (const [projName, statusMap] of grouped) {
      parts.push(`\n*${projName}*`);
      const sortedStatuses = [...statusMap.keys()].sort(
        (a, b) => (statusOrder.indexOf(a) === -1 ? 99 : statusOrder.indexOf(a))
               - (statusOrder.indexOf(b) === -1 ? 99 : statusOrder.indexOf(b)),
      );
      for (const status of sortedStatuses) {
        parts.push(`  _${status}_`);
        for (const issue of statusMap.get(status)!) {
          const isFocus =
            issue.focusDate &&
            issue.focusDate >= todayStart &&
            issue.focusDate <= todayEnd;
          const prefix = isFocus ? '🎯' : '      ';
          const key = `${issue.project.key}-${issue.number}`;
          const title =
            issue.title.length > 50 ? issue.title.slice(0, 50) + '…' : issue.title;
          parts.push(`${prefix} \`${key}\`  ${title}`);
        }
      }
    }

    parts.push("\n🎯 = Today's Focus");
    const text = parts.join('\n');

    await client.chat.postMessage({
      channel: dmChannelId,
      text,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text,
          },
        },
      ],
    });
  }
}
