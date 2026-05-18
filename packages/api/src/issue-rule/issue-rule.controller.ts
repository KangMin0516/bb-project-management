import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IssueRuleService } from './issue-rule.service.js';
import { UpsertIssueRuleDto } from './dto/upsert-rule.dto.js';
import { SuperuserGuard } from '../common/guards/index.js';
import { IssueType } from '../../generated/prisma/enums.js';

/**
 * Global admin endpoints for the per-IssueType rules. Superuser-only —
 * rules are workspace-wide and the LLM contract changes for everyone
 * when these are edited.
 *
 * The MCP server reads the same rules through `ExternalController`,
 * which is API-key authed and rate-limited separately.
 */
@ApiTags('Issue Rules')
@ApiBearerAuth()
@UseGuards(SuperuserGuard)
@Controller('issue-rules')
export class IssueRuleController {
  constructor(private service: IssueRuleService) {}

  @Get()
  list() {
    return this.service.listAll();
  }

  @Get(':issueType')
  getOne(@Param('issueType') issueType: string) {
    return this.service.resolve(issueType.toUpperCase() as IssueType);
  }

  @Put()
  upsert(@Body() dto: UpsertIssueRuleDto) {
    return this.service.upsert(dto);
  }

  @Delete(':issueType')
  remove(@Param('issueType') issueType: string) {
    return this.service.remove(issueType.toUpperCase() as IssueType);
  }
}
