import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  AVATAR_MAX_SIZE,
  ATTACHMENT_MAX_SIZE,
} from '../common/constants.js';

const MAX_FILE_SIZE = ATTACHMENT_MAX_SIZE;
const MAX_AVATAR_SIZE = AVATAR_MAX_SIZE;
const ALLOWED_AVATAR_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];
const ALLOWED_AVATAR_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private s3: S3Client;
  private bucket: string;
  private region: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.region = this.config.get<string>('AWS_S3_REGION', 'ap-northeast-2');
    this.bucket = this.config.get<string>('AWS_S3_BUCKET', '');
    this.s3 = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.config.get<string>('AWS_ACCESS_KEY_ID', ''),
        secretAccessKey: this.config.get<string>('AWS_SECRET_ACCESS_KEY', ''),
      },
    });
  }

  async uploadAvatar(file: Express.Multer.File, userId: string) {
    if (!this.bucket) {
      throw new BadRequestException('S3 bucket not configured');
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

    // Delete old avatar from S3 if exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true },
    });
    if (user?.avatar) {
      try {
        const oldUrl = new URL(user.avatar);
        const oldKey = oldUrl.pathname.slice(1);
        await this.s3.send(
          new DeleteObjectCommand({ Bucket: this.bucket, Key: oldKey }),
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to delete old avatar: ${message}`);
      }
    }

    const key = `avatars/${userId}${ext}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    const proxyUrl = `/api/upload/avatar/${userId}`;

    // Update user avatar in DB
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

    // Resolve S3 key from avatar field
    let s3Key: string;
    if (user.avatar.startsWith('http')) {
      // Legacy: full S3 URL stored in DB
      const urlObj = new URL(user.avatar);
      s3Key = urlObj.pathname.slice(1);
    } else {
      // New proxy URL format — need to find the actual S3 key
      // List isn't needed; we stored the key as avatars/{userId}{ext}
      // Try common extensions
      for (const ext of ['.jpeg', '.jpg', '.png', '.webp']) {
        const tryKey = `avatars/${userId}${ext}`;
        try {
          const result = await this.s3.send(
            new GetObjectCommand({ Bucket: this.bucket, Key: tryKey }),
          );
          return {
            stream: result.Body,
            contentType: result.ContentType || 'image/jpeg',
          };
        } catch {
          continue;
        }
      }
      return null;
    }

    try {
      const result = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: s3Key }),
      );
      return {
        stream: result.Body,
        contentType: result.ContentType || 'image/jpeg',
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to get avatar from S3: ${message}`);
      return null;
    }
  }

  async upload(
    file: Express.Multer.File,
    uploaderId: string,
    opts: { issueId?: string; commentId?: string },
  ) {
    if (!this.bucket) {
      throw new BadRequestException('S3 bucket not configured');
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('File size exceeds 50MB limit');
    }

    const ext = extname(file.originalname);
    const key = `attachments/${randomUUID()}${ext}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    const url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;

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

  async remove(id: string, userId: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id },
    });

    if (!attachment) throw new NotFoundException('Attachment not found');
    if (attachment.uploaderId !== userId) {
      throw new ForbiddenException('Only uploader can delete attachment');
    }

    // Delete from S3 if bucket is configured
    if (this.bucket) {
      const urlObj = new URL(attachment.url);
      const s3Key = urlObj.pathname.slice(1); // remove leading /

      await this.s3
        .send(new DeleteObjectCommand({ Bucket: this.bucket, Key: s3Key }))
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `Failed to delete S3 object ${s3Key}: ${message}`,
          );
        });
    }

    await this.prisma.attachment.delete({ where: { id } });
    return { deleted: true };
  }
}
