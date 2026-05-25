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
  Query,
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
import { SuperuserGuard } from '../common/guards/superuser.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProjectRole } from '../../generated/prisma/enums.js';
import { ArchiveProjectUseCase } from './application/archive-project.use-case.js';
import { CreateProjectUseCase } from './application/create-project.use-case.js';
import { DeleteProjectUseCase } from './application/delete-project.use-case.js';
import { ListArchivedProjectsUseCase } from './application/list-archived-projects.use-case.js';
import {
  PROJECT_REPOSITORY,
  type ProjectRepository,
} from './application/ports/project.repository.js';
import { UnarchiveProjectUseCase } from './application/unarchive-project.use-case.js';
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
    private readonly archiveUC: ArchiveProjectUseCase,
    private readonly unarchiveUC: UnarchiveProjectUseCase,
    private readonly listArchivedUC: ListArchivedProjectsUseCase,
    private readonly prisma: PrismaService,
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

  // Static path — must be declared before `:projectId` so the router
  // does not try to resolve "archived" as a project id.
  @UseGuards(SuperuserGuard)
  @Get('archived')
  listArchived() {
    return this.listArchivedUC.execute();
  }

  @Get(':projectId')
  @UseGuards(ProjectMemberGuard)
  async findOne(
    @Param('projectId') projectId: string,
    @CurrentUser() user: JwtPayload,
    @Query('includeArchived') includeArchived?: string,
  ) {
    // ProjectMemberGuard already rejects archived projects for non-
    // members (repository returns null for archived rows). Superusers
    // can opt-in to view archived projects from the Archived tab.
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { isSuperuser: true },
    });
    const wantArchived =
      includeArchived === '1' && dbUser?.isSuperuser === true;
    const project = await this.repo.findWithDetails(projectId, {
      includeArchived: wantArchived,
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  // Superuser-only — soft archives the project. Members lose access on
  // the next list/detail fetch; dashboards/standups/external surfaces
  // filter by `archivedAt: null`. No ProjectMemberGuard: superuser is a
  // stronger role and bypasses the member check.
  @UseGuards(SuperuserGuard)
  @Post(':projectId/archive')
  archive(
    @Param('projectId') projectId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.archiveUC.execute({ projectId, actorId: user.sub });
  }

  @UseGuards(SuperuserGuard)
  @Post(':projectId/unarchive')
  unarchive(
    @Param('projectId') projectId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.unarchiveUC.execute({ projectId, actorId: user.sub });
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
