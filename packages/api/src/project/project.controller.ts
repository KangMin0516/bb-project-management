import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  Roles,
  type JwtPayload,
} from '../common/decorators/index.js';
import { ProjectMemberGuard } from '../common/guards/project-member.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { ProjectRole } from '../../generated/prisma/enums.js';
import { CreateProjectUseCase } from './application/create-project.use-case.js';
import { DeleteProjectUseCase } from './application/delete-project.use-case.js';
import {
  PROJECT_REPOSITORY,
  type ProjectRepository,
} from './application/ports/project.repository.js';
import { UpdateProjectUseCase } from './application/update-project.use-case.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';

@ApiTags('Projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectController {
  constructor(
    private readonly createUC: CreateProjectUseCase,
    private readonly updateUC: UpdateProjectUseCase,
    private readonly deleteUC: DeleteProjectUseCase,
    @Inject(PROJECT_REPOSITORY)
    private readonly repo: ProjectRepository,
  ) {}

  @Post()
  create(@Body() dto: CreateProjectDto, @CurrentUser() user: JwtPayload) {
    return this.createUC.execute({
      name: dto.name,
      key: dto.key,
      description: dto.description,
      creatorId: user.sub,
    });
  }

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.repo.listForUser(user.sub);
  }

  @Get('all')
  findAllWithJoinStatus(@CurrentUser() user: JwtPayload) {
    return this.repo.listAllWithMembership(user.sub);
  }

  @Get(':projectId')
  @UseGuards(ProjectMemberGuard)
  async findOne(@Param('projectId') projectId: string) {
    const project = await this.repo.findWithDetails(projectId);
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  @Patch(':projectId')
  @UseGuards(RolesGuard)
  @Roles(ProjectRole.ADMIN, ProjectRole.PM)
  update(@Param('projectId') projectId: string, @Body() dto: UpdateProjectDto) {
    return this.updateUC.execute({
      projectId,
      name: dto.name,
      description: dto.description,
    });
  }

  @Delete(':projectId')
  @UseGuards(RolesGuard)
  @Roles(ProjectRole.ADMIN)
  remove(@Param('projectId') projectId: string) {
    return this.deleteUC.execute({ projectId });
  }
}
