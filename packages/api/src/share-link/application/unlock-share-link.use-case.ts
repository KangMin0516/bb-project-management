import {
  GoneException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { canUnlock, recordFailure } from '../domain/share-link.entity.js';
import {
  SHARE_LINK_REPOSITORY,
  type ShareLinkRepository,
  type ShareScopeLiteral,
} from './ports/share-link.repository.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface UnlockShareLinkCommand {
  token: string;
  passcode: string;
}

export interface UnlockShareLinkResult {
  shareJwt: string;
  projectKey: string;
  projectName: string;
  sharedByName: string;
  scopes: ShareScopeLiteral[];
  expiresAt: Date | null;
}

export interface SharePayload {
  kind: 'share';
  shareLinkId: string;
  projectId: string;
  scopes: ShareScopeLiteral[];
}

/**
 * 423 Locked — distinct from 401 so the client can show a countdown
 * instead of "wrong passcode". Re-uses Nest's HttpException pump.
 */
class LockedException extends HttpException {
  constructor(retryAfterSeconds: number) {
    super(
      {
        statusCode: HttpStatus.LOCKED,
        message: 'Too many failed attempts',
        retryAfterSeconds,
      },
      HttpStatus.LOCKED,
    );
  }
}

@Injectable()
export class UnlockShareLinkUseCase {
  private readonly failThreshold: number;
  private readonly lockoutMs: number;
  private readonly shareJwtSecret: string;
  private readonly shareJwtExpiresIn: `${number}${'s' | 'm' | 'h' | 'd'}`;

  constructor(
    @Inject(SHARE_LINK_REPOSITORY)
    private readonly repo: ShareLinkRepository,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.failThreshold = Number(
      config.get<string>('SHARE_LINK_PASSCODE_FAIL_THRESHOLD', '20'),
    );
    const lockoutMinutes = Number(
      config.get<string>('SHARE_LINK_LOCKOUT_MINUTES', '60'),
    );
    this.lockoutMs = lockoutMinutes * 60_000;
    const secret = config.get<string>('JWT_SHARE_SECRET');
    if (!secret)
      throw new Error('JWT_SHARE_SECRET environment variable is required');
    this.shareJwtSecret = secret;
    // Cast matches AuthModule's JwtModule.registerAsync — the typed
    // `StringValue` from jsonwebtoken's `ms` is the format we use.
    this.shareJwtExpiresIn = config.get<string>(
      'SHARE_JWT_EXPIRES_IN',
      '2h',
    ) as `${number}${'s' | 'm' | 'h' | 'd'}`;
  }

  async execute(cmd: UnlockShareLinkCommand): Promise<UnlockShareLinkResult> {
    const link = await this.repo.findByToken(cmd.token);
    // 401 (not 404) for unknown token — don't leak token existence to
    // attackers enumerating slugs. Same status as wrong passcode.
    if (!link) throw new UnauthorizedException('Invalid passcode');

    const now = new Date();
    const state = canUnlock(link, now);
    if (!state.ok) {
      if (state.reason === 'REVOKED' || state.reason === 'EXPIRED')
        throw new GoneException('This share link is no longer available');
      // LOCKED — don't even bother bcrypt-comparing; same response as a
      // wrong passcode in this window so attackers can't time-attack.
      const lockedUntil = state.lockedUntil ?? now;
      const retryAfter = Math.max(
        1,
        Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000),
      );
      throw new LockedException(retryAfter);
    }

    const match = await compare(cmd.passcode, link.passcodeHash);
    if (!match) {
      const next = recordFailure(link, this.failThreshold, this.lockoutMs, now);
      await this.repo.recordFailure(
        link.id,
        next.failedAttempts,
        next.lockedUntil,
      );
      throw new UnauthorizedException('Invalid passcode');
    }

    await this.repo.recordSuccess(link.id, now);

    // Fetch project + creator name to put in the response payload. JWT
    // itself doesn't carry these — strings can change, JWT shouldn't.
    const project = await this.prisma.project.findUnique({
      where: { id: link.projectId },
      select: {
        key: true,
        name: true,
      },
    });
    if (!project)
      throw new GoneException('This share link is no longer available');

    const creator = await this.prisma.user.findUnique({
      where: { id: link.createdById },
      select: { name: true },
    });

    const payload: SharePayload = {
      kind: 'share',
      shareLinkId: link.id,
      projectId: link.projectId,
      scopes: link.scopes,
    };
    const shareJwt = this.jwt.sign(payload, {
      secret: this.shareJwtSecret,
      expiresIn: this.shareJwtExpiresIn,
    });

    return {
      shareJwt,
      projectKey: project.key,
      projectName: project.name,
      sharedByName: creator?.name ?? 'Unknown',
      scopes: link.scopes,
      expiresAt: link.expiresAt,
    };
  }
}
