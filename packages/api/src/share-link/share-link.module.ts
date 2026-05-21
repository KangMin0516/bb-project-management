import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { IssueModule } from '../issue/issue.module.js';
import { CreateShareLinkUseCase } from './application/create-share-link.use-case.js';
import { GetPublicTimelineUseCase } from './application/get-public-timeline.use-case.js';
import { RevokeShareLinkUseCase } from './application/revoke-share-link.use-case.js';
import { RotatePasscodeUseCase } from './application/rotate-passcode.use-case.js';
import { UnlockShareLinkUseCase } from './application/unlock-share-link.use-case.js';
import { SHARE_LINK_REPOSITORY } from './application/ports/share-link.repository.js';
import { ShareLinkPrismaRepository } from './infrastructure/share-link.prisma.repository.js';
import { ShareLinkController } from './share-link.controller.js';
import { ShareLinkPublicController } from './share-link.public.controller.js';
import { ShareJwtStrategy } from './strategies/share-jwt.strategy.js';

/**
 * Public share link module — passcode-gated read-only access to a
 * project's Timeline (Phase 1). Distinct from `ShareModule` which
 * serves OG unfurl for internal issue keys (`/share/PITB-12`).
 *
 * Imports IssueModule for `IssueQueryService` (`get-public-timeline`
 * reuses the same read path the FE Timeline uses, then narrows to a
 * field whitelist before serialisation).
 */
@Module({
  // JwtModule is registered with no defaults — every `sign()` call from
  // UnlockShareLinkUseCase passes `{ secret, expiresIn }` explicitly so
  // share tokens are signed with JWT_SHARE_SECRET, not JWT_SECRET.
  // Verification goes through ShareJwtStrategy which builds its own
  // passport-jwt instance with the right secret.
  imports: [PassportModule, JwtModule.register({}), IssueModule],
  controllers: [ShareLinkController, ShareLinkPublicController],
  providers: [
    ShareLinkPrismaRepository,
    { provide: SHARE_LINK_REPOSITORY, useExisting: ShareLinkPrismaRepository },
    CreateShareLinkUseCase,
    RevokeShareLinkUseCase,
    RotatePasscodeUseCase,
    UnlockShareLinkUseCase,
    GetPublicTimelineUseCase,
    ShareJwtStrategy,
  ],
})
export class ShareLinkModule {}
