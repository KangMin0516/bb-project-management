import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ShareLinkModule } from '../share-link/share-link.module.js';
import { CreateDocCommentUseCase } from './application/create-doc-comment.use-case.js';
import { DeleteDocCommentUseCase } from './application/delete-doc-comment.use-case.js';
import {
  CountDocCommentsUseCase,
  ListDocCommentsUseCase,
} from './application/list-doc-comments.use-case.js';
import { ResolveDocCommentUseCase } from './application/resolve-doc-comment.use-case.js';
import { DOC_COMMENT_REPOSITORY } from './application/ports/doc-comment.repository.js';
import { DocCommentPrismaRepository } from './infrastructure/doc-comment.prisma.repository.js';
import { DocCommentPublicController } from './doc-comment.public.controller.js';

/**
 * Notion-style inline comments on documents this API doesn't host —
 * today the Saramin VN spec site, which is a static build with no
 * database of its own.
 *
 * Only a public share-link surface exists so far: the spec site unlocks
 * a `COMMENT`-scoped link once and then reads and writes through it.
 * `ShareLinkModule` supplies `VerifyShareAccessUseCase` (the shared
 * gate) and registers `ShareJwtStrategy`, which is what makes
 * `AuthGuard('share-jwt')` resolvable here; `PassportModule` is imported
 * for the guard itself.
 *
 * A member-facing surface (comments shown inside the BB PM issue/spec
 * UI) is deliberately not here yet — see the doc-comment changelog.
 */
@Module({
  imports: [PassportModule, ShareLinkModule],
  controllers: [DocCommentPublicController],
  providers: [
    DocCommentPrismaRepository,
    {
      provide: DOC_COMMENT_REPOSITORY,
      useExisting: DocCommentPrismaRepository,
    },
    ListDocCommentsUseCase,
    CountDocCommentsUseCase,
    CreateDocCommentUseCase,
    ResolveDocCommentUseCase,
    DeleteDocCommentUseCase,
  ],
})
export class DocCommentModule {}
