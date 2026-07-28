import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  CurrentUser,
  Public,
  type JwtPayload,
} from '../common/decorators/index.js';
import { ApiKeyGuard } from '../api-key/api-key.guard.js';
import { ShareAuthGuard } from './guards/share-auth.guard.js';
import { claimsOf } from './strategies/share-jwt.strategy.js';
import { UnlockShareLinkUseCase } from './application/unlock-share-link.use-case.js';
import { UnlockShareLinkAsMemberUseCase } from './application/unlock-share-link-as-member.use-case.js';
import { GetPublicTimelineUseCase } from './application/get-public-timeline.use-case.js';
import { VerifyShareAccessUseCase } from './application/verify-share-access.use-case.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UnlockShareLinkDto } from './dto/unlock-share-link.dto.js';

/**
 * Public, no-JWT surface. Mounted under `/api/public/share` and marked
 * `@Public()` so the global `JwtAuthGuard` ignores us. Reads after the
 * unlock step require a `share-jwt` validated by `ShareAuthGuard`.
 *
 * Every read re-verifies the share link row (revoked / expired) via
 * `VerifyShareAccessUseCase` — the JWT alone is not trusted because
 * revoke must take effect immediately, not 2h later when the JWT
 * expires on its own. The doc-comment public controller runs the same
 * use case, so both surfaces share one definition of "still allowed".
 */
@ApiTags('Public Share')
@Controller('public/share')
@Public()
export class ShareLinkPublicController {
  constructor(
    private readonly unlockUseCase: UnlockShareLinkUseCase,
    private readonly unlockAsMemberUseCase: UnlockShareLinkAsMemberUseCase,
    private readonly timelineUseCase: GetPublicTimelineUseCase,
    private readonly verifyAccess: VerifyShareAccessUseCase,
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

  /**
   * The same unlock for someone who already has a BB PM account: present
   * an OAuth 2.1 access token (or a personal API key) instead of the
   * passcode and the resulting session is signed with your identity.
   *
   * `ApiKeyGuard` rather than the user-JWT guard because the caller here
   * is a browser on a *different origin* — the spec site — which has no
   * BB PM cookie and no reason to hold one. It arrives with a token it
   * got through the authorization-code flow, uses it once, and drops it.
   */
  @Post(':token/unlock-member')
  @UseGuards(ApiKeyGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  unlockAsMember(
    @Param('token') token: string,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!isLikelyToken(token))
      throw new BadRequestException('Invalid share token');
    return this.unlockAsMemberUseCase.execute({ token, userId: user.sub });
  }

  @Get(':token/project')
  @UseGuards(ShareAuthGuard)
  async getProject(@Param('token') token: string, @Req() req: Request) {
    const { link, project } = await this.verifyAccess.execute({
      claims: claimsOf(req),
      token,
    });
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
    const { link } = await this.verifyAccess.execute({
      claims: claimsOf(req),
      token,
      scope: 'TIMELINE',
    });
    return this.timelineUseCase.execute({
      shareLinkId: link.id,
      projectId: link.projectId,
    });
  }
}

const TOKEN_RX = /^[a-f0-9]{32}$/i;
function isLikelyToken(s: string): boolean {
  return TOKEN_RX.test(s);
}
