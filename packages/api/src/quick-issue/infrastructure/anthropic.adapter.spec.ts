import { describe, expect, it, jest } from '@jest/globals';
import type { ConfigService } from '@nestjs/config';
import type Anthropic from '@anthropic-ai/sdk';
import { AnthropicAdapter } from './anthropic.adapter.js';

function makeConfig(key = 'sk-test'): ConfigService {
  return { get: jest.fn(() => key) } as unknown as ConfigService;
}

interface FakeAnthropic {
  messages: { create: jest.Mock<Promise<unknown>, [unknown]> };
}

function makeFakeClient(
  createImpl?: (req: unknown) => Promise<unknown>,
): FakeAnthropic {
  return {
    messages: {
      create: jest.fn(
        createImpl ??
          (() => Promise.resolve({ content: [{ type: 'text', text: 'hi' }] })),
      ),
    },
  };
}

class TestableAnthropicAdapter extends AnthropicAdapter {
  constructor(config: ConfigService, fake: FakeAnthropic) {
    super(config);
    this.client = fake as unknown as Anthropic;
  }
}

describe('AnthropicAdapter.isConfigured', () => {
  it('returns true when ANTHROPIC_API_KEY is set', () => {
    const a = new TestableAnthropicAdapter(
      makeConfig('sk-1'),
      makeFakeClient(),
    );
    expect(a.isConfigured()).toBe(true);
  });

  it('returns false when API key is empty', () => {
    const a = new TestableAnthropicAdapter(makeConfig(''), makeFakeClient());
    expect(a.isConfigured()).toBe(false);
  });
});

describe('AnthropicAdapter.complete', () => {
  it('returns null without calling SDK when not configured', async () => {
    const fake = makeFakeClient();
    const a = new TestableAnthropicAdapter(makeConfig(''), fake);

    const result = await a.complete({
      systemPrompt: 'sys',
      userMessage: 'hi',
      maxTokens: 100,
    });

    expect(result).toBeNull();
    expect(fake.messages.create).not.toHaveBeenCalled();
  });

  it('returns text content on success', async () => {
    const fake = makeFakeClient(() =>
      Promise.resolve({ content: [{ type: 'text', text: 'response body' }] }),
    );
    const a = new TestableAnthropicAdapter(makeConfig(), fake);

    const result = await a.complete({
      systemPrompt: 'sys',
      userMessage: 'hi',
      maxTokens: 200,
    });

    expect(result).toBe('response body');
    const req = fake.messages.create.mock.calls[0][0] as {
      max_tokens: number;
      system: string;
      messages: Array<{ role: string; content: string }>;
    };
    expect(req.max_tokens).toBe(200);
    expect(req.system).toBe('sys');
    expect(req.messages[0]).toEqual({ role: 'user', content: 'hi' });
  });

  it('returns null when response has no text block', async () => {
    const fake = makeFakeClient(() =>
      Promise.resolve({ content: [{ type: 'tool_use' }] }),
    );
    const a = new TestableAnthropicAdapter(makeConfig(), fake);

    const result = await a.complete({
      systemPrompt: 's',
      userMessage: 'u',
      maxTokens: 100,
    });
    expect(result).toBeNull();
  });

  it('returns null (never throws) on SDK errors', async () => {
    const fake = makeFakeClient(() =>
      Promise.reject(new Error('rate_limit_error')),
    );
    const a = new TestableAnthropicAdapter(makeConfig(), fake);

    await expect(
      a.complete({ systemPrompt: 's', userMessage: 'u', maxTokens: 100 }),
    ).resolves.toBeNull();
  });

  it('returns null on empty content array', async () => {
    const fake = makeFakeClient(() => Promise.resolve({ content: [] }));
    const a = new TestableAnthropicAdapter(makeConfig(), fake);

    const result = await a.complete({
      systemPrompt: 's',
      userMessage: 'u',
      maxTokens: 100,
    });
    expect(result).toBeNull();
  });
});
