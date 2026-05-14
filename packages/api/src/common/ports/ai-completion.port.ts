/**
 * AiCompletionPort — neutral abstraction for single-shot LLM
 * completions used by the quick-issue parser.
 *
 * Default adapter targets Anthropic Claude. Future adapters (OpenAI,
 * local llama, etc.) implement the same surface. Consumers depend on
 * this interface, not `@anthropic-ai/sdk`.
 *
 * Scope intentionally narrow: only single-shot prompt → text response.
 * Streaming, tool use, multi-turn conversations are out of scope —
 * if they become a requirement, extend the port additively (don't
 * leak vendor types in).
 */

export const AI_COMPLETION_PORT = Symbol('AI_COMPLETION_PORT');

export interface ChatCompletionRequest {
  systemPrompt: string;
  userMessage: string;
  /** Hard cap on response tokens. Adapter enforces against the model's
   *  own limit. */
  maxTokens: number;
}

export interface AiCompletionPort {
  /** True when the adapter has an API key configured. Callers should
   *  check this and fall back to non-AI logic when false. */
  isConfigured(): boolean;

  /**
   * Run a single-shot completion. Returns the text response on
   * success, or `null` on any failure (auth, rate limit, network,
   * unexpected response shape). The adapter logs failures internally;
   * callers fall through to rule-based or default behavior.
   *
   * Never throws — keeping AI strictly best-effort means the caller
   * never has to wrap calls in try/catch.
   */
  complete(request: ChatCompletionRequest): Promise<string | null>;
}
