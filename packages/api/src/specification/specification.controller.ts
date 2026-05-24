import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SpecificationService } from './specification.service.js';
import { SpecItemIssueLinkService } from './spec-item-issue-link.service.js';
import { SpecSuggestService } from './spec-suggest.service.js';
import { CreateSpecificationDto } from './dto/create-specification.dto.js';
import { UpdateSpecificationDto } from './dto/update-specification.dto.js';
import {
  CreateSpecCommentDto,
  UpdateSpecCommentDto,
} from './dto/create-spec-comment.dto.js';
import { LinkSpecItemIssueDto } from './dto/link-spec-item-issue.dto.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/index.js';
import { ProjectMemberGuard } from '../common/guards/project-member.guard.js';

@ApiTags('Specifications')
@ApiBearerAuth()
@Controller('projects/:projectId/specifications')
@UseGuards(ProjectMemberGuard)
export class SpecificationController {
  constructor(
    private service: SpecificationService,
    private itemLinks: SpecItemIssueLinkService,
    private suggest: SpecSuggestService,
  ) {}

  // ─── Specification CRUD ──────────────────────────────────

  @Post()
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateSpecificationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.create(projectId, user.sub, dto);
  }

  @Get()
  findAll(
    @Param('projectId') projectId: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
  ) {
    return this.service.findAll(projectId, { category, status });
  }

  @Get(':specId')
  findOne(
    @Param('projectId') projectId: string,
    @Param('specId') specId: string,
  ) {
    return this.service.findOne(projectId, specId);
  }

  @Patch(':specId')
  update(
    @Param('projectId') projectId: string,
    @Param('specId') specId: string,
    @Body() dto: UpdateSpecificationDto,
  ) {
    return this.service.update(projectId, specId, dto);
  }

  @Delete(':specId')
  remove(
    @Param('projectId') projectId: string,
    @Param('specId') specId: string,
  ) {
    return this.service.remove(projectId, specId);
  }

  // ─── Download ──────────────────────────────────────────

  @Get(':specId/download')
  async downloadOne(
    @Param('projectId') projectId: string,
    @Param('specId') specId: string,
    @Res() res: Response,
  ) {
    const { filename, content } = await this.service.exportOne(
      projectId,
      specId,
    );
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(filename)}.md"`,
    );
    res.send(content);
  }

  @Get('download/all')
  async downloadAll(
    @Param('projectId') projectId: string,
    @Res() res: Response,
  ) {
    const specs = await this.service.exportAll(projectId);
    // Return as JSON array for client-side zip or bulk save
    res.json({ success: true, data: specs });
  }

  // ─── Comments ────────────────────────────────────────────

  @Post(':specId/comments')
  createComment(
    @Param('projectId') projectId: string,
    @Param('specId') specId: string,
    @Body() dto: CreateSpecCommentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createComment(projectId, specId, user.sub, dto);
  }

  @Get(':specId/comments')
  findComments(
    @Param('projectId') projectId: string,
    @Param('specId') specId: string,
    @Query('sectionId') sectionId?: string,
  ) {
    return this.service.findComments(projectId, specId, sectionId);
  }

  @Patch(':specId/comments/:commentId')
  updateComment(
    @Param('projectId') projectId: string,
    @Param('specId') specId: string,
    @Param('commentId') commentId: string,
    @Body() dto: UpdateSpecCommentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateComment(
      projectId,
      specId,
      commentId,
      user.sub,
      dto,
    );
  }

  @Delete(':specId/comments/:commentId')
  removeComment(
    @Param('projectId') projectId: string,
    @Param('specId') specId: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.removeComment(projectId, specId, commentId, user.sub);
  }

  // ─── SpecItem ↔ Issue links ──────────────────────────────

  @Post(':specId/items/:itemId/issues')
  linkIssueToItem(
    @Param('projectId') projectId: string,
    @Param('specId') specId: string,
    @Param('itemId') itemId: string,
    @Body() dto: LinkSpecItemIssueDto,
  ) {
    return this.itemLinks.create(projectId, specId, itemId, dto.issueId);
  }

  @Delete(':specId/items/:itemId/issues/:linkId')
  unlinkIssueFromItem(
    @Param('projectId') projectId: string,
    @Param('specId') specId: string,
    @Param('itemId') itemId: string,
    @Param('linkId') linkId: string,
  ) {
    return this.itemLinks.remove(projectId, specId, itemId, linkId);
  }

  @Post(':specId/suggest-items')
  suggestItems(
    @Param('projectId') projectId: string,
    @Param('specId') specId: string,
  ) {
    return this.suggest.suggestItems(projectId, specId);
  }
}
