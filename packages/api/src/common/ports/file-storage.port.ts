/**
 * FileStoragePort — neutral abstraction for object storage.
 *
 * Default adapter targets AWS S3 (`upload/infrastructure/s3.adapter.ts`);
 * future adapters (R2, GCS, local disk) implement the same surface.
 * Consumers depend on this interface, not on `@aws-sdk/client-s3`.
 *
 * Scope: only the four operations used in upload.service —
 * upload, download, delete, and URL↔key translation. Bucket /
 * region / credentials stay private to the adapter and are loaded
 * from ConfigService at construction time.
 *
 * Stream type uses Node's Readable directly because both S3 SDK's
 * `Body` and Express's `res.write` work with it natively. Adapter
 * is responsible for unwrapping vendor-specific stream shapes.
 */

import type { Readable } from 'node:stream';

export const FILE_STORAGE_PORT = Symbol('FILE_STORAGE_PORT');

export interface UploadInput {
  /** Storage-relative key (e.g. "avatars/u123.png"). Adapter does not
   *  prefix or escape — caller owns the namespace. */
  key: string;
  body: Buffer;
  contentType: string;
}

export interface UploadResult {
  /** Adapter-produced public URL. May be an absolute https:// URL
   *  (S3 direct) or a relative proxy path — consumer decides whether
   *  to persist this verbatim or to substitute its own proxy URL. */
  url: string;
}

export interface DownloadResult {
  stream: Readable;
  contentType: string;
}

export interface FileStoragePort {
  /** True when the adapter has a target bucket / location configured. */
  isConfigured(): boolean;

  /** Upload bytes. Throws on storage error. */
  upload(input: UploadInput): Promise<UploadResult>;

  /**
   * Stream object bytes. Returns `null` when the key does not exist
   * (lets the caller fall through to alternative keys without a
   * try/catch). Throws on any other storage error.
   */
  download(key: string): Promise<DownloadResult | null>;

  /**
   * Delete an object. Throws on storage error — caller is free to
   * `.catch()` and log if the deletion is best-effort (orphan cleanup
   * style), but the port itself does not swallow.
   */
  delete(key: string): Promise<void>;

  /**
   * Parse a previously-issued URL back into a storage key. Implementation
   * is adapter-specific (S3 strips host + leading slash; local disk
   * might strip a path prefix). Throws if the URL is not recognisable
   * as one this adapter produced.
   */
  urlToKey(url: string): string;
}
