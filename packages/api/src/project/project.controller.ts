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
import { ProjectService } from './project.service.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';
import { CurrentUser, Roles, type JwtPayload } from '../common/decorators/index.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { ProjectRole } from '../../generated/prisma/enums.js';

@ApiTags('Projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectController {
  constructor(private projectService: ProjectService) {}

  @Post()
  create(@Body() dto: CreateProjectDto, @CurrentUser() user: JwtPayload) {
    return this.projectService.create(dto, user.sub);
  }

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.projectService.findAll(user.sub);
  }

  @Get(':projectId')
  findOne(@Param('projectId') projectId: string) {
    return this.projectService.findOne(projectId);
  }

  @Patch(':projectId')
  @UseGuards(RolesGuard)
  @Roles(ProjectRole.ADMIN, ProjectRole.PM)
  update(
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectService.update(projectId, dto);
  }

  @Delete(':projectId')
  @UseGuards(RolesGuard)
  @Roles(ProjectRole.ADMIN)
  remove(@Param('projectId') projectId: string) {
    return this.projectService.remove(projectId);
  }
}
