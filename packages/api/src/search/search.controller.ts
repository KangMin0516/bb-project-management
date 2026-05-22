import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service.js';
import { SearchQueryDto } from './dto/search-query.dto.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/index.js';

@ApiTags('Search')
@ApiBearerAuth()
@Controller('search')
export class SearchController {
  constructor(private searchService: SearchService) {}

  @Get('issues')
  async searchIssues(
    @Query() query: SearchQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.searchService.searchIssues(user.sub, query.q);
  }

  /**
   * Global cross-project search (PM-80). Returns ranked hits across
   * issues, comments, and specs the caller can see.
   */
  @Get()
  async searchAll(
    @Query() query: SearchQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.searchService.searchAll(user.sub, query.q);
  }
}
