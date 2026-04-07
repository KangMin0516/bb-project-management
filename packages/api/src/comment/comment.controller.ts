import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CommentService } from './comment.service.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';
import { UpdateCommentDto } from './dto/update-comment.dto.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/index.js';
import { ProjectMemberGuard } from '../common/guards/project-member.guard.js';

@ApiTags('Comments')
@ApiBearerAuth()
@Controller('projects/:projectId/issues/:issueId/comments')
@UseGuards(ProjectMemberGuard)
export class CommentController {
  constructor(private commentService: CommentService) {}

  @Post()
  create(
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.commentService.create(projectId, issueId, user.sub, dto);
  }

  @Get()
  findByIssue(
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.commentService.findByIssue(projectId, issueId, page, limit);
  }

  @Patch(':commentId')
  update(
    @Param('issueId') issueId: string,
    @Param('commentId') commentId: string,
    @Body() dto: UpdateCommentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.commentService.update(issueId, commentId, user.sub, dto);
  }

  @Delete(':commentId')
  remove(
    @Param('issueId') issueId: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.commentService.remove(issueId, commentId, user.sub);
  }
}
