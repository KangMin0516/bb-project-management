import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  PROJECT_REPOSITORY,
  type ProjectRepository,
} from './ports/project.repository.js';

export interface DeleteProjectCommand {
  projectId: string;
}

@Injectable()
export class DeleteProjectUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly repo: ProjectRepository,
  ) {}

  async execute(cmd: DeleteProjectCommand): Promise<{ deleted: true }> {
    const project = await this.repo.findById(cmd.projectId);
    if (!project) throw new NotFoundException('Project not found');
    // Cascading delete is configured in the Prisma schema (members,
    // issues, labels, etc.) — see the @relation(onDelete: Cascade)
    // declarations.
    await this.repo.delete(cmd.projectId);
    return { deleted: true };
  }
}
