import {
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { canUnlock } from '../domain/share-link.entity.js';
import {
  SHARE_LINK_REPOSITORY,
  type ShareLinkRepository,
} from './ports/share-link.repository.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { SharePayload } from '../strategies/share-jwt.strategy.js';
import type { UnlockShareLinkResult } from './unlock-share-link.use-case.js';

export interface UnlockShareLinkAsMemberCommand {
  token: string;
  /** Resolved by `ApiKeyGuard` from an OAuth access token or an API key. */
  userId: string;
}

export interface UnlockShareLinkAsMemberResult extends UnlockShareLinkResult {
  member: { id: string; name: string; avatar: string | null };
}

/**
 * The passcode-free half of unlock: a BB PM member who has already
 * authenticated (OAuth 2.1 access token, or a personal API key) trades
 * that credential for a share JWT that carries their identity, so their
 * comments land under their real name instead of a typed-in guest label.
 *
 * Two things this is deliberately *not*:
 *
 * - **Not a way around the share link.** The link still decides which
 *   project is reachable and which scopes apply; every subsequent call
 *   re-checks it through `VerifyShareAccessUseCase`. A member of project
 *   A cannot unlock a link into project B.
 * - **Not a way around membership.** The credential proves who you are,
 *   the `ProjectMember` row is what says you may sign your name to this
 *   project's review. A BB PM user outside the project falls back to the
 *   passcode and comments as a guest, exactly like a client reviewer.
 *
 * Why the identity is baked into the JWT rather than re-resolved per
 * request: the doc-comment surface is `@Public()` and authenticates with
 * the share JWT alone. Putting `userId` in that token keeps one
 * credential on the wire instead of two, and keeps the access token —
 * which is a full-account bearer credential on every other surface — out
 * of the spec site's storage entirely. It is exchanged once and dropped.
 */
@Injectable()
export class UnlockShareLinkAsMemberUseCase {
  private readonly shareJwtSecret: string;
  private readonly shareJwtExpiresIn: `${number}${'s' | 'm' | 'h' | 'd'}`;

  constructor(
    @Inject(SHARE_LINK_REPOSITORY)
    private readonly repo: ShareLinkRepository,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    const secret = config.get<string>('JWT_SHARE_SECRET');
    if (!secret)
      throw new Error('JWT_SHARE_SECRET environment variable is required');
    this.shareJwtSecret = secret;
    // Longer than the guest's 2h on purpose. Renewing a guest session is
    // a silent re-POST of a stored passcode; renewing a member session
    // means bouncing the browser through the OAuth redirect, which loses
    // the reader's scroll position mid-review. A day of reading, one
    // sign-in.
    this.shareJwtExpiresIn = config.get<string>(
      'SHARE_JWT_MEMBER_EXPIRES_IN',
      '12h',
    ) as `${number}${'s' | 'm' | 'h' | 'd'}`;
  }

  async execute(
    cmd: UnlockShareLinkAsMemberCommand,
  ): Promise<UnlockShareLinkAsMemberResult> {
    const link = await this.repo.findByToken(cmd.token);
    // 410 for everything about the link's identity or state, matching
    // `VerifyShareAccessUseCase`. The 401-not-404 dance the passcode path
    // does is about token enumeration by strangers; this caller is an
    // authenticated member and learns nothing new from the distinction.
    if (!link)
      throw new GoneException('This share link is no longer available');

    const now = new Date();
    const state = canUnlock(link, now);
    // LOCKED is the passcode brute-force defence. This caller never
    // presented a passcode, so a lockout triggered by someone else
    // guessing must not shut the door on them.
    if (!state.ok && state.reason !== 'LOCKED')
      throw new GoneException('This share link is no longer available');

    const project = await this.prisma.project.findUnique({
      where: { id: link.projectId },
      select: { key: true, name: true, archivedAt: true },
    });
    if (!project || project.archivedAt !== null)
      throw new GoneException('This share link is no longer available');

    const membership = await this.prisma.projectMember.findUnique({
      where: {
        userId_projectId: { userId: cmd.userId, projectId: link.projectId },
      },
      select: {
        user: { select: { id: true, name: true, avatar: true } },
      },
    });
    if (!membership)
      throw new ForbiddenException(
        'You are not a member of this project — unlock with the passcode instead',
      );

    await this.repo.recordSuccess(link.id, now);

    const creator = await this.prisma.user.findUnique({
      where: { id: link.createdById },
      select: { name: true },
    });

    // `userName` rides along because the only thing it feeds is
    // `resolvedBy`, a snapshot display string on the row. The
    // alternative is a user lookup on every resolve to produce a label
    // that was never meant to track renames.
    const payload: SharePayload = {
      kind: 'share',
      shareLinkId: link.id,
      projectId: link.projectId,
      scopes: link.scopes,
      userId: membership.user.id,
      userName: membership.user.name,
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
      member: {
        id: membership.user.id,
        name: membership.user.name,
        avatar: membership.user.avatar,
      },
    };
  }
}
