import { Module } from '@nestjs/common';
import { ArchiveProjectUseCase } from './application/archive-project.use-case.js';
import { CreateProjectUseCase } from './application/create-project.use-case.js';
import { DeleteProjectUseCase } from './application/delete-project.use-case.js';
import { ListArchivedProjectsUseCase } from './application/list-archived-projects.use-case.js';
import { PROJECT_REPOSITORY } from './application/ports/project.repository.js';
import { UnarchiveProjectUseCase } from './application/unarchive-project.use-case.js';
import { UpdateProjectUseCase } from './application/update-project.use-case.js';
import { ProjectPrismaRepository } from './infrastructure/project.prisma.repository.js';
import { ProjectController } from './project.controller.js';

@Module({
  controllers: [ProjectController],
  providers: [
    ProjectPrismaRepository,
    { provide: PROJECT_REPOSITORY, useExisting: ProjectPrismaRepository },
    CreateProjectUseCase,
    UpdateProjectUseCase,
    DeleteProjectUseCase,
    ArchiveProjectUseCase,
    UnarchiveProjectUseCase,
    ListArchivedProjectsUseCase,
  ],
})
export class ProjectModule {}
