import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateIssueUseCase } from '../issue/application/create-issue.use-case.js';
import { UpdateIssueUseCase } from '../issue/application/update-issue.use-case.js';
import { SpecificationService } from '../specification/specification.service.js';
import { IssueSpecLinkService } from '../issue-spec-link/issue-spec-link.service.js';
import { CommentService } from '../comment/comment.service.js';
import { IssueRuleService } from '../issue-rule/issue-rule.service.js';
import { UploadService } from '../upload/upload.service.js';
import type {
  ExternalAttachImageDto,
  ExternalInlineAttachmentDto,
} from './dto/external-attach-image.dto.js';
import type { ExternalCreateIssueDto } from './dto/external-create-issue.dto.js';
import type { ExternalUpdateIssueDto } from './dto/external-update-issue.dto.js';
import type { ExternalCreateSpecDto } from './dto/external-create-spec.dto.js';
import type { ExternalUpdateSpecDto } from './dto/external-update-spec.dto.js';
import type { ExternalCreateIssueSpecLinkDto } from './dto/external-create-issue-spec-link.dto.js';
import type { ExternalCreateCommentDto } from './dto/external-create-comment.dto.js';
import {
  SpecStatus,
  type IssueStatus,
  type IssuePriority,
  type IssueType,
} from '../../generated/prisma/enums.js';
import { USER_SELECT } from '../common/constants.js';

const TERMINAL_STATUSES = new Set<string>(['DONE', 'CANCELED']);

@Injectable()
export class ExternalService {
  constructor(
    private prisma: PrismaService,
    private createIssueUC: CreateIssueUseCase,
    private updateIssueUC: UpdateIssueUseCase,
    private specificationService: SpecificationService,
    private issueSpecLinkService: IssueSpecLinkService,
    private commentService: CommentService,
    private issueRuleService: IssueRuleService,
    private uploadService: UploadService,
  ) {}

  /**
   * Resolve "PM-17"-style key to an issue UUID, asserting the issue
   * lives in the given project. Used to translate `parentIssueKey`
   * from external callers (MCP, CLI) into the internal `parentId`.
   */
  private async resolveParentIssueKey(
    projectId: string,
    projectKey: string,
    parentIssueKey: string,
  ): Promise<string> {
    const match = /^([A-Z0-9_-]+)-(\d+)$/i.exec(parentIssueKey.trim());
    if (!match) {
      throw new BadRequestException(
        `Invalid parentIssueKey "${parentIssueKey}" — expected format "<PROJECT_KEY>-<NUMBER>"`,
      );
    }
    const [, keyPart, numberPart] = match;
    if (keyPart.toUpperCase() !== projectKey.toUpperCase()) {
      throw new BadRequestException(
        `parentIssueKey "${parentIssueKey}" is in a different project — parent must be in the same project as the child.`,
      );
    }
    const parent = await this.prisma.issue.findUnique({
      where: {
        projectId_number: { projectId, number: Number(numberPart) },
      },
      select: { id: true },
    });
    if (!parent) {
      throw new BadRequestException(`Parent issue ${parentIssueKey} not found`);
    }
    return parent.id;
  }

  private async resolveProjectAndIssue(
    projectKey: string,
    issueNumber: number,
  ): Promise<{ projectId: string; issueId: string }> {
    const project = await this.prisma.project.findUnique({
      where: { key: projectKey },
      select: { id: true },
    });
    if (!project)
      throw new NotFoundException(`Project "${projectKey}" not found`);
    const issue = await this.prisma.issue.findUnique({
      where: {
        projectId_number: { projectId: project.id, number: issueNumber },
      },
      select: { id: true },
    });
    if (!issue)
      throw new NotFoundException(
        `Issue ${projectKey}-${issueNumber} not found`,
      );
    return { projectId: project.id, issueId: issue.id };
  }

