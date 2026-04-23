import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JoinRequestService } from './join-request.service.js';
import { CreateJoinRequestDto } from './dto/create-join-request.dto.js';
import { RejectJoinRequestDto } from './dto/reject-join-request.dto.js';
import { CurrentUser, Roles } from '../common/decorators/index.js';
import type { JwtPayload } from '../common/decorators/index.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { ProjectMemberGuard } from '../common/guards/project-member.guard.js';
import { ProjectRole } from '../../generated/prisma/enums.js';

@ApiTags('Join Requests')
@ApiBearerAuth()
@Controller()
export class JoinRequestController {
  constructor(private joinRequestService: JoinRequestService) {}

  // ─── Public (no ProjectMemberGuard) ──────────────────

  @Post('projects/:projectId/join-requests')
  create(
    @Param('projectId') projectId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateJoinRequestDto,
  ) {
    return this.joinRequestService.create(projectId, user.sub, dto);
  }

  @Get('me/join-requests')
  myRequests(@CurrentUser() user: JwtPayload) {
    return this.joinRequestService.findByUser(user.sub);
  }

  @Delete('me/join-requests/:id')
  cancelRequest(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.joinRequestService.cancel(id, user.sub);
  }

  // ─── Project-scoped (ADMIN/PM only) ──────────────────

  @Get('projects/:projectId/join-requests')
  @UseGuards(ProjectMemberGuard, RolesGuard)
  @Roles(ProjectRole.ADMIN, ProjectRole.PM)
  findByProject(@Param('projectId') projectId: string) {
    return this.joinRequestService.findByProject(projectId);
  }

  @Post('projects/:projectId/join-requests/:id/approve')
  @UseGuards(ProjectMemberGuard, RolesGuard)
  @Roles(ProjectRole.ADMIN, ProjectRole.PM)
  approve(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.joinRequestService.approve(projectId, id, user.sub);
  }

  @Post('projects/:projectId/join-requests/:id/reject')
  @UseGuards(ProjectMemberGuard, RolesGuard)
  @Roles(ProjectRole.ADMIN, ProjectRole.PM)
  reject(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: RejectJoinRequestDto,
  ) {
    return this.joinRequestService.reject(projectId, id, user.sub, dto);
  }
}
