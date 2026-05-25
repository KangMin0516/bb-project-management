import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  GoneException,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../common/decorators/index.js';
import { ShareAuthGuard } from './guards/share-auth.guard.js';
import type { SharePayload } from './strategies/share-jwt.strategy.js';
import { UnlockShareLinkUseCase } from './application/unlock-share-link.use-case.js';
import { GetPublicTimelineUseCase } from './application/get-public-timeline.use-case.js';
import {
  SHARE_LINK_REPOSITORY,
  type ShareLinkRepository,
} from './application/ports/share-link.repository.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UnlockShareLinkDto } from './dto/unlock-share-link.dto.js';
import { canUnlock } from './domain/share-link.entity.js';

/**
 * Public, no-JWT surface. Mounted under `/api/public/share` and marked
 * `@Public()` so the global `JwtAuthGuard` ignores us. Reads after the
 * unlock step require a `share-jwt` validated by `ShareAuthGuard`.
 *
 * Every read re-verifies the share link row (revoked / expired) — the
 * JWT alone is not trusted because revoke must take effect immediately,
 * not 2h later when the JWT expires on its own.
 */
@ApiTags('Public Share')
@Controller('public/share')
@Public()
export class ShareLinkPublicController {
  constructor(
    private readonly unlockUseCase: UnlockShareLinkUseCase,
    private readonly timelineUseCase: GetPublicTimelineUseCase,
    @Inject(SHARE_LINK_REPOSITORY)
    private readonly repo: ShareLinkRepository,
    private readonly prisma: PrismaService,
  ) {}

  @Post(':token/unlock')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  unlock(@Param('token') token: string, @Body() dto: UnlockShareLinkDto) {
    if (!isLikelyToken(token))
      // Same error message as a wrong passcode — never leak whether
      // the slug matched our shape.
      throw new BadRequestException('Invalid passcode');
    return this.unlockUseCase.execute({ token, passcode: dto.passcode });
  }

  @Get(':token/project')
  @UseGuards(ShareAuthGuard)
  async getProject(@Param('token') token: string, @Req() req: Request) {
    const claims = this.getValidatedClaims(req);
    const { link, project } = await this.requireFreshLink(claims, token);
    const creator = await this.prisma.user.findUnique({
      where: { id: link.createdById },
      select: { name: true },
    });
    return {
      projectKey: project.key,
      projectName: project.name,
      sharedByName: creator?.name ?? 'Unknown',
      scopes: link.scopes,
      expiresAt: link.expiresAt,
    };
  }

  @Get(':token/timeline')
  @UseGuards(ShareAuthGuard)
  async getTimeline(@Param('token') token: string, @Req() req: Request) {
    const claims = this.getValidatedClaims(req);
    const { link } = await this.requireFreshLink(claims, token);
    if (!link.scopes.includes('TIMELINE'))
      throw new ForbiddenException(
        'This share link does not include the timeline scope',
      );
    return this.timelineUseCase.execute({
      shareLinkId: link.id,
      projectId: link.projectId,
    });
  }

  private getValidatedClaims(req: Request): SharePayload {
    const claims = (req as Request & { user?: SharePayload }).user;
    if (!claims || claims.kind !== 'share')
      // Guard should have rejected this already; defensive throw covers
      // misconfiguration where the route is wired without ShareAuthGuard.
      throw new ForbiddenException('Missing share authentication');
    return claims;
  }

  /**
   * Bind the JWT's `shareLinkId` to the path's `:token`, then re-verify
   * the row is still usable. Prevents an attacker from holding a JWT
   * for link A and then accessing link B by swapping the URL — and also
   * makes revoke effective without waiting for JWT expiry. Archived
   * projects 410-Gone here so every share-scoped read inherits the
   * archive check. Returns the project too so handlers don't re-query.
   */
  private async requireFreshLink(claims: SharePayload, pathToken: string) {
    const link = await this.repo.findByToken(pathToken);
    if (!link || link.id !== claims.shareLinkId)
      throw new GoneException('This share link is no longer available');
    const state = canUnlock(link, new Date());
    if (!state.ok)
      throw new GoneException('This share link is no longer available');
    const project = await this.prisma.project.findUnique({
      where: { id: link.projectId },
      select: { id: true, key: true, name: true, archivedAt: true },
    });
    if (!project || project.archivedAt !== null)
      throw new GoneException('This share link is no longer available');
    return { link, project };
  }
}

const TOKEN_RX = /^[a-f0-9]{32}$/i;
function isLikelyToken(s: string): boolean {
  return TOKEN_RX.test(s);
}
