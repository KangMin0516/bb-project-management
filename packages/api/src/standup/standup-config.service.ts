import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateConfigDto } from './dto/create-config.dto.js';
import { CreateQuestionDto } from './dto/create-question.dto.js';
import { UpdateConfigDto } from './dto/update-config.dto.js';
import { UpdateQuestionDto } from './dto/update-question.dto.js';

/**
 * StandupConfigService — pure CRUD for standup questions, configs, and
 * read-only reports. Carved out of the legacy 1057-LOC StandupService
 * per refactor-plan.md §7.7. Has no external dependencies beyond
 * Prisma — kept deliberately Slack-free so the admin UI flows have a
 * clean target.
 *
 * The Slack-bot side (processMessage / handleAction / quick-issue
 * preview) and the report lifecycle (triggerStandup,
 * remindUnanswered) stay in StandupService for now. Splitting those
 * further is deferred — the methods chain through 5-6 levels of
 * intra-service helpers and shared WebClient construction, and a
 * forced split would bleed responsibilities across a DI boundary
 * without making any of the parts more testable.
 */
@Injectable()
export class StandupConfigService {
  constructor(private readonly prisma: PrismaService) {}

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
      if (dto.questions) {
        await tx.standupConfigQuestion.deleteMany({ where: { configId: id } });
        await tx.standupConfigQuestion.createMany({
          data: dto.questions.map((q) => ({
            configId: id,
            questionId: q.questionId,
            order: q.order,
          })),
        });
      }

      if (dto.members) {
        await tx.standupConfigMember.deleteMany({ where: { configId: id } });
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
          questions: {
            include: { question: true },
            orderBy: { order: 'asc' },
          },
          members: true,
        },
      });
    });
  }

  async deleteConfig(id: string) {
    await this.ensureConfigExists(id);
    return this.prisma.standupConfig.delete({ where: { id } });
  }

  // ─── Report reads (per-config history) ────────────────────

  getReports(configId: string, limit = 50) {
    return this.prisma.standupReport.findMany({
      where: { configId },
      include: {
        answers: { include: { question: true }, orderBy: { order: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // ─── Helpers (existence guards) ───────────────────────────

  private async ensureQuestionExists(id: string) {
    const q = await this.prisma.standupQuestion.findUnique({ where: { id } });
    if (!q) throw new NotFoundException('Question not found');
  }

  private async ensureConfigExists(id: string) {
    const c = await this.prisma.standupConfig.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Config not found');
  }
}
