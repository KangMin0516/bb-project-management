/* eslint-disable @typescript-eslint/no-unsafe-assignment,
                   @typescript-eslint/no-unsafe-member-access */
import { describe, expect, it, jest } from '@jest/globals';
import type { WebClient } from '@slack/web-api';
import { EncryptionService } from '../../common/encryption.service.js';
import type { MessageBlock } from '../../common/ports/messaging.port.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SlackAdapter } from './slack.adapter.js';

// ─── Test doubles ────────────────────────────────────────────────

interface FakeClient {
  conversations: {
    open: jest.Mock<Promise<{ channel?: { id?: string } }>, [unknown]>;
  };
  chat: {
    postMessage: jest.Mock<Promise<unknown>, [unknown]>;
  };
}

function makeFakeClient(overrides: Partial<FakeClient> = {}): FakeClient {
  return {
    conversations: {
      open: jest.fn().mockResolvedValue({ channel: { id: 'D1' } }),
      ...overrides.conversations,
    },
    chat: {
      postMessage: jest.fn().mockResolvedValue({ ok: true }),
      ...overrides.chat,
    },
  };
}

function makePrisma(integration: unknown): PrismaService {
  return {
    slackIntegration: {
      findFirst: jest.fn().mockResolvedValue(integration),
      findUnique: jest.fn().mockResolvedValue(integration),
    },
  } as unknown as PrismaService;
}

function makeEncryption(): EncryptionService {
  return {
    decrypt: jest.fn((t: string) => `decrypted:${t}`),
    encrypt: jest.fn((t: string) => `encrypted:${t}`),
  } as unknown as EncryptionService;
}

/**
 * Subclass that swaps the WebClient construction with whatever the test
 * provides. Subclassing is cheaper than mocking the entire `@slack/web-api`
 * module under ESM-Jest, and it keeps the adapter's real retry / mapper
 * logic on the hot path.
 */
class TestableSlackAdapter extends SlackAdapter {
  constructor(
    prisma: PrismaService,
    encryption: EncryptionService,
    private readonly fakeClient: WebClient,
  ) {
    super(prisma, encryption);
  }
  protected override clientFor(): WebClient {
    return this.fakeClient;
  }
}

const SAMPLE_BLOCKS: MessageBlock[] = [
  { type: 'header', text: 'Hi' },
  { type: 'section', text: 'body' },
];

// ─── getWorkspaceStatus ──────────────────────────────────────────

describe('SlackAdapter.getWorkspaceStatus', () => {
  it('returns disconnected when no integration exists', async () => {
    const adapter = new TestableSlackAdapter(
      makePrisma(null),
      makeEncryption(),
      makeFakeClient() as unknown as WebClient,
    );
    await expect(adapter.getWorkspaceStatus()).resolves.toEqual({
      connected: false,
    });
  });

  it('returns connected with id + name when an integration exists', async () => {
    const adapter = new TestableSlackAdapter(
      makePrisma({ id: 'INT1', teamName: 'Acme' }),
      makeEncryption(),
      makeFakeClient() as unknown as WebClient,
    );
    await expect(adapter.getWorkspaceStatus()).resolves.toEqual({
      connected: true,
      integrationId: 'INT1',
      teamName: 'Acme',
    });
  });
});

// ─── sendDirectMessage ──────────────────────────────────────────

