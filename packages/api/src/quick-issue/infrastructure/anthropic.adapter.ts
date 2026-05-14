import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import type {
  AiCompletionPort,
  ChatCompletionRequest,
} from '../../common/ports/ai-completion.port.js';

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

/**
 * Anthropic Claude implementation of AiCompletionPort.
 *
 * Behaviour preserved from legacy llm-enricher.ts:
 *  - Uses claude-haiku-4-5 (cheapest, fastest) — see DEFAULT_MODEL
 *  - Single API key from ANTHROPIC_API_KEY env var
 *  - Single-shot user message + system prompt, no tools / streaming
 *  - All errors swallowed → returns null (caller falls back to rules)
 *
 * Lifecycle: client constructed lazily on first call so the adapter
 * is cheap to instantiate even when AI is unused (test env, dev box
 * without an API key). Production hits Anthropic on first quick-issue
 * call.
 */
@Injectable()
export class AnthropicAdapter implements AiCompletionPort {
  private readonly logger = new Logger(AnthropicAdapter.name);
  private readonly apiKey: string;
  // Lazily initialised on first use — see `getClient`.
  protected client: Anthropic | null = null;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('ANTHROPIC_API_KEY', '');
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async complete(request: ChatCompletionRequest): Promise<string | null> {
    if (!this.isConfigured()) return null;
    try {
      const client = this.getClient();
      const response = await client.messages.create({
        model: DEFAULT_MODEL,
        max_tokens: request.maxTokens,
        system: request.systemPrompt,
        messages: [{ role: 'user', content: request.userMessage }],
      });
      const content = response.content[0];
      if (content?.type !== 'text') {
        this.logger.warn(
          `Unexpected Anthropic response shape: ${content?.type ?? 'undefined'}`,
        );
        return null;
      }
      return content.text;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Anthropic completion failed: ${msg}`);
      return null;
    }
  }

  /**
   * Test seam — `protected` so unit tests can subclass and swap the
   * client. Matches the SlackAdapter `clientFor` / S3Adapter `s3`
   * pattern.
   */
  protected getClient(): Anthropic {
    if (!this.client) this.client = new Anthropic({ apiKey: this.apiKey });
    return this.client;
  }
}
