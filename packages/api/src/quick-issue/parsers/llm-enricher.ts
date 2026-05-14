import type { AiCompletionPort } from '../../common/ports/ai-completion.port.js';
import {
  IssuePriority,
  IssueStatus,
  IssueType,
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

/**
 * Enrich a rule-parsed quick-issue draft via an LLM call routed through
 * AiCompletionPort. When the port returns `null` (no API key, error,
 * unexpected shape), this function silently degrades to a rule-based
 * result — matching the legacy try/catch fallback behavior.
 */
export async function enrichWithLlm(
  ai: AiCompletionPort,
  rawText: string,
  parsed: RuleParseResult,
  project: ProjectContext,
  members: MemberContext[],
): Promise<LlmEnrichResult> {
  const ruleFallback = buildRuleFallback(parsed);
  if (!ai.isConfigured()) return ruleFallback;

  const memberList = members.map((m) => `- ${m.name} (ID: ${m.id})`).join('\n');

  const hintsDesc: string[] = [];
  if (parsed.hints.type) hintsDesc.push(`type hint: ${parsed.hints.type}`);
  if (parsed.hints.priority)
    hintsDesc.push(`priority hint: ${parsed.hints.priority}`);
  if (parsed.hints.assigneeHint)
    hintsDesc.push(`assignee hint: @${parsed.hints.assigneeHint}`);

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

  const text = await ai.complete({ systemPrompt, userMessage, maxTokens: 300 });
  if (!text) return ruleFallback;

  let parsedJson: {
    title: string;
    description: string;
    type: string;
    priority: string;
    status: string;
    assigneeId: string | null;
  };
  try {
    parsedJson = JSON.parse(text) as typeof parsedJson;
  } catch {
    return ruleFallback;
  }

  return {
    title: parsedJson.title || parsed.cleanedText,
    description: parsedJson.description || '',
    type: (Object.values(IssueType).includes(parsedJson.type as IssueType)
      ? parsedJson.type
      : (parsed.hints.type ?? IssueType.TASK)) as IssueType,
    priority: (Object.values(IssuePriority).includes(
      parsedJson.priority as IssuePriority,
    )
      ? parsedJson.priority
      : (parsed.hints.priority ?? IssuePriority.MEDIUM)) as IssuePriority,
    status: (Object.values(IssueStatus).includes(
      parsedJson.status as IssueStatus,
    )
      ? parsedJson.status
      : IssueStatus.BACKLOG) as IssueStatus,
    assigneeId: parsedJson.assigneeId ?? undefined,
  };
}

function buildRuleFallback(parsed: RuleParseResult): LlmEnrichResult {
  return {
    title: parsed.cleanedText,
    description: '',
    type: parsed.hints.type ?? IssueType.TASK,
    priority: parsed.hints.priority ?? IssuePriority.MEDIUM,
    status: IssueStatus.BACKLOG,
  };
}
