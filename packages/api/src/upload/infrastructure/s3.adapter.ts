import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';
import type {
  DownloadResult,
  FileStoragePort,
  UploadInput,
  UploadResult,
} from '../../common/ports/file-storage.port.js';

/**
 * S3-backed implementation of FileStoragePort.
 *
 * Behaviour preserved from legacy UploadService:
 *  - upload: throws if no bucket configured (caller checks first via
 *    isConfigured)
 *  - download: returns null when the object is missing (NoSuchKey),
 *    throws on other S3 errors
 *  - delete: throws on S3 error — caller decides whether to swallow
 *  - URL format: `https://<bucket>.s3.<region>.amazonaws.com/<key>`,
 *    matches the strings already persisted in attachment.url
 *
 * Credentials + bucket + region are loaded from ConfigService once
 * at construction time. Switching workspaces requires a restart —
 * acceptable because S3 config rarely changes.
 */
@Injectable()
export class S3Adapter implements FileStoragePort {
  private readonly logger = new Logger(S3Adapter.name);
  /**
   * Test seam — `protected` (not private) so unit tests can construct
   * a subclass with a fake SDK client. Subclass override + `protected`
   * is cheaper than `jest.unstable_mockModule` for the entire AWS SDK
   * under ESM-Jest. Production code never reassigns this.
   */
  protected s3: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  constructor(config: ConfigService) {
    this.region = config.get<string>('AWS_S3_REGION', 'ap-northeast-2');
    this.bucket = config.get<string>('AWS_S3_BUCKET', '');
    this.s3 = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: config.get<string>('AWS_ACCESS_KEY_ID', ''),
        secretAccessKey: config.get<string>('AWS_SECRET_ACCESS_KEY', ''),
      },
    });
  }

  isConfigured(): boolean {
    return this.bucket.length > 0;
  }

  async upload(input: UploadInput): Promise<UploadResult> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
    return { url: this.urlFor(input.key) };
  }

  async download(key: string): Promise<DownloadResult | null> {
    try {
      const result = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        stream: result.Body as Readable,
        contentType: result.ContentType ?? 'application/octet-stream',
      };
    } catch (err: unknown) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  urlToKey(url: string): string {
    // Two recognised shapes:
    //   1. https://<bucket>.s3.<region>.amazonaws.com/<key>
    //   2. legacy https://s3.<region>.amazonaws.com/<bucket>/<key> (rare)
    // Both reduce to "pathname with leading slash stripped" once we've
    // confirmed the host is S3.
    const parsed = new URL(url);
    return parsed.pathname.replace(/^\/+/, '');
  }

  // Test seam — subclasses can stub the URL format without touching
  // the rest of the adapter (mirrors the SlackAdapter `clientFor`).
  protected urlFor(key: string): string {
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }
}

function isNotFound(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const candidate = err as {
    name?: string;
    Code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    candidate.name === 'NoSuchKey' ||
    candidate.Code === 'NoSuchKey' ||
    candidate.$metadata?.httpStatusCode === 404
  );
}
