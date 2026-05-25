import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateIssueUseCase } from '../issue/application/create-issue.use-case.js';
import {
  AI_COMPLETION_PORT,
  type AiCompletionPort,
} from '../common/ports/ai-completion.port.js';
import { parseText } from './parsers/rule-parser.js';
import { enrichWithLlm } from './parsers/llm-enricher.js';
import type { LlmEnrichResult } from './parsers/llm-enricher.js';
import {
  IssuePriority,
  IssueStatus,
  IssueType,
} from '../../generated/prisma/enums.js';

export interface ParsedIssue {
  projectId: string;
  projectKey: string;
  projectName: string;
  title: string;
  description: string;
  type: IssueType;
  priority: IssuePriority;
  status: IssueStatus;
  assigneeId?: string;
  assigneeName?: string;
}

export interface ParseResult {
  parsed?: ParsedIssue;
  needsProjectSelection: boolean;
  projectCandidates?: { id: string; key: string; name: string }[];
}

@Injectable()
export class QuickIssueService {
  private readonly logger = new Logger(QuickIssueService.name);

  constructor(
    private prisma: PrismaService,
    private createIssue: CreateIssueUseCase,
    @Inject(AI_COMPLETION_PORT) private ai: AiCompletionPort,
  ) {}

  async parse(
    text: string,
    userId: string,
    projectId?: string,
  ): Promise<ParseResult> {
    const parsed = parseText(text);

    // Get user's projects (active only — quick-issue should never
    // create issues in an archived project).
    const userProjects = await this.prisma.project.findMany({
      where: { members: { some: { userId } }, archivedAt: null },
      select: { id: true, key: true, name: true, description: true },
      orderBy: { name: 'asc' },
    });

    // Determine project
    let selectedProject: (typeof userProjects)[0] | undefined;

    if (projectId) {
      // Explicit project ID provided
      selectedProject = userProjects.find((p) => p.id === projectId);
    } else if (parsed.projectKey) {
      // Match by project key from text
      selectedProject = userProjects.find((p) => p.key === parsed.projectKey);
    }

    if (!selectedProject && userProjects.length === 1) {
      // Only one project — auto-select
      selectedProject = userProjects[0];
    }

    if (!selectedProject) {
      // Need project selection
      return {
        needsProjectSelection: true,
        projectCandidates: userProjects.map((p) => ({
          id: p.id,
          key: p.key,
          name: p.name,
        })),
      };
    }

    // Get project members for LLM context
    const members = await this.prisma.projectMember.findMany({
      where: { projectId: selectedProject.id },
      include: { user: { select: { id: true, name: true } } },
    });

    const memberList = members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
    }));

    let enriched: LlmEnrichResult;

    if (this.ai.isConfigured()) {
      enriched = await enrichWithLlm(
        this.ai,
        text,
        parsed,
        selectedProject,
        memberList,
      );
    } else {
      this.logger.warn('AI completion not configured, using rule-based only');
      enriched = {
        title: parsed.cleanedText,
        description: '',
        type: parsed.hints.type ?? IssueType.TASK,
        priority: parsed.hints.priority ?? IssuePriority.MEDIUM,
        status: IssueStatus.BACKLOG,
      };
    }

    // Validate assigneeId exists in project members (W4: prevent LLM hallucination)
    let assigneeName: string | undefined;
    if (enriched.assigneeId) {
      const assignee = memberList.find((m) => m.id === enriched.assigneeId);
      if (assignee) {
        assigneeName = assignee.name;
      } else {
        enriched.assigneeId = undefined;
      }
    }

    return {
      needsProjectSelection: false,
      parsed: {
        projectId: selectedProject.id,
        projectKey: selectedProject.key,
        projectName: selectedProject.name,
        title: enriched.title,
        description: enriched.description,
        type: enriched.type,
        priority: enriched.priority,
        status: enriched.status,
        assigneeId: enriched.assigneeId,
        assigneeName,
      },
    };
  }

  async create(
    data: {
      projectId: string;
      title: string;
      description?: string;
      type?: IssueType;
      priority?: IssuePriority;
      status?: IssueStatus;
      assigneeId?: string;
    },
    creatorId: string,
  ) {
    // Verify user is a member of the project
    const membership = await this.prisma.projectMember.findUnique({
      where: {
        userId_projectId: { userId: creatorId, projectId: data.projectId },
      },
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this project');
    }

    const issue = (await this.createIssue.execute({
      projectId: data.projectId,
      creatorId,
      title: data.title,
      description: data.description,
      type: data.type,
      priority: data.priority,
      status: data.status,
      assigneeId: data.assigneeId,
    })) as { id: string; number: number };

    // Get project key for issue URL
    const project = await this.prisma.project.findUnique({
      where: { id: data.projectId },
      select: { key: true },
    });

    return {
      issue,
      issueKey: `${project?.key}-${issue.number}`,
    };
  }
}
