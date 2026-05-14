import { Module } from '@nestjs/common';
import { CreateProjectUseCase } from './application/create-project.use-case.js';
import { DeleteProjectUseCase } from './application/delete-project.use-case.js';
import { PROJECT_REPOSITORY } from './application/ports/project.repository.js';
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
  ],
})
export class ProjectModule {}