describe('SlackAdapter.sendDirectMessage', () => {
  it('skips with reason "no_integration" when no workspace installed', async () => {
    const client = makeFakeClient();
    const adapter = new TestableSlackAdapter(
      makePrisma(null),
      makeEncryption(),
      client as unknown as WebClient,
    );

    const result = await adapter.sendDirectMessage('U1', 'hi', SAMPLE_BLOCKS);

    expect(result).toEqual({ delivered: false, reason: 'no_integration' });
    expect(client.chat.postMessage).not.toHaveBeenCalled();
  });

  it('opens DM channel then posts with translated blocks', async () => {
    const client = makeFakeClient();
    const adapter = new TestableSlackAdapter(
      makePrisma({ id: 'INT1', botToken: 'tok', teamName: 'Acme' }),
      makeEncryption(),
      client as unknown as WebClient,
    );

    const result = await adapter.sendDirectMessage('U1', 'hi', SAMPLE_BLOCKS);

    expect(result).toEqual({ delivered: true });
    expect(client.conversations.open).toHaveBeenCalledWith({ users: 'U1' });
    expect(client.chat.postMessage).toHaveBeenCalledTimes(1);
    const args = client.chat.postMessage.mock.calls[0][0] as {
      channel: string;
      text: string;
      blocks: unknown[];
    };
    expect(args.channel).toBe('D1');
    expect(args.text).toBe('hi');
    // Spot-check that mapper produced Slack Block Kit (not our neutral DTO)
    expect(args.blocks[0]).toMatchObject({
      type: 'header',
      text: { type: 'plain_text' },
    });
  });

  it('returns reason "unknown_error" when conversations.open throws (does not propagate)', async () => {
    const client = makeFakeClient({
      conversations: {
        open: jest.fn().mockRejectedValue(new Error('boom')),
      },
    });
    const adapter = new TestableSlackAdapter(
      makePrisma({ id: 'INT1', botToken: 'tok' }),
      makeEncryption(),
      client as unknown as WebClient,
    );

    const result = await adapter.sendDirectMessage('U1', 'hi', SAMPLE_BLOCKS);

    expect(result).toEqual({ delivered: false, reason: 'unknown_error' });
    expect(client.chat.postMessage).not.toHaveBeenCalled();
  });

  it('returns reason "no_recipient" when DM channel id is absent', async () => {
    const client = makeFakeClient({
      conversations: {
        open: jest.fn().mockResolvedValue({ channel: undefined }),
      },
    });
    const adapter = new TestableSlackAdapter(
      makePrisma({ id: 'INT1', botToken: 'tok' }),
      makeEncryption(),
      client as unknown as WebClient,
    );

    const result = await adapter.sendDirectMessage('U1', 'hi', SAMPLE_BLOCKS);

    expect(result).toEqual({ delivered: false, reason: 'no_recipient' });
  });

  it('never throws on postMessage failure — returns reason instead (best-effort DM)', async () => {
    const client = makeFakeClient({
      chat: { postMessage: jest.fn().mockRejectedValue(new Error('500')) },
    });
    const adapter = new TestableSlackAdapter(
      makePrisma({ id: 'INT1', botToken: 'tok' }),
      makeEncryption(),
      client as unknown as WebClient,
    );

    await expect(
      adapter.sendDirectMessage('U1', 'hi', SAMPLE_BLOCKS),
    ).resolves.toEqual({ delivered: false, reason: 'unknown_error' });
  });
});

// ─── sendChannelMessage ─────────────────────────────────────────

describe('SlackAdapter.sendChannelMessage', () => {
  it('throws NotFoundException when integration id does not resolve', async () => {
    const adapter = new TestableSlackAdapter(
      makePrisma(null),
      makeEncryption(),
      makeFakeClient() as unknown as WebClient,
    );

    await expect(
      adapter.sendChannelMessage('INT404', 'C1', 'hi', SAMPLE_BLOCKS),
    ).rejects.toThrow('Slack integration not found');
  });

  it('posts to the requested channel and returns when ok', async () => {
    const client = makeFakeClient();
    const adapter = new TestableSlackAdapter(
      makePrisma({ id: 'INT1', botToken: 'tok' }),
      makeEncryption(),
      client as unknown as WebClient,
    );

    await adapter.sendChannelMessage('INT1', 'C123', 'hi', SAMPLE_BLOCKS);

    expect(client.chat.postMessage).toHaveBeenCalledTimes(1);
    const args = client.chat.postMessage.mock.calls[0][0] as {
      channel: string;
    };
    expect(args.channel).toBe('C123');
  });

  it('throws (does NOT swallow) when channel post fails — contract message, not best-effort', async () => {
    const err = new Error('boom');
    const client = makeFakeClient({
      chat: { postMessage: jest.fn().mockRejectedValue(err) },
    });
    const adapter = new TestableSlackAdapter(
      makePrisma({ id: 'INT1', botToken: 'tok' }),
      makeEncryption(),
      client as unknown as WebClient,
    );

    await expect(
      adapter.sendChannelMessage('INT1', 'C1', 'hi', SAMPLE_BLOCKS),
    ).rejects.toBe(err);
  });
});
