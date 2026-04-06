import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProjectMemberService } from './project-member.service.js';
import { AddMemberDto } from './dto/add-member.dto.js';
import { UpdateMemberDto } from './dto/update-member.dto.js';
import { Roles } from '../common/decorators/index.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { ProjectMemberGuard } from '../common/guards/project-member.guard.js';
import { ProjectRole } from '../../generated/prisma/enums.js';

@ApiTags('Project Members')
@ApiBearerAuth()
@Controller('projects/:projectId/members')
@UseGuards(ProjectMemberGuard)
export class ProjectMemberController {
  constructor(private memberService: ProjectMemberService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(ProjectRole.ADMIN, ProjectRole.PM)
  add(@Param('projectId') projectId: string, @Body() dto: AddMemberDto) {
    return this.memberService.addMember(projectId, dto);
  }

  @Get()
  findAll(@Param('projectId') projectId: string) {
    return this.memberService.findAll(projectId);
  }

  @Patch(':memberId')
  @UseGuards(RolesGuard)
  @Roles(ProjectRole.ADMIN)
  updateRole(
    @Param('projectId') projectId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.memberService.updateRole(projectId, memberId, dto);
  }

  @Delete(':memberId')
  @UseGuards(RolesGuard)
  @Roles(ProjectRole.ADMIN)
  remove(
    @Param('projectId') projectId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.memberService.removeMember(projectId, memberId);
  }
}
