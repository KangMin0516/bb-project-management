import { Controller, Get, NotFoundException, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IssueQueryService } from './application/issue-query.service.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/index.js';

/**
 * Cross-project issue lookup by human-readable key (`PM-123`). Sits
 * outside the per-project `IssueController` so callers don't need to
 * know `projectId` ahead of time — the `key` itself names the project.
 *
 * Used by the markdown auto-link feature (PM-77): when the FE detects
 * a `KEY-N` pattern in rendered text, it hits this endpoint to get the
 * issue's UUID + title for the link target + hover tooltip. Cached at
 * the FE via TanStack Query so a chatty thread doesn't repeatedly
 * resolve the same key.
 *
 * Membership is enforced inside `IssueQueryService.resolveKey` — no
 * `ProjectMemberGuard` here because we don't know the project until
 * after the lookup.
 */
@ApiTags('Issues')
@ApiBearerAuth()
@Controller('issues')
export class IssueResolveController {
  constructor(private readonly queryService: IssueQueryService) {}

  @Get('resolve')
  async resolve(@CurrentUser() user: JwtPayload, @Query('key') key?: string) {
    if (!key) throw new NotFoundException('key is required');
    const resolved = await this.queryService.resolveKey(user.sub, key);
    if (!resolved) throw new NotFoundException(`Issue ${key} not found`);
    return resolved;
  }
}
