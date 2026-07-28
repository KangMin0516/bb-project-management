import {
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { canUnlock } from '../domain/share-link.entity.js';
import {
  SHARE_LINK_REPOSITORY,
  type ShareLinkRepository,
  type ShareLinkRow,
  type ShareScopeLiteral,
} from './ports/share-link.repository.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { SharePayload } from '../strategies/share-jwt.strategy.js';

export interface VerifyShareAccessCommand {
  /** `req.user` as populated by ShareAuthGuard — untrusted until checked. */
  claims: SharePayload | undefined;
  /** The `:token` from the request path. */
  token: string;
  /** Scope the calling route requires. Omit for scope-agnostic routes. */
  scope?: ShareScopeLiteral;
}

export interface VerifiedShareAccess {
  link: ShareLinkRow;
  project: { id: string; key: string; name: string };
}

/**
 * The gate every `/api/public/share/:token/...` route runs before it
 * touches project data. Extracted from ShareLinkPublicController so the
 * doc-comment surface enforces exactly the same rules rather than a
 * lookalike copy — a share-access check that drifts between two
 * controllers is how revoked links keep working on one of them.
 *
 * Four things are checked, in this order:
 *
 * 1. The guard actually ran and left share claims behind.
 * 2. The JWT's `shareLinkId` matches the link the path names. Without
 *    this, a JWT for link A would open link B by swapping the URL.
 * 3. The row is still usable right now (`canUnlock`) — so revoke takes
 *    effect immediately instead of when the 2h JWT lapses.
 * 4. The project is not archived, and the route's scope is granted.
 *
 * Failures below (1) are deliberately indistinguishable: 410 Gone for
 * anything to do with the link's identity or state, so probing can't
 * tell "wrong token" from "revoked" from "expired".
 */
@Injectable()
export class VerifyShareAccessUseCase {
  constructor(
    @Inject(SHARE_LINK_REPOSITORY)
    private readonly repo: ShareLinkRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(cmd: VerifyShareAccessCommand): Promise<VerifiedShareAccess> {
    const { claims } = cmd;
    if (!claims || claims.kind !== 'share')
      // The guard should have rejected this already; this covers a
      // route wired without ShareAuthGuard.
      throw new ForbiddenException('Missing share authentication');

    const link = await this.repo.findByToken(cmd.token);
    if (!link || link.id !== claims.shareLinkId)
      throw new GoneException('This share link is no longer available');

    if (!canUnlock(link, new Date()).ok)
      throw new GoneException('This share link is no longer available');

    const project = await this.prisma.project.findUnique({
      where: { id: link.projectId },
      select: { id: true, key: true, name: true, archivedAt: true },
    });
    if (!project || project.archivedAt !== null)
      throw new GoneException('This share link is no longer available');

    // Scope comes off the freshly-read row, not the JWT: narrowing a
    // link's scopes must bite immediately, and the JWT's copy is a
    // snapshot from unlock time.
    if (cmd.scope && !link.scopes.includes(cmd.scope))
      throw new ForbiddenException(
        `This share link does not include the ${cmd.scope.toLowerCase()} scope`,
      );

    return {
      link,
      project: { id: project.id, key: project.key, name: project.name },
    };
  }
}
