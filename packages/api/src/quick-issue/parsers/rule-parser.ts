import { IssuePriority, IssueType } from '../../../generated/prisma/enums.js';

export interface RuleParseResult {
  projectKey: string | null;
  cleanedText: string;
  hints: {
    type?: IssueType;
    priority?: IssuePriority;
    assigneeHint?: string;
  };
}

const BUG_KEYWORDS =
  /\b(bug|버그|오류|error|에러|깨짐|안됨|안되|안 됨|안 되|crash|fix)\b/i;
const HIGH_PRIORITY_KEYWORDS =
  /\b(긴급|urgent|critical|핫픽스|hotfix|asap|즉시|심각|blocker)\b/i;
const LOW_PRIORITY_KEYWORDS =
  /\b(낮음|low|나중에|여유|언제든|minor|trivial)\b/i;
const PROJECT_KEY_PATTERN = /^([A-Z][A-Z0-9_]{1,9})\b/;
const ASSIGNEE_PATTERN = /@(\S+)/;

export function parseText(text: string): RuleParseResult {
  let cleaned = text.trim();
  let projectKey: string | null = null;

  // Extract project key from the beginning
  const keyMatch = cleaned.match(PROJECT_KEY_PATTERN);
  if (keyMatch) {
    projectKey = keyMatch[1];
    cleaned = cleaned.slice(keyMatch[0].length).trim();
  }

  // Extract assignee hint
  let assigneeHint: string | undefined;
  const assigneeMatch = cleaned.match(ASSIGNEE_PATTERN);
  if (assigneeMatch) {
    assigneeHint = assigneeMatch[1];
    cleaned = cleaned.replace(ASSIGNEE_PATTERN, '').trim();
  }

  // Detect type
  let type: IssueType | undefined;
  if (BUG_KEYWORDS.test(cleaned)) {
    type = IssueType.BUG;
  }

  // Detect priority
  let priority: IssuePriority | undefined;
  if (HIGH_PRIORITY_KEYWORDS.test(cleaned)) {
    priority = IssuePriority.HIGH;
  } else if (LOW_PRIORITY_KEYWORDS.test(cleaned)) {
    priority = IssuePriority.LOW;
  }

  return {
    projectKey,
    cleanedText: cleaned,
    hints: { type, priority, assigneeHint },
  };
}
