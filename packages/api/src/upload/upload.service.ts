import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import {
  FILE_STORAGE_PORT,
  type FileStoragePort,
} from '../common/ports/file-storage.port.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AVATAR_MAX_SIZE, ATTACHMENT_MAX_SIZE } from '../common/constants.js';

const MAX_FILE_SIZE = ATTACHMENT_MAX_SIZE;
const MAX_AVATAR_SIZE = AVATAR_MAX_SIZE;
const ALLOWED_AVATAR_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];
const ALLOWED_AVATAR_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

const BLOCKED_ATTACHMENT_EXTS = [
  '.exe',
  '.bat',
  '.cmd',
  '.com',
  '.msi',
  '.scr',
  '.pif',
  '.sh',
  '.bash',
  '.ps1',
  '.vbs',
  '.js',
  '.wsh',
  '.wsf',
  '.html',
  '.htm',
  '.svg',
  '.hta',
  '.xhtml',
];
const BLOCKED_ATTACHMENT_MIMES = [
  'application/x-msdownload',
  'application/x-executable',
  'text/html',
  'image/svg+xml',
  'application/hta',
  'application/javascript',
  'text/javascript',
  'application/x-sh',
  'application/x-msdos-program',
];

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(FILE_STORAGE_PORT) private storage: FileStoragePort,
  ) {}

  async uploadAvatar(file: Express.Multer.File, userId: string) {
    if (!this.storage.isConfigured()) {
      throw new BadRequestException('File storage not configured');
    }

    if (file.size > MAX_AVATAR_SIZE) {
      throw new BadRequestException('Avatar file size exceeds 5MB limit');
    }

    const ext = extname(file.originalname).toLowerCase();
    if (!ALLOWED_AVATAR_EXTS.includes(ext)) {
      throw new BadRequestException('Only jpg, png, webp images are allowed');
    }

    if (!ALLOWED_AVATAR_MIMES.includes(file.mimetype)) {
      throw new BadRequestException('Only jpg, png, webp images are allowed');
    }

    // Best-effort: delete the previous avatar object so we don't leak
    // orphans. The DB write below replaces the reference regardless.
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true },
    });
    if (user?.avatar) {
      try {
        const oldKey = this.resolveAvatarKey(user.avatar);
        if (oldKey) await this.storage.delete(oldKey);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to delete old avatar: ${message}`);
      }
    }

    const key = `avatars/${userId}${ext}`;
    await this.storage.upload({
      key,
      body: file.buffer,
      contentType: file.mimetype,
    });

    // We store a proxy URL (resolved server-side by getAvatar), not the
    // storage adapter's direct URL. This keeps avatars routed through
    // the API for auth / cache-busting / future signed-URL support.
    const proxyUrl = `/api/upload/avatar/${userId}`;

    await this.prisma.user.update({
      where: { id: userId },
      data: { avatar: proxyUrl },
    });

    return { url: proxyUrl };
  }

  async getAvatar(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true },
    });

    if (!user?.avatar) return null;

    // Legacy rows may hold a full storage URL (pre-proxy); newer rows
    // store the proxy path. In both cases we look up the actual
    // object by guessing likely extensions for the proxy path, or by
    // translating the URL to a key for legacy URLs.
    if (user.avatar.startsWith('http')) {
      try {
        const key = this.storage.urlToKey(user.avatar);
        return await this.storage.download(key);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to read legacy avatar: ${message}`);
        return null;
      }
    }

    for (const ext of ['.jpeg', '.jpg', '.png', '.webp']) {
      const tryKey = `avatars/${userId}${ext}`;
      const result = await this.storage.download(tryKey);
      if (result) return result;
    }
    return null;
  }

  async upload(
    file: Express.Multer.File,
    uploaderId: string,
    opts: { issueId?: string; commentId?: string },
  ) {
    if (!this.storage.isConfigured()) {
      throw new BadRequestException('File storage not configured');
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('File size exceeds 50MB limit');
    }

    const ext = extname(file.originalname).toLowerCase();
    if (BLOCKED_ATTACHMENT_EXTS.includes(ext)) {
      throw new BadRequestException(`File type ${ext} is not allowed`);
    }
    if (BLOCKED_ATTACHMENT_MIMES.includes(file.mimetype)) {
      throw new BadRequestException(
        `MIME type ${file.mimetype} is not allowed`,
      );
    }

    const key = `attachments/${randomUUID()}${ext}`;
    const { url } = await this.storage.upload({
      key,
      body: file.buffer,
      contentType: file.mimetype,
    });

    return this.prisma.attachment.create({
      data: {
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        url,
        uploaderId,
        issueId: opts.issueId || null,
        commentId: opts.commentId || null,
      },
    });
  }

  /**
   * Issue a presigned S3 URL the browser can use to PUT a file directly
   * to object storage, bypassing the API. The DB row is only created
   * later in `commitAttachment` — until then the object lives in S3
   * orphaned. That tradeoff (orphan vs double-trip latency) is worth it
   * for 30MB+ media: we save the entire API-side memory buffer and the
   * second leg of the network hop.
   *
   * Validation mirrors `upload()` — same size cap, same blocked ext /
   * MIME list — because the same restrictions apply regardless of how
   * the bytes reach S3.
   */
  async presignAttachment(input: {
    fileName: string;
    fileSize: number;
    mimeType: string;
  }) {
    if (!this.storage.isConfigured()) {
      throw new BadRequestException('File storage not configured');
    }

    if (input.fileSize > MAX_FILE_SIZE) {
      throw new BadRequestException('File size exceeds 50MB limit');
    }

    const ext = extname(input.fileName).toLowerCase();
    if (BLOCKED_ATTACHMENT_EXTS.includes(ext)) {
      throw new BadRequestException(`File type ${ext} is not allowed`);
    }
    if (BLOCKED_ATTACHMENT_MIMES.includes(input.mimeType)) {
      throw new BadRequestException(
        `MIME type ${input.mimeType} is not allowed`,
      );
    }

    const key = `attachments/${randomUUID()}${ext}`;
    const url = await this.storage.presignPut({
      key,
      contentType: input.mimeType,
    });

    return { key, url, publicUrl: this.storage.keyToUrl(key) };
  }

  /**
   * Create the Attachment DB row after a successful direct-to-S3 PUT.
   * Caller passes back the storage `key` issued by `presignAttachment`
   * so we never trust browser-supplied URLs. `fileSize` / `mimeType` /
   * `fileName` are re-validated for the same reason.
   */
  async commitAttachment(
    input: {
      key: string;
      fileName: string;
      fileSize: number;
      mimeType: string;
      issueId?: string;
      commentId?: string;
    },
    uploaderId: string,
  ) {
    if (!this.storage.isConfigured()) {
      throw new BadRequestException('File storage not configured');
    }
    if (!input.key.startsWith('attachments/')) {
      throw new BadRequestException('Invalid storage key');
    }
    if (input.fileSize > MAX_FILE_SIZE) {
      throw new BadRequestException('File size exceeds 50MB limit');
    }
    const ext = extname(input.fileName).toLowerCase();
    if (BLOCKED_ATTACHMENT_EXTS.includes(ext)) {
      throw new BadRequestException(`File type ${ext} is not allowed`);
    }
    if (BLOCKED_ATTACHMENT_MIMES.includes(input.mimeType)) {
      throw new BadRequestException(
        `MIME type ${input.mimeType} is not allowed`,
      );
    }

    return this.prisma.attachment.create({
      data: {
        fileName: input.fileName,
        fileSize: input.fileSize,
        mimeType: input.mimeType,
        url: this.storage.keyToUrl(input.key),
        uploaderId,
        issueId: input.issueId || null,
        commentId: input.commentId || null,
      },
    });
  }

  async remove(id: string, userId: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id },
    });

    if (!attachment) throw new NotFoundException('Attachment not found');
    if (attachment.uploaderId !== userId) {
      throw new ForbiddenException('Only uploader can delete attachment');
    }

    if (this.storage.isConfigured()) {
      try {
        const key = this.storage.urlToKey(attachment.url);
        await this.storage.delete(key);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to delete storage object: ${message}`);
      }
    }

    await this.prisma.attachment.delete({ where: { id } });
    return { deleted: true };
  }

  // ─── helpers ─────────────────────────────────────────────────

  /**
   * Given the value persisted in `user.avatar`, return the storage key
   * to delete — or null if the URL is a proxy path (we don't know the
   * extension without listing, so leave the old object as a tolerable
   * orphan when the user re-uploads with a different extension).
   */
  private resolveAvatarKey(avatarField: string): string | null {
    if (avatarField.startsWith('http')) {
      return this.storage.urlToKey(avatarField);
    }
    return null;
  }
}
