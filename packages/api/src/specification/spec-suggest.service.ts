import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  AI_COMPLETION_PORT,
  type AiCompletionPort,
} from '../common/ports/ai-completion.port.js';

const SYSTEM_PROMPT = `You extract trackable requirement items from a Korean/English software specification document.

OUTPUT: Strict JSON, no markdown fences, no commentary.
Shape: { "items": [{ "text": string, "sectionTitle"?: string }] }

RULES:
- Each item is one independently verifiable requirement (a single user-facing behaviour, API contract, or acceptance criterion).
- Skip example snippets, code blocks, "FAQ"-style prose, and meta-sections like "References" or "Out of scope".
- Skip items already present as a markdown checkbox (\`- [ ]\` / \`- [x]\`).
- Keep each text under 200 chars; concrete and imperative ("Login form validates email format" not "form validation").
- 'sectionTitle' should mirror the nearest H2/H3 heading verbatim (or omit if at the top of the doc).
- Return at most 30 items. If the doc is short, return fewer.`;

interface SuggestedItem {
  text: string;
  sectionTitle?: string;
}

interface CacheEntry {
  expiresAt: number;
  items: SuggestedItem[];
}

const CACHE_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class SpecSuggestService {
  // In-memory cache to short-circuit repeated calls for the same spec.
  // Keyed by `${specId}:<content-hash>`; spec content rarely changes within
  // a 10-minute window, so this hides a chunk of token cost.
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private prisma: PrismaService,
    @Inject(AI_COMPLETION_PORT) private ai: AiCompletionPort,
  ) {}

  async suggestItems(projectId: string, specId: string): Promise<SuggestedItem[]> {
    if (!this.ai.isConfigured()) {
      throw new ServiceUnavailableException(
        'AI suggestion is not configured on this server.',
      );
    }

    const spec = await this.prisma.specification.findUnique({
      where: { id: specId },
      select: { id: true, projectId: true, content: true, title: true },
    });
    if (!spec || spec.projectId !== projectId) {
      throw new NotFoundException('Specification not found');
    }

    const cacheKey = `${specId}:${cheapHash(spec.content)}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.items;
    }

    const userMessage = buildUserMessage(spec.title, spec.content);
    const raw = await this.ai.complete({
      systemPrompt: SYSTEM_PROMPT,
      userMessage,
      maxTokens: 2048,
    });
    if (!raw) {
      throw new ServiceUnavailableException(
        'AI suggestion failed — please try again later.',
      );
    }

    const items = parseLlmJsonItems(raw);
    if (!items) {
      throw new BadRequestException('AI returned an unparseable response.');
    }

    this.cache.set(cacheKey, {
      items,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return items;
  }
}

function buildUserMessage(title: string, content: string): string {
  // Truncate to ~16k chars to stay safely within token budget for typical specs.
  const trimmed = content.length > 16000 ? `${content.slice(0, 16000)}\n... [truncated]` : content;
  return `Specification title: ${title}\n\n=== BEGIN MARKDOWN ===\n${trimmed}\n=== END MARKDOWN ===`;
}

function parseLlmJsonItems(raw: string): SuggestedItem[] | null {
  // Strip markdown fences if the model snuck them in despite the system prompt.
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed || !Array.isArray(parsed.items)) return null;
    return parsed.items
      .filter(
        (it: unknown): it is { text: string; sectionTitle?: string } =>
          typeof it === 'object' &&
          it !== null &&
          typeof (it as { text?: unknown }).text === 'string' &&
          (it as { text: string }).text.trim().length > 0,
      )
      .map((it: { text: string; sectionTitle?: string }) => ({
        text: it.text.trim().slice(0, 200),
        sectionTitle: it.sectionTitle?.trim().slice(0, 200) || undefined,
      }))
      .slice(0, 30);
  } catch {
    return null;
  }
}

function cheapHash(s: string): string {
  // Non-crypto hash — only needs to invalidate the cache when content changes.
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}
