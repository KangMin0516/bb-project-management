import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../common/decorators/index.js';
import { ShareAuthGuard } from '../share-link/guards/share-auth.guard.js';
import { claimsOf } from '../share-link/strategies/share-jwt.strategy.js';
import { VerifyShareAccessUseCase } from '../share-link/application/verify-share-access.use-case.js';
import { CreateDocCommentUseCase } from './application/create-doc-comment.use-case.js';
import { DeleteDocCommentUseCase } from './application/delete-doc-comment.use-case.js';
import {
  CountDocCommentsUseCase,
  ListDocCommentsUseCase,
} from './application/list-doc-comments.use-case.js';
import { ResolveDocCommentUseCase } from './application/resolve-doc-comment.use-case.js';
import { CreateDocCommentDto, ResolveDocCommentDto } from './dto/index.js';
import { MAX_AUTHOR_KEY_LENGTH } from './domain/doc-comment.entity.js';

/**
 * Inline doc comments over a share link. Mounted alongside the other
 * `/api/public/share/:token/...` routes and gated the same way: `@Public()`
 * so the global user-JWT guard stays out, `ShareAuthGuard` to validate
 * the share JWT, then `VerifyShareAccessUseCase` to re-read the link row
 * and require the `COMMENT` scope on every single call.
 *
 * This is the one public surface that *writes*, which drives two choices:
 *
 * - `projectId` always comes from the verified link, never the request.
 *   A link can only ever write comments into its own project.
 * - Posts are throttled per IP. A passcode-gated link handed to a client
 *   team is a credential that will eventually be forwarded further than
 *   intended, and the blast radius should be "some spam we can delete",
 *   not "unbounded writes".
 *
 * Identity is the `X-Doc-Author-Key` header: an opaque id the browser
 * mints once and keeps. It is not authentication — it only decides which
 * comments the caller may delete, and which come back flagged `mine`.
 */
@ApiTags('Public Share')
@Controller('public/share/:token/doc-comments')
@Public()
@UseGuards(ShareAuthGuard)
export class DocCommentPublicController {
  constructor(
    private readonly verifyAccess: VerifyShareAccessUseCase,
    private readonly listUseCase: ListDocCommentsUseCase,
    private readonly countUseCase: CountDocCommentsUseCase,
    private readonly createUseCase: CreateDocCommentUseCase,
    private readonly resolveUseCase: ResolveDocCommentUseCase,
    private readonly deleteUseCase: DeleteDocCommentUseCase,
  ) {}

  @Get()
  async list(
    @Param('token') token: string,
    @Query('docKey') docKey: string,
    @Req() req: Request,
    @Headers('x-doc-author-key') authorKey?: string,
  ) {
    const { project } = await this.verify(token, req);
    return this.listUseCase.execute({
      projectId: project.id,
      docKey: docKey ?? '/',
      authorKey: normalizeAuthorKey(authorKey),
    });
  }

  @Get('counts')
  async counts(@Param('token') token: string, @Req() req: Request) {
    const { project } = await this.verify(token, req);
    return this.countUseCase.execute(project.id);
  }

  @Post()
  // 40/min is far above a human writing comments and far below anything
  // that would fill the table.
  @Throttle({ default: { ttl: 60_000, limit: 40 } })
  async create(
    @Param('token') token: string,
    @Body() dto: CreateDocCommentDto,
    @Req() req: Request,
    @Headers('x-doc-author-key') authorKey?: string,
  ) {
    const { project, link } = await this.verify(token, req);
    return this.createUseCase.execute({
      projectId: project.id,
      shareLinkId: link.id,
      docKey: dto.docKey,
      body: dto.body,
      anchor: dto.anchor ?? null,
      parentId: dto.parentId ?? null,
      guestName: dto.guestName ?? null,
      authorKey: normalizeAuthorKey(authorKey),
    });
  }

  @Patch(':commentId/resolve')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  async resolve(
    @Param('token') token: string,
    @Param('commentId') commentId: string,
    @Body() dto: ResolveDocCommentDto,
    @Req() req: Request,
    @Headers('x-doc-author-key') authorKey?: string,
  ) {
    const { project } = await this.verify(token, req);
    return this.resolveUseCase.execute({
      projectId: project.id,
      commentId,
      resolved: dto.resolved,
      by: dto.by ?? null,
      authorKey: normalizeAuthorKey(authorKey),
    });
  }

  @Delete(':commentId')
  @Throttle({ default: { ttl: 60_000, limit: 40 } })
  async remove(
    @Param('token') token: string,
    @Param('commentId') commentId: string,
    @Req() req: Request,
    @Headers('x-doc-author-key') authorKey?: string,
  ) {
    const { project } = await this.verify(token, req);
    return this.deleteUseCase.execute({
      projectId: project.id,
      commentId,
      authorKey: normalizeAuthorKey(authorKey),
    });
  }

  private verify(token: string, req: Request) {
    return this.verifyAccess.execute({
      claims: claimsOf(req),
      token,
      scope: 'COMMENT',
    });
  }
}

/**
 * The header is client-supplied and only ever compared for equality, so
 * the single rule is that it stays inside the column. Over-long or blank
 * values degrade to "no key" — the caller simply can't delete anything.
 */
function normalizeAuthorKey(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value || value.length > MAX_AUTHOR_KEY_LENGTH) return null;
  return value;
}