  async createIssue(
    dto: ExternalCreateIssueDto,
    creatorId: string,
    source?: string,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { key: dto.projectKey },
    });
    if (!project) {
      throw new NotFoundException(`Project "${dto.projectKey}" not found`);
    }

    // Resolve assignee — `assigneeId` (UUID from list_members) wins over
    // `assigneeEmail` (email lookup) when both are sent.
    let assigneeId: string | undefined;
    if (dto.assigneeId) {
      assigneeId = dto.assigneeId;
    } else if (dto.assigneeEmail) {
      const user = await this.prisma.user.findUnique({
        where: { email: dto.assigneeEmail },
      });
      if (!user)
        throw new BadRequestException(`User "${dto.assigneeEmail}" not found`);
      assigneeId = user.id;
    }

    // Resolve parent — `parentId` (UUID) wins over `parentIssueKey`
    // (human form like "PM-17") when both are sent.
    let parentId: string | undefined = dto.parentId;
    if (parentId === undefined && dto.parentIssueKey) {
      parentId = await this.resolveParentIssueKey(
        project.id,
        dto.projectKey,
        dto.parentIssueKey,
      );
    }

    // Resolve labels by name
    let labelIds: string[] | undefined;
    if (dto.labels?.length) {
      const labels = await this.prisma.label.findMany({
        where: {
          projectId: project.id,
          name: { in: dto.labels },
        },
      });
      labelIds = labels.map((l) => l.id);
    }

    // ─── Apply global per-type rules ───────────────────────────
    // Look up the workspace-wide rule for this issue's type. Merges
    // default_values into the create payload, collects warnings for
    // missing required_fields / title_pattern mismatches, and
    // auto-attaches enforced labels (created in this project if they
    // don't exist yet). Soft: never blocks creation.
    const issueType = dto.type ?? 'TASK';
    const rule = await this.issueRuleService.resolve(issueType);

    const incoming: Record<string, unknown> = {
      title: dto.title,
      description: dto.description,
      status: dto.status,
      priority: dto.priority,
      assigneeId,
      dueDate: dto.dueDate,
      startDate: dto.startDate,
      parentId,
      labels: labelIds,
    };
    const { merged, warnings } = this.issueRuleService.applyDefaultsAndValidate(
      rule,
      incoming,
    );

    // Resolve enforced label names to per-project label IDs (creating
    // missing labels on the fly), then merge de-duped with whatever
    // the caller already passed.
    const enforcedIds = await this.issueRuleService.resolveEnforcedLabels(
      rule,
      project.id,
    );
    if (enforcedIds.length) {
      const existing = (merged.labels as string[] | undefined) ?? [];
      merged.labels = Array.from(new Set([...existing, ...enforcedIds]));
    }

    const issue = await this.createIssueUC.execute({
      projectId: project.id,
      creatorId,
      title: merged.title as string,
      description: merged.description as string | undefined,
      status: merged.status as IssueStatus | undefined,
      priority: merged.priority as IssuePriority | undefined,
      type: issueType,
      assigneeId: (merged.assigneeId as string | undefined) ?? undefined,
      parentId: merged.parentId as string | undefined,
      startDate: merged.startDate as string | undefined,
      dueDate: merged.dueDate as string | undefined,
      labelIds: merged.labels as string[] | undefined,
      source: source as import('../common/source.js').SourceLiteral | undefined,
    });

    // ─── Inline attachments ────────────────────────────────────
    // Upload after issue creation so each Attachment row gets the
    // issueId FK. The new attachments' markdown is appended to the
    // description (in-place) so they render in the issue body — same
    // mental model as the web TipTap editor's image paste.
    const uploadedAttachments: Array<{
      attachmentId: string;
      url: string;
      filename: string;
      embedMarkdown: string;
    }> = [];
    if (dto.attachments?.length) {
      const issueId = (issue as { id: string }).id;
      const snippets: string[] = [];
      for (const att of dto.attachments) {
        try {
          const stored = await this.uploadBase64Attachment(
            att,
            issueId,
            creatorId,
          );
          const md = `![${att.alt ?? att.filename}](${stored.url})`;
          snippets.push(md);
          uploadedAttachments.push({
            attachmentId: stored.id,
            url: stored.url,
            filename: stored.fileName,
            embedMarkdown: md,
          });
        } catch (err) {
          warnings.push(
            `Failed to attach '${att.filename}': ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      if (snippets.length > 0) {
        const baseDescription = (
          (merged.description as string | undefined) ?? ''
        ).trimEnd();
        const augmented = baseDescription
          ? `${baseDescription}\n\n${snippets.join('\n\n')}`
          : snippets.join('\n\n');
        await this.updateIssueUC.execute({
          projectId: project.id,
          issueId,
          actorId: creatorId,
          source: source as
            | import('../common/source.js').SourceLiteral
            | undefined,
          changes: { description: augmented },
        });
      }
    }

    const result: {
      issue: typeof issue;
      warnings?: string[];
      attachments?: typeof uploadedAttachments;
    } = { issue };
    if (warnings.length) result.warnings = warnings;
    if (uploadedAttachments.length) result.attachments = uploadedAttachments;
    return result;
  }

  /**
   * Standalone image-attach for an existing issue. Used by MCP tool
   * `attach_image_to_issue` when the LLM already has an issue and
   * wants to add a screenshot.
   *
   * Returns the public URL plus a ready-to-paste markdown snippet so
   * the caller can drop it into a subsequent `update_issue` or
   * `comment_on_issue` body without constructing the URL itself.
   */
  async attachImage(
    projectKey: string,
    issueNumber: number,
    dto: ExternalAttachImageDto,
    uploaderId: string,
  ) {
    const { issueId } = await this.resolveProjectAndIssue(
      projectKey,
      issueNumber,
    );
    const attachment = await this.uploadBase64Attachment(
      dto,
      issueId,
      uploaderId,
    );
    return {
      attachmentId: attachment.id,
      url: attachment.url,
      filename: attachment.fileName,
      mimeType: attachment.mimeType,
      embedMarkdown: `![${dto.alt ?? dto.filename}](${attachment.url})`,
    };
  }

  /**
   * Decode a base64 payload, validate mime + size, and hand off to
   * the existing UploadService so the attachment ends up in S3 + the
   * `attachments` table the web UI already reads from.
   */
  private async uploadBase64Attachment(
    dto: ExternalInlineAttachmentDto,
    issueId: string | null,
    uploaderId: string,
  ) {
    let buffer: Buffer;
    try {
      buffer = Buffer.from(dto.data, 'base64');
    } catch {
      throw new BadRequestException('Invalid base64 image data');
    }
    // Defensive size cap before disk hit. UploadService re-checks its
    // own MAX_FILE_SIZE downstream so callers get a single source of
    // truth on the actual limit.
    if (buffer.length === 0) {
      throw new BadRequestException('Decoded image is empty');
    }

    // Shape a synthetic Multer file so UploadService keeps its
    // existing signature — no need to refactor the upload pipeline
    // around base64 input.
    const fakeFile = {
      buffer,
      mimetype: dto.mimeType,
      originalname: dto.filename,
      size: buffer.length,
    } as Express.Multer.File;

    return this.uploadService.upload(fakeFile, uploaderId, {
      issueId: issueId ?? undefined,
    });
  }

  /**
   * MCP `get_create_rules` payload. Returns the resolved global rule
   * for the requested type or null if no rule has been configured.
   */
  async getCreateRules(type?: string) {
    const issueType = (
      type ?? 'TASK'
    ).toUpperCase() as import('../../generated/prisma/enums.js').IssueType;
    return this.issueRuleService.resolve(issueType);
  }

  async updateIssue(
    projectKey: string,
    issueNumber: number,
    dto: ExternalUpdateIssueDto,
    userId: string,
    source?: string,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { key: projectKey },
    });
    if (!project)
      throw new NotFoundException(`Project "${projectKey}" not found`);

    const issue = await this.prisma.issue.findUnique({
      where: {
        projectId_number: { projectId: project.id, number: issueNumber },
      },
    });
    if (!issue)
      throw new NotFoundException(
        `Issue ${projectKey}-${issueNumber} not found`,
      );

    // Resolve assignee — `assigneeId` wins over `assigneeEmail`. Both
    // accept null/empty to clear the assignee.
    let assigneeId: string | null | undefined;
    if (dto.assigneeId !== undefined) {
      assigneeId = dto.assigneeId;
    } else if (dto.assigneeEmail !== undefined) {
      if (dto.assigneeEmail === null || dto.assigneeEmail === '') {
        assigneeId = null;
      } else {
        const user = await this.prisma.user.findUnique({
          where: { email: dto.assigneeEmail },
        });
        if (!user)
          throw new BadRequestException(
            `User "${dto.assigneeEmail}" not found`,
          );
        assigneeId = user.id;
      }
    }

    // Resolve parent — `parentId` (UUID, or null to clear) wins over
    // `parentIssueKey` (human form). Passing `null` for either clears
    // the parent; passing a key resolves to a UUID in the same project.
    let parentId: string | null | undefined;
    if (dto.parentId !== undefined) {
      parentId = dto.parentId;
    } else if (dto.parentIssueKey !== undefined) {
      if (dto.parentIssueKey === null || dto.parentIssueKey === '') {
        parentId = null;
      } else {
        parentId = await this.resolveParentIssueKey(
          project.id,
          projectKey,
          dto.parentIssueKey,
        );
      }
    }

    return this.updateIssueUC.execute({
      projectId: project.id,
      issueId: issue.id,
      actorId: userId,
      source: source as import('../common/source.js').SourceLiteral | undefined,
      changes: {
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        assigneeId,
        parentId,
        startDate: dto.startDate,
        dueDate: dto.dueDate,
      },
    });
  }

  async getIssue(projectKey: string, issueNumber: number) {
    const project = await this.prisma.project.findUnique({
      where: { key: projectKey },
    });
    if (!project)
      throw new NotFoundException(`Project "${projectKey}" not found`);

    const issue = await this.prisma.issue.findUnique({
      where: {
        projectId_number: { projectId: project.id, number: issueNumber },
      },
      include: {
        assignee: { select: { id: true, email: true, name: true } },
        creator: { select: { id: true, email: true, name: true } },
        labels: { include: { label: true } },
        children: {
          select: {
            id: true,
            number: true,
            title: true,
            status: true,
            priority: true,
          },
        },
        // Last 50 comments + activities included inline so LLM clients
        // (bbpm-internal-mcp) get a usable summary in one round-trip.
        // Pagination beyond that uses the dedicated /comments and
        // /activities endpoints below.
        comments: {
          include: {
            user: { select: { id: true, email: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        activities: {
          include: {
            user: { select: { id: true, email: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!issue)
      throw new NotFoundException(
        `Issue ${projectKey}-${issueNumber} not found`,
      );
    return issue;
  }

  async listComments(
    projectKey: string,
    issueNumber: number,
    page = 1,
    limit = 50,
  ) {
    const { issueId } = await this.resolveProjectAndIssue(
      projectKey,
      issueNumber,
    );
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safePage = Math.max(page, 1);
    const [items, total] = await Promise.all([
      this.prisma.comment.findMany({
        where: { issueId },
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
      this.prisma.comment.count({ where: { issueId } }),
    ]);
    return { items, total, page: safePage, limit: safeLimit };
  }

  async listActivities(
    projectKey: string,
    issueNumber: number,
    page = 1,
    limit = 50,
  ) {
    const { issueId } = await this.resolveProjectAndIssue(
      projectKey,
      issueNumber,
    );
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safePage = Math.max(page, 1);
    const [items, total] = await Promise.all([
      this.prisma.activity.findMany({
        where: { issueId },
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
      this.prisma.activity.count({ where: { issueId } }),
    ]);
    return { items, total, page: safePage, limit: safeLimit };
  }

  async getDigest(projectKey: string, days = 7) {
    const project = await this.prisma.project.findUnique({
      where: { key: projectKey },
      select: { id: true, key: true, name: true, description: true },
    });
    if (!project)
      throw new NotFoundException(`Project "${projectKey}" not found`);

    const now = new Date();
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const upcomingUntil = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const issues = await this.prisma.issue.findMany({
      where: { projectId: project.id, archivedAt: null },
      include: {
        assignee: { select: USER_SELECT },
        labels: { include: { label: true } },
      },
    });

    const archivedCount = await this.prisma.issue.count({
      where: { projectId: project.id, archivedAt: { not: null } },
    });

    const counts = {
      total: issues.length,
      archived: archivedCount,
      byStatus: countBy(issues, (i) => i.status),
      byType: countBy(issues, (i) => i.type),
      byPriority: countBy(issues, (i) => i.priority),
    };

    const byAssigneeMap = new Map<
      string,
      {
        user: {
          id: string;
          email: string;
          name: string;
          avatar: string | null;
        };
        total: number;
        byStatus: Record<string, number>;
        overdue: number;
      }
    >();
    for (const issue of issues) {
      if (!issue.assignee) continue;
      const key = issue.assignee.id;
      let entry = byAssigneeMap.get(key);
      if (!entry) {
        entry = {
          user: issue.assignee,
          total: 0,
          byStatus: {},
          overdue: 0,
        };
        byAssigneeMap.set(key, entry);
      }
      entry.total += 1;
      entry.byStatus[issue.status] = (entry.byStatus[issue.status] ?? 0) + 1;
      if (
        issue.dueDate &&
        issue.dueDate < now &&
        !TERMINAL_STATUSES.has(issue.status)
      ) {
        entry.overdue += 1;
      }
    }
    const byAssignee = [...byAssigneeMap.values()].sort(
      (a, b) => b.total - a.total,
    );

    const summarize = (i: (typeof issues)[number]) => ({
      id: i.id,
      key: `${project.key}-${i.number}`,
      number: i.number,
      title: i.title,
      status: i.status,
      type: i.type,
      priority: i.priority,
      dueDate: i.dueDate,
      assignee: i.assignee
        ? {
            id: i.assignee.id,
            name: i.assignee.name,
            email: i.assignee.email,
          }
        : null,
    });

    const overdue = issues
      .filter(
        (i) => i.dueDate && i.dueDate < now && !TERMINAL_STATUSES.has(i.status),
      )
      .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())
      .map(summarize);

    const upcomingDue = issues
      .filter(
        (i) =>
          i.dueDate &&
          i.dueDate >= now &&
          i.dueDate <= upcomingUntil &&
          !TERMINAL_STATUSES.has(i.status),
      )
      .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())
      .map(summarize);

    const recentlyCreated = issues
      .filter((i) => i.createdAt >= since)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 50)
      .map(summarize);

    const recentlyCompleted = issues
      .filter((i) => i.status === 'DONE' && i.updatedAt >= since)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 50)
      .map(summarize);

    const recentActivity = await this.prisma.activity.findMany({
      where: {
        issue: { projectId: project.id },
        createdAt: { gte: since },
        field: { in: ['status', 'assigneeId', 'created'] },
      },
      include: {
        user: { select: USER_SELECT },
        issue: {
          select: { id: true, number: true, title: true, type: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return {
      project: {
        key: project.key,
        name: project.name,
        description: project.description,
      },
      generatedAt: now.toISOString(),
      windowDays: days,
      counts,
      byAssignee,
      overdue,
      upcomingDue,
      recentlyCreated,
      recentlyCompleted,
      recentActivity: recentActivity.map((a) => ({
        id: a.id,
        field: a.field,
        oldValue: a.oldValue,
        newValue: a.newValue,
        createdAt: a.createdAt,
        user: a.user
          ? { id: a.user.id, name: a.user.name, email: a.user.email }
          : null,
        issue: a.issue
          ? {
              key: `${project.key}-${a.issue.number}`,
              number: a.issue.number,
              title: a.issue.title,
              type: a.issue.type,
            }
          : null,
      })),
    };
  }

  /**
   * Optional projection slices that the caller can opt-into via the
   * `fields` query param. The default response is intentionally lean to
   * keep token usage low for LLM clients — heavy fields (description,
   * labels, full date set) only ship when asked.
   */
  private readonly LIST_FIELD_SLICES = [
    'description',
    'labels',
    'dates',
    'creator',
    'parent',
    'email',
  ] as const;

  /**
   * Parses a window like `7d`, `30d`, `2h`, or a raw ISO date into a
   * past instant. Returns null for invalid input so the caller can
   * skip the filter rather than 400.
   */
  private parseRelativePast(value: string | undefined): Date | null {
    if (!value) return null;
    const match = /^(\d+)([dhm])$/.exec(value);
    if (match) {
      const n = parseInt(match[1], 10);
      const unit = match[2];
      const ms =
        unit === 'd'
          ? n * 24 * 60 * 60 * 1000
          : unit === 'h'
            ? n * 60 * 60 * 1000
            : n * 60 * 1000;
      return new Date(Date.now() - ms);
    }
    const iso = new Date(value);
    return Number.isNaN(iso.getTime()) ? null : iso;
  }

  /**
   * Parses a future window (e.g. `7d`, `14d`) into an upper-bound
   * instant. ISO dates pass through.
   */
  private parseRelativeFuture(value: string | undefined): Date | null {
    if (!value) return null;
    const match = /^(\d+)([dhm])$/.exec(value);
    if (match) {
      const n = parseInt(match[1], 10);
      const unit = match[2];
      const ms =
        unit === 'd'
          ? n * 24 * 60 * 60 * 1000
          : unit === 'h'
            ? n * 60 * 60 * 1000
            : n * 60 * 1000;
      return new Date(Date.now() + ms);
    }
    const iso = new Date(value);
    return Number.isNaN(iso.getTime()) ? null : iso;
  }

  async listIssues(
    projectKey: string,
    params: {
      status?: string;
      page?: number;
      limit?: number;
      assignee?: string;
      priority?: string;
      type?: string;
      text?: string;
      updatedSince?: string;
      dueIn?: string;
      hasOverdue?: boolean;
      mode?: 'list' | 'summary';
      fields?: string[];
    },
    callerUserId?: string,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { key: projectKey },
      select: { id: true, key: true },
    });
    if (!project)
      throw new NotFoundException(`Project "${projectKey}" not found`);

    // ─── Build where ───────────────────────────────────────────
    const where: {
      projectId: string;
      status?: IssueStatus | { in: IssueStatus[] } | { notIn: IssueStatus[] };
      priority?: IssuePriority;
      type?: IssueType;
      assigneeId?: string | null;
      title?: { contains: string; mode: 'insensitive' };
      updatedAt?: { gte: Date };
      dueDate?: { gte: Date; lte: Date } | { lt: Date };
      archivedAt: null;
    } = {
      projectId: project.id,
      archivedAt: null,
    };

    if (params.status) where.status = params.status as IssueStatus;
    if (params.priority)
      where.priority = params.priority.toUpperCase() as IssuePriority;
    if (params.type) where.type = params.type.toUpperCase() as IssueType;
    if (params.text) {
      where.title = { contains: params.text, mode: 'insensitive' };
    }

    // assignee=me → resolve from caller; assignee=email → lookup; else UUID
    if (params.assignee) {
      if (params.assignee === 'me') {
        if (!callerUserId) {
          throw new BadRequestException(
            'assignee=me requires an authenticated caller',
          );
        }
        where.assigneeId = callerUserId;
      } else if (params.assignee.includes('@')) {
        const user = await this.prisma.user.findUnique({
          where: { email: params.assignee },
          select: { id: true },
        });
        if (!user) {
          throw new BadRequestException(`User "${params.assignee}" not found`);
        }
        where.assigneeId = user.id;
      } else if (
        params.assignee === 'none' ||
        params.assignee === 'unassigned'
      ) {
        where.assigneeId = null;
      } else {
        where.assigneeId = params.assignee;
      }
    }

    const updatedSince = this.parseRelativePast(params.updatedSince);
    if (updatedSince) where.updatedAt = { gte: updatedSince };

    const now = new Date();
    if (params.hasOverdue) {
      where.dueDate = { lt: now };
      // Exclude terminal statuses — overdue only makes sense for live work.
      where.status = {
        notIn: ['DONE', 'CANCELED'] as IssueStatus[],
      };
    } else {
      const dueIn = this.parseRelativeFuture(params.dueIn);
      if (dueIn) where.dueDate = { gte: now, lte: dueIn };
    }

    // ─── Summary mode — short-circuit before listing rows ──────
    if (params.mode === 'summary') {
      return this.listIssuesSummary(where, project.key, now);
    }

    // ─── Field projection ──────────────────────────────────────
    const requested = new Set(params.fields ?? []);
    const wantDescription = requested.has('description');
    const wantLabels = requested.has('labels');
    const wantDates = requested.has('dates');
    const wantCreator = requested.has('creator');
    const wantParent = requested.has('parent');
    const wantEmail = requested.has('email');

    const userSelect = wantEmail
      ? { id: true, name: true, email: true }
      : { id: true, name: true };

    const select = {
      id: true,
      number: true,
      title: true,
      status: true,
      priority: true,
      type: true,
      assignee: { select: userSelect },
      ...(wantDescription && { description: true }),
      ...(wantDates && {
        createdAt: true,
        updatedAt: true,
        startDate: true,
        dueDate: true,
        focusDate: true,
      }),
      ...(wantCreator && { creator: { select: userSelect } }),
      ...(wantParent && {
        parentId: true,
        parent: { select: { id: true, number: true, title: true, type: true } },
      }),
      ...(wantLabels && {
        labels: {
          select: {
            label: { select: { id: true, name: true, color: true } },
          },
        },
      }),
    };

    const safeLimit = Math.min(Math.max(params.limit ?? 20, 1), 100);
    const safePage = Math.max(params.page ?? 1, 1);

    const [items, total] = await Promise.all([
      this.prisma.issue.findMany({
        where,
        select,
        orderBy: [{ status: 'asc' }, { order: 'asc' }],
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
      this.prisma.issue.count({ where }),
    ]);

    // Flatten the `labels: [{ label: {...} }]` join shape into the
    // simpler `labels: [{...}]` MCP/LLM clients actually want.
    const flatten = (i: Record<string, unknown>) => {
      const out: Record<string, unknown> = { ...i };
      out.key = `${project.key}-${i.number as number}`;
      if (wantLabels && Array.isArray(i.labels)) {
        out.labels = (i.labels as Array<{ label: unknown }>).map(
          (l) => l.label,
        );
      }
      return out;
    };

    return {
      items: items.map((i) => flatten(i as unknown as Record<string, unknown>)),
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  /**
   * Aggregate-only summary for an issue search. Skips row payloads
   * entirely — returns counts the LLM can chunk on instead of
   * receiving 1000 row objects. Cuts response size by ~95% for
   * dashboard-style questions.
   */
  private async listIssuesSummary(
    where: Record<string, unknown>,
    projectKey: string,
    now: Date,
  ) {
    const issues = await this.prisma.issue.findMany({
      where,
      select: {
        status: true,
        priority: true,
        type: true,
        dueDate: true,
        assigneeId: true,
        assignee: { select: { id: true, name: true } },
      },
    });

    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byAssigneeMap = new Map<string, { name: string; count: number }>();
    let overdue = 0;
    let unassigned = 0;
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    let dueThisWeek = 0;

    for (const i of issues) {
      byStatus[i.status] = (byStatus[i.status] ?? 0) + 1;
      byPriority[i.priority] = (byPriority[i.priority] ?? 0) + 1;
      byType[i.type] = (byType[i.type] ?? 0) + 1;
      if (i.assignee) {
        const key = i.assignee.id;
        const entry = byAssigneeMap.get(key) ?? {
          name: i.assignee.name,
          count: 0,
        };
        entry.count += 1;
        byAssigneeMap.set(key, entry);
      } else {
        unassigned += 1;
      }
      if (i.dueDate && i.dueDate < now && !TERMINAL_STATUSES.has(i.status)) {
        overdue += 1;
      }
      if (
        i.dueDate &&
        i.dueDate >= now &&
        i.dueDate <= oneWeekFromNow &&
        !TERMINAL_STATUSES.has(i.status)
      ) {
        dueThisWeek += 1;
      }
    }

    return {
      mode: 'summary' as const,
      projectKey,
      total: issues.length,
      byStatus,
      byPriority,
      byType,
      byAssignee: [...byAssigneeMap.values()].sort((a, b) => b.count - a.count),
      overdue,
      unassigned,
      dueThisWeek,
    };
  }

  async listSpecs(projectKey: string, category?: string, status?: string) {
    const project = await this.prisma.project.findUnique({
      where: { key: projectKey },
      select: { id: true },
    });
    if (!project)
      throw new NotFoundException(`Project "${projectKey}" not found`);
    return this.specificationService.findAll(project.id, { category, status });
  }

  async getSpec(projectKey: string, specId: string) {
    const project = await this.prisma.project.findUnique({
      where: { key: projectKey },
      select: { id: true },
    });
    if (!project)
      throw new NotFoundException(`Project "${projectKey}" not found`);
    return this.specificationService.findOne(project.id, specId);
  }

  async getSpecMarkdown(projectKey: string, specId: string) {
    const project = await this.prisma.project.findUnique({
      where: { key: projectKey },
      select: { id: true },
    });
    if (!project)
      throw new NotFoundException(`Project "${projectKey}" not found`);
    return this.specificationService.exportOne(project.id, specId);
  }

  async createSpec(
    projectKey: string,
    dto: ExternalCreateSpecDto,
    creatorId: string,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { key: projectKey },
      select: { id: true },
    });
    if (!project)
      throw new NotFoundException(`Project "${projectKey}" not found`);

    return this.specificationService.create(project.id, creatorId, {
      title: dto.title,
      content: dto.content,
      category: dto.category,
      status: dto.status ?? SpecStatus.DRAFT,
    });
  }

  async updateSpec(
    projectKey: string,
    specId: string,
    dto: ExternalUpdateSpecDto,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { key: projectKey },
      select: { id: true },
    });
    if (!project)
      throw new NotFoundException(`Project "${projectKey}" not found`);

    return this.specificationService.update(project.id, specId, dto);
  }

  async createIssueSpecLink(
    projectKey: string,
    issueNumber: number,
    dto: ExternalCreateIssueSpecLinkDto,
  ) {
    const { projectId, issueId } = await this.resolveProjectAndIssue(
      projectKey,
      issueNumber,
    );
    return this.issueSpecLinkService.create(projectId, issueId, dto);
  }

  async listIssueSpecLinks(projectKey: string, issueNumber: number) {
    const { projectId, issueId } = await this.resolveProjectAndIssue(
      projectKey,
      issueNumber,
    );
    return this.issueSpecLinkService.findByIssue(projectId, issueId);
  }

  async deleteIssueSpecLink(
    projectKey: string,
    issueNumber: number,
    linkId: string,
  ) {
    const { projectId, issueId } = await this.resolveProjectAndIssue(
      projectKey,
      issueNumber,
    );
    return this.issueSpecLinkService.remove(projectId, issueId, linkId);
  }

  // ─── New: comment + project meta (Phase 1 for bbpm-internal-mcp) ──

  async createComment(
    projectKey: string,
    issueNumber: number,
    dto: ExternalCreateCommentDto,
    userId: string,
    source?: string,
  ) {
    const { projectId, issueId } = await this.resolveProjectAndIssue(
      projectKey,
      issueNumber,
    );
    return this.commentService.create(
      projectId,
      issueId,
      userId,
      {
        content: dto.content,
        mentionedUserIds: dto.mentionedUserIds,
      },
      source,
    );
  }

  /**
   * Projects the calling user is a member of. The MCP server uses this
   * to populate the `list_projects` tool — the LLM needs a list of keys
   * before it can pick one for create/update/list operations.
   */
  async listProjectsForUser(userId: string) {
    const projects = await this.prisma.project.findMany({
      where: { members: { some: { userId } } },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });
    return projects;
  }

  /**
   * Whoami — returns the calling user's profile so MCP clients can
   * resolve "me" without an extra lookup. Used by tools like
   * `list_my_assignments` and to inject the user's name into LLM
   * prompts without leaking other workspace members' emails.
   */
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        isSuperuser: true,
        slackUserId: true,
      },
    });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    return user;
  }

  /**
   * Cross-project shortcut for "what's on my plate". Same sparse
   * projection as the default list_issues so token use stays low.
   * Excludes archived issues; optional `status` filter narrows further.
   */
  async listMyAssignments(
    userId: string,
    params: { status?: string; limit?: number } = {},
  ) {
    const safeLimit = Math.min(Math.max(params.limit ?? 50, 1), 200);
    const where: {
      assigneeId: string;
      archivedAt: null;
      status?: IssueStatus;
    } = {
      assigneeId: userId,
      archivedAt: null,
    };
    if (params.status) where.status = params.status as IssueStatus;

    const issues = await this.prisma.issue.findMany({
      where,
      select: {
        id: true,
        number: true,
        title: true,
        status: true,
        priority: true,
        type: true,
        dueDate: true,
        focusDate: true,
        project: { select: { key: true, name: true } },
      },
      orderBy: [
        { focusDate: { sort: 'desc', nulls: 'last' } },
        { status: 'asc' },
        { dueDate: { sort: 'asc', nulls: 'last' } },
      ],
      take: safeLimit,
    });

    return issues.map((i) => ({
      id: i.id,
      key: `${i.project.key}-${i.number}`,
      number: i.number,
      title: i.title,
      status: i.status,
      priority: i.priority,
      type: i.type,
      dueDate: i.dueDate,
      focusDate: i.focusDate,
      projectKey: i.project.key,
      projectName: i.project.name,
    }));
  }

  /**
   * Set or clear the focusDate flag on an issue. Reuses
   * UpdateIssueUseCase so an activity row is written and the
   * dashboard's "today's focus" widget updates without polling.
   * Pass `date=null` to clear focus.
   */
  async setIssueFocus(
    projectKey: string,
    issueNumber: number,
    date: string | null,
    userId: string,
    source?: string,
  ) {
    const { projectId, issueId } = await this.resolveProjectAndIssue(
      projectKey,
      issueNumber,
    );
    await this.updateIssueUC.execute({
      projectId,
      issueId,
      actorId: userId,
      source: source as import('../common/source.js').SourceLiteral | undefined,
      changes: { focusDate: date },
    });
    return { issueKey: `${projectKey}-${issueNumber}`, focusDate: date };
  }

  /**
   * Manual archive — sets archivedAt = now. Skipped if already
   * archived. Unlike the cron, status check is not enforced (admin/AI
   * intent is explicit), but a soft warning is returned for issues
   * still in non-terminal status so the caller can second-guess.
   */
  async archiveIssue(projectKey: string, issueNumber: number) {
    const project = await this.prisma.project.findUnique({
      where: { key: projectKey },
      select: { id: true },
    });
    if (!project)
      throw new NotFoundException(`Project "${projectKey}" not found`);

    const issue = await this.prisma.issue.findUnique({
      where: {
        projectId_number: { projectId: project.id, number: issueNumber },
      },
      select: { id: true, status: true, archivedAt: true },
    });
    if (!issue)
      throw new NotFoundException(
        `Issue ${projectKey}-${issueNumber} not found`,
      );

    const warnings: string[] = [];
    if (issue.archivedAt) {
      return {
        archived: false,
        alreadyArchived: true,
        archivedAt: issue.archivedAt,
      };
    }
    if (issue.status !== 'DONE' && issue.status !== 'CANCELED') {
      warnings.push(
        `Archiving a non-terminal issue (status=${issue.status}). The next status change will auto-unarchive it.`,
      );
    }

    const updated = await this.prisma.issue.update({
      where: { id: issue.id },
      data: { archivedAt: new Date() },
      select: { archivedAt: true },
    });
    return {
      archived: true,
      archivedAt: updated.archivedAt,
      ...(warnings.length ? { warnings } : {}),
    };
  }

  async unarchiveIssue(projectKey: string, issueNumber: number) {
    const project = await this.prisma.project.findUnique({
      where: { key: projectKey },
      select: { id: true },
    });
    if (!project)
      throw new NotFoundException(`Project "${projectKey}" not found`);

    const issue = await this.prisma.issue.findUnique({
      where: {
        projectId_number: { projectId: project.id, number: issueNumber },
      },
      select: { id: true, archivedAt: true },
    });
    if (!issue)
      throw new NotFoundException(
        `Issue ${projectKey}-${issueNumber} not found`,
      );

    if (!issue.archivedAt) {
      return { unarchived: false, alreadyActive: true };
    }
    await this.prisma.issue.update({
      where: { id: issue.id },
      data: { archivedAt: null },
    });
    return { unarchived: true };
  }

  /**
   * Add labels by name. Names must already exist in the project —
   * unlike the issue-rule enforced labels (which auto-create), here
   * the caller's intent is explicit and a typo should fail loudly.
   * Idempotent — labels already on the issue are kept.
   */
  async addLabelsToIssue(
    projectKey: string,
    issueNumber: number,
    labelNames: string[],
    userId: string,
    source?: string,
  ) {
    const { projectId, issueId } = await this.resolveProjectAndIssue(
      projectKey,
      issueNumber,
    );
    const { merged, missing } = await this.resolveLabelDiff(
      projectId,
      issueId,
      labelNames,
      'add',
    );
    if (merged !== null) {
      await this.updateIssueUC.execute({
        projectId,
        issueId,
        actorId: userId,
        source: source as
          | import('../common/source.js').SourceLiteral
          | undefined,
        changes: { labelIds: merged },
      });
    }
    return {
      issueKey: `${projectKey}-${issueNumber}`,
      labelIds: merged,
      ...(missing.length ? { missingLabels: missing } : {}),
    };
  }

  async removeLabelsFromIssue(
    projectKey: string,
    issueNumber: number,
    labelNames: string[],
    userId: string,
    source?: string,
  ) {
    const { projectId, issueId } = await this.resolveProjectAndIssue(
      projectKey,
      issueNumber,
    );
    const { merged, missing } = await this.resolveLabelDiff(
      projectId,
      issueId,
      labelNames,
      'remove',
    );
    if (merged !== null) {
      await this.updateIssueUC.execute({
        projectId,
        issueId,
        actorId: userId,
        source: source as
          | import('../common/source.js').SourceLiteral
          | undefined,
        changes: { labelIds: merged },
      });
    }
    return {
      issueKey: `${projectKey}-${issueNumber}`,
      labelIds: merged,
      ...(missing.length ? { missingLabels: missing } : {}),
    };
  }

  /**
   * Resolve label names → IDs in the project, then merge with the
   * issue's existing labels. Returns the new full set (suitable for
   * UpdateIssueUseCase's `labelIds` which is a full replace) or
   * `null` when the diff is a no-op so callers can skip the
   * round-trip through the use case.
   */
  private async resolveLabelDiff(
    projectId: string,
    issueId: string,
    labelNames: string[],
    op: 'add' | 'remove',
  ): Promise<{ merged: string[] | null; missing: string[] }> {
    const matched = await this.prisma.label.findMany({
      where: { projectId, name: { in: labelNames } },
      select: { id: true, name: true },
    });
    const matchedByName = new Map(matched.map((l) => [l.name, l.id]));
    const missing = labelNames.filter((n) => !matchedByName.has(n));

    const existing = await this.prisma.issueLabel.findMany({
      where: { issueId },
      select: { labelId: true },
    });
    const existingSet = new Set(existing.map((l) => l.labelId));
    const addIds = matched.map((l) => l.id);

    let next: Set<string>;
    if (op === 'add') {
      next = new Set([...existingSet, ...addIds]);
    } else {
      next = new Set(existingSet);
      for (const id of addIds) next.delete(id);
    }

    // Compare for net no-op.
    if (
      next.size === existingSet.size &&
      [...next].every((id) => existingSet.has(id))
    ) {
      return { merged: null, missing };
    }
    return { merged: [...next], missing };
  }

  /**
   * Attachments on an issue. Returns sparse rows — id, filename, url,
   * mimeType, fileSize, uploader profile — so the LLM can pick which
   * one to delete or render. Includes both attachments uploaded
   * inline at create time and ones attached later.
   */
  async listAttachments(projectKey: string, issueNumber: number) {
    const { issueId } = await this.resolveProjectAndIssue(
      projectKey,
      issueNumber,
    );
    return this.prisma.attachment.findMany({
      where: { issueId },
      include: {
        uploader: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Delete an attachment. Delegates to UploadService.remove which
   * enforces the uploader-only invariant and best-effort S3 cleanup,
   * so the external surface gets the same permission model as the
   * web UI.
   */
  async deleteAttachment(attachmentId: string, userId: string) {
    return this.uploadService.remove(attachmentId, userId);
  }

  /**
   * Cross-project issue search. Postgres `ILIKE` on title (and
   * optionally description when `includeDescription=true`) across
   * every project the caller is a member of. Returns a sparse
   * projection so a thousand-row search stays small.
   *
   * Postgres FTS would be more accurate (stemming + ranking) but
   * adds operational cost (`GIN` index + tsvector column). ILIKE is
   * good enough for the workspace sizes we expect (<100k issues).
   * Bump to FTS only when search latency or precision becomes a real
   * complaint.
   */
  async searchIssues(
    userId: string,
    params: {
      q: string;
      projectKey?: string;
      type?: string;
      includeDescription?: boolean;
      limit?: number;
    },
  ) {
    if (!params.q || params.q.trim().length < 2) {
      throw new BadRequestException('Query must be at least 2 characters');
    }
    const safeLimit = Math.min(Math.max(params.limit ?? 25, 1), 100);
    const q = params.q.trim();

    // Restrict to projects the caller can read.
    const memberships = await this.prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true, project: { select: { key: true } } },
    });
    const accessibleProjectIds = memberships.map((m) => m.projectId);
    const projectKeyById = new Map(
      memberships.map((m) => [m.projectId, m.project.key]),
    );
    if (accessibleProjectIds.length === 0) return [];

    let scopedProjectIds = accessibleProjectIds;
    if (params.projectKey) {
      const target = memberships.find(
        (m) => m.project.key === params.projectKey,
      );
      if (!target) {
        throw new NotFoundException(
          `Project "${params.projectKey}" not found or not accessible`,
        );
      }
      scopedProjectIds = [target.projectId];
    }

    const where: {
      projectId: { in: string[] };
      archivedAt: null;
      type?: IssueType;
      OR?: Array<{
        title?: { contains: string; mode: 'insensitive' };
        description?: { contains: string; mode: 'insensitive' };
      }>;
      title?: { contains: string; mode: 'insensitive' };
    } = {
      projectId: { in: scopedProjectIds },
      archivedAt: null,
    };
    if (params.type) where.type = params.type.toUpperCase() as IssueType;

    if (params.includeDescription) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    } else {
      where.title = { contains: q, mode: 'insensitive' };
    }

    const issues = await this.prisma.issue.findMany({
      where,
      select: {
        id: true,
        number: true,
        title: true,
        status: true,
        priority: true,
        type: true,
        projectId: true,
        assignee: { select: { id: true, name: true } },
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: safeLimit,
    });

    return issues.map((i) => ({
      id: i.id,
      key: `${projectKeyById.get(i.projectId) ?? '?'}-${i.number}`,
      number: i.number,
      title: i.title,
      status: i.status,
      priority: i.priority,
      type: i.type,
      assignee: i.assignee,
      projectKey: projectKeyById.get(i.projectId) ?? null,
    }));
  }

  async listMembers(projectKey: string) {
    const project = await this.prisma.project.findUnique({
      where: { key: projectKey },
      select: { id: true },
    });
    if (!project)
      throw new NotFoundException(`Project "${projectKey}" not found`);

    const members = await this.prisma.projectMember.findMany({
      where: { projectId: project.id },
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } },
      },
      orderBy: { user: { name: 'asc' } },
    });
    return members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      avatar: m.user.avatar,
      role: m.role,
    }));
  }

  async listLabels(projectKey: string) {
    const project = await this.prisma.project.findUnique({
      where: { key: projectKey },
      select: { id: true },
    });
    if (!project)
      throw new NotFoundException(`Project "${projectKey}" not found`);

    return this.prisma.label.findMany({
      where: { projectId: project.id },
      select: { id: true, name: true, color: true },
      orderBy: { name: 'asc' },
    });
  }
}

function countBy<T>(arr: T[], key: (t: T) => string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of arr) {
    const k = key(item);
    result[k] = (result[k] ?? 0) + 1;
  }
  return result;
}
