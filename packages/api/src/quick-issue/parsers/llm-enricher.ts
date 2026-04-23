import { Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import {
  IssuePriority,
  IssueType,
  IssueStatus,
} from '../../../generated/prisma/enums.js';
import type { RuleParseResult } from './rule-parser.js';

export interface LlmEnrichResult {
  title: string;
  description: string;
  type: IssueType;
  priority: IssuePriority;
  status: IssueStatus;
  assigneeId?: string;
}

interface ProjectContext {
  name: string;
  key: string;
  description?: string | null;
}

interface MemberContext {
  id: string;
  name: string;
}

const logger = new Logger('LlmEnricher');

let cachedClient: Anthropic | null = null;
let cachedKey: string | null = null;

function getClient(apiKey: string): Anthropic {
  if (cachedClient && cachedKey === apiKey) return cachedClient;
  cachedClient = new Anthropic({ apiKey });
  cachedKey = apiKey;
  return cachedClient;
}

export async function enrichWithLlm(
  apiKey: string,
  rawText: string,
  parsed: RuleParseResult,
  project: ProjectContext,
  members: MemberContext[],
): Promise<LlmEnrichResult> {
  const client = getClient(apiKey);

  const memberList = members.map((m) => `- ${m.name} (ID: ${m.id})`).join('\n');

  const hintsDesc: string[] = [];
  if (parsed.hints.type) hintsDesc.push(`type 추론: ${parsed.hints.type}`);
  if (parsed.hints.priority)
    hintsDesc.push(`priority 추론: ${parsed.hints.priority}`);
  if (parsed.hints.assigneeHint)
    hintsDesc.push(`assignee 힌트: @${parsed.hints.assigneeHint}`);

  const systemPrompt = `You are a project management assistant that extracts structured issue fields from natural language text.

Project: ${project.name} (${project.key})${project.description ? ` - ${project.description}` : ''}

Team members:
${memberList || '(no members)'}

Available types: EPIC, TASK, BUG, SUB_TASK
Available priorities: HIGH, MEDIUM, LOW
Available statuses: BACKLOG, TODO

Rules:
- title: A concise issue title extracted from the text. Remove project keys, assignee mentions, and priority keywords. Keep the original language.
- description: A brief description if there's enough context, otherwise empty string.
- type: Default TASK unless the text mentions a bug, error, or issue (→ BUG).
- priority: Default MEDIUM unless urgency keywords are present.
- status: Default BACKLOG.
- assigneeId: Match the assignee hint to a team member by name if possible. Return the member's ID or null.

Respond with ONLY a JSON object, no markdown fences.`;

  const userMessage = `Text: "${rawText}"
${hintsDesc.length > 0 ? `Rule-based hints: ${hintsDesc.join(', ')}` : ''}

Extract issue fields as JSON: { "title": string, "description": string, "type": string, "priority": string, "status": string, "assigneeId": string | null }`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: userMessage }],
      system: systemPrompt,
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const result = JSON.parse(content.text) as {
      title: string;
      description: string;
      type: string;
      priority: string;
      status: string;
      assigneeId: string | null;
    };

    return {
      title: result.title || parsed.cleanedText,
      description: result.description || '',
      type: (Object.values(IssueType).includes(result.type as IssueType)
        ? result.type
        : (parsed.hints.type ?? IssueType.TASK)) as IssueType,
      priority: (Object.values(IssuePriority).includes(
        result.priority as IssuePriority,
      )
        ? result.priority
        : (parsed.hints.priority ?? IssuePriority.MEDIUM)) as IssuePriority,
      status: (Object.values(IssueStatus).includes(result.status as IssueStatus)
        ? result.status
        : IssueStatus.BACKLOG) as IssueStatus,
      assigneeId: result.assigneeId ?? undefined,
    };
  } catch (err) {
    logger.warn(
      'LLM enrichment failed, falling back to rule-based',
      err instanceof Error ? err.message : String(err),
    );

    // Fallback to rule-based only
    return {
      title: parsed.cleanedText,
      description: '',
      type: parsed.hints.type ?? IssueType.TASK,
      priority: parsed.hints.priority ?? IssuePriority.MEDIUM,
      status: IssueStatus.BACKLOG,
    };
  }
}
