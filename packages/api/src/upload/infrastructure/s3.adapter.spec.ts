import { describe, expect, it, jest } from '@jest/globals';
import type { ConfigService } from '@nestjs/config';
import type { S3Client } from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import { S3Adapter } from './s3.adapter.js';

// ─── Test doubles ────────────────────────────────────────────────

function makeConfig(overrides: Record<string, string> = {}): ConfigService {
  const env = {
    AWS_S3_REGION: 'us-east-1',
    AWS_S3_BUCKET: 'my-bucket',
    AWS_ACCESS_KEY_ID: 'AKIA',
    AWS_SECRET_ACCESS_KEY: 'secret',
    ...overrides,
  };
  return {
    get: jest.fn((key: string, def?: string) => env[key] ?? def ?? ''),
  } as unknown as ConfigService;
}

interface FakeS3 {
  send: jest.Mock<Promise<unknown>, [unknown]>;
}

function makeFakeS3(sendImpl?: (cmd: unknown) => Promise<unknown>): FakeS3 {
  return {
    send: jest.fn(sendImpl ?? (() => Promise.resolve({}))),
  };
}

/** Subclass that injects a fake S3 client after construction. */
class TestableS3Adapter extends S3Adapter {
  constructor(config: ConfigService, fake: FakeS3) {
    super(config);
    this.s3 = fake as unknown as S3Client;
  }
}

// ─── isConfigured ────────────────────────────────────────────────

describe('S3Adapter.isConfigured', () => {
  it('returns true when AWS_S3_BUCKET is set', () => {
    const adapter = new TestableS3Adapter(makeConfig(), makeFakeS3());
    expect(adapter.isConfigured()).toBe(true);
  });

  it('returns false when AWS_S3_BUCKET is empty', () => {
    const adapter = new TestableS3Adapter(
      makeConfig({ AWS_S3_BUCKET: '' }),
      makeFakeS3(),
    );
    expect(adapter.isConfigured()).toBe(false);
  });
});

// ─── upload ──────────────────────────────────────────────────────

describe('S3Adapter.upload', () => {
  it('sends PutObjectCommand with bucket/key/body/contentType', async () => {
    const fake = makeFakeS3();
    const adapter = new TestableS3Adapter(makeConfig(), fake);

    await adapter.upload({
      key: 'avatars/u1.png',
      body: Buffer.from('hi'),
      contentType: 'image/png',
    });

    expect(fake.send).toHaveBeenCalledTimes(1);
    const cmd = fake.send.mock.calls[0][0] as {
      input: { Bucket: string; Key: string; ContentType: string };
    };
    expect(cmd.input.Bucket).toBe('my-bucket');
    expect(cmd.input.Key).toBe('avatars/u1.png');
    expect(cmd.input.ContentType).toBe('image/png');
  });

  it('returns the S3 URL with bucket + region', async () => {
    const adapter = new TestableS3Adapter(makeConfig(), makeFakeS3());

    const { url } = await adapter.upload({
      key: 'attachments/abc.pdf',
      body: Buffer.from('pdf'),
      contentType: 'application/pdf',
    });

    expect(url).toBe(
      'https://my-bucket.s3.us-east-1.amazonaws.com/attachments/abc.pdf',
    );
  });

  it('propagates S3 errors so caller sees the failure', async () => {
    const fake = makeFakeS3(() => Promise.reject(new Error('AccessDenied')));
    const adapter = new TestableS3Adapter(makeConfig(), fake);

    await expect(
      adapter.upload({
        key: 'k',
        body: Buffer.from(''),
        contentType: 'application/octet-stream',
      }),
    ).rejects.toThrow('AccessDenied');
  });
});

// ─── download ────────────────────────────────────────────────────

describe('S3Adapter.download', () => {
  it('returns { stream, contentType } on hit', async () => {
    const fakeStream = Readable.from(['payload']);
    const fake = makeFakeS3(() =>
      Promise.resolve({ Body: fakeStream, ContentType: 'image/png' }),
    );
    const adapter = new TestableS3Adapter(makeConfig(), fake);

    const result = await adapter.download('avatars/u1.png');

    expect(result).not.toBeNull();
    expect(result?.contentType).toBe('image/png');
    expect(result?.stream).toBe(fakeStream);
  });

  it('returns null on NoSuchKey (not an error)', async () => {
    const err = Object.assign(new Error('not found'), { name: 'NoSuchKey' });
    const fake = makeFakeS3(() => Promise.reject(err));
    const adapter = new TestableS3Adapter(makeConfig(), fake);

    await expect(adapter.download('missing')).resolves.toBeNull();
  });

  it('returns null on HTTP 404 metadata (alternate SDK error shape)', async () => {
    const err = Object.assign(new Error('not found'), {
      $metadata: { httpStatusCode: 404 },
    });
    const fake = makeFakeS3(() => Promise.reject(err));
    const adapter = new TestableS3Adapter(makeConfig(), fake);

    await expect(adapter.download('missing')).resolves.toBeNull();
  });

  it('defaults missing ContentType to application/octet-stream', async () => {
    const fake = makeFakeS3(() =>
      Promise.resolve({ Body: Readable.from([]), ContentType: undefined }),
    );
    const adapter = new TestableS3Adapter(makeConfig(), fake);

    const result = await adapter.download('k');
    expect(result?.contentType).toBe('application/octet-stream');
  });

  it('rethrows non-404 errors (AccessDenied etc.)', async () => {
    const fake = makeFakeS3(() => Promise.reject(new Error('AccessDenied')));
    const adapter = new TestableS3Adapter(makeConfig(), fake);

    await expect(adapter.download('k')).rejects.toThrow('AccessDenied');
  });
});

// ─── delete ──────────────────────────────────────────────────────

describe('S3Adapter.delete', () => {
  it('sends DeleteObjectCommand and resolves', async () => {
    const fake = makeFakeS3();
    const adapter = new TestableS3Adapter(makeConfig(), fake);

    await adapter.delete('attachments/x.pdf');

    expect(fake.send).toHaveBeenCalledTimes(1);
    const cmd = fake.send.mock.calls[0][0] as {
      input: { Bucket: string; Key: string };
    };
    expect(cmd.input.Bucket).toBe('my-bucket');
    expect(cmd.input.Key).toBe('attachments/x.pdf');
  });

  it('throws on S3 error — caller decides whether to swallow', async () => {
    const fake = makeFakeS3(() => Promise.reject(new Error('boom')));
    const adapter = new TestableS3Adapter(makeConfig(), fake);

    await expect(adapter.delete('k')).rejects.toThrow('boom');
  });
});

// ─── urlToKey ────────────────────────────────────────────────────

describe('S3Adapter.urlToKey', () => {
  it('extracts key from virtual-hosted-style S3 URL', () => {
    const adapter = new TestableS3Adapter(makeConfig(), makeFakeS3());
    const key = adapter.urlToKey(
      'https://my-bucket.s3.us-east-1.amazonaws.com/attachments/abc.pdf',
    );
    expect(key).toBe('attachments/abc.pdf');
  });

  it('handles nested paths with multiple slashes', () => {
    const adapter = new TestableS3Adapter(makeConfig(), makeFakeS3());
    const key = adapter.urlToKey(
      'https://my-bucket.s3.us-east-1.amazonaws.com/a/b/c/file.txt',
    );
    expect(key).toBe('a/b/c/file.txt');
  });
});
