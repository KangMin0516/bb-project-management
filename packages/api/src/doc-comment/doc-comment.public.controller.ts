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
  ListAllDocCommentsUseCase,
  ListDocCommentsUseCase,
} from './application/list-doc-comments.use-case.js';
import { ResolveDocCommentUseCase } from './application/resolve-doc-comment.use-case.js';
import { CreateDocCommentDto, ResolveDocCommentDto } from './dto/index.js';
import { MAX_AUTHOR_KEY_LENGTH } from './domain/doc-comment.entity.js';

/**
 * Reads need their own generous ceiling, well above the app-wide default
 * of 30/min (`ThrottlerModule.forRoot` in `app.module.ts`).
 *
 * The reason is the client polls: a spec-site reader re-reads the open
 * document every 5s, which is 12 requests/min *per viewer* — and a whole
 * office shares one NAT address, so the throttle counter is effectively
 * per-company, not per-person. At the default 30/min, the third reviewer
 * to open the site starts getting 429s, which is exactly the situation
 * the feature exists for.
 *
 * 240/min leaves room for ~20 concurrent viewers behind one IP. Each
 * request is a single indexed read on `(project_id, doc_key)`, so the
 * cost of being wrong in this direction is small; the cost of being
 * wrong in the other direction is a review session that breaks for
 * everyone after the second person joins.
 */
const READ_LIMIT_PER_MINUTE = 240;

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
 * Identity comes from one of two places. A guest sends the
 * `X-Doc-Author-Key` header: an opaque id the browser mints once and
 * keeps, which is not authentication — it only decides which comments
 * the caller may delete, and which come back flagged `mine`. A member
 * who unlocked with a BB PM credential carries `userId` inside the share
 * JWT itself, and their comments are signed with that account.
 */
@ApiTags('Public Share')
@Controller('public/share/:token/doc-comments')
@Public()
@UseGuards(ShareAuthGuard)
export class DocCommentPublicController {
  constructor(
    private readonly verifyAccess: VerifyShareAccessUseCase,
    private readonly listUseCase: ListDocCommentsUseCase,
    private readonly listAllUseCase: ListAllDocCommentsUseCase,
    private readonly countUseCase: CountDocCommentsUseCase,
    private readonly createUseCase: CreateDocCommentUseCase,
    private readonly resolveUseCase: ResolveDocCommentUseCase,
    private readonly deleteUseCase: DeleteDocCommentUseCase,
  ) {}

  @Get()
  @Throttle({ default: { ttl: 60_000, limit: READ_LIMIT_PER_MINUTE } })
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
      caller: callerOf(req, authorKey),
    });
  }

  /**
   * Every thread in the project, each carrying its own `docKey`.
   *
   * The per-document route above answers "what is on this page"; this one
   * answers "what is open anywhere", which is what a reviewer actually
   * wants — otherwise an unread question sits on a page nobody thinks to
   * revisit. The client polls this instead of the per-document route and
   * filters locally, so it stays one request per poll.
   */
  @Get('all')
  @Throttle({ default: { ttl: 60_000, limit: READ_LIMIT_PER_MINUTE } })
  async listAll(
    @Param('token') token: string,
    @Req() req: Request,
    @Headers('x-doc-author-key') authorKey?: string,
  ) {
    const { project } = await this.verify(token, req);
    return this.listAllUseCase.execute({
      projectId: project.id,
      caller: callerOf(req, authorKey),
    });
  }

  @Get('counts')
  @Throttle({ default: { ttl: 60_000, limit: READ_LIMIT_PER_MINUTE } })
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
    const caller = callerOf(req, authorKey);
    return this.createUseCase.execute({
      projectId: project.id,
      shareLinkId: link.id,
      docKey: dto.docKey,
      body: dto.body,
      anchor: dto.anchor ?? null,
      parentId: dto.parentId ?? null,
      userId: caller.userId,
      guestName: dto.guestName ?? null,
      authorKey: caller.authorKey,
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
      memberName: claimsOf(req)?.userName ?? null,
      caller: callerOf(req, authorKey),
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
      caller: callerOf(req, authorKey),
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
 * Fold the two identity sources into the one shape the use cases take.
 * `userId` comes off the verified share JWT and is therefore trusted;
 * the header is client-supplied. Both may be present — a member's
 * browser keeps sending the key it minted before they signed in.
 */
function callerOf(req: Request, authorKey: string | undefined) {
  return {
    authorKey: normalizeAuthorKey(authorKey),
    userId: claimsOf(req)?.userId ?? null,
  };
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
