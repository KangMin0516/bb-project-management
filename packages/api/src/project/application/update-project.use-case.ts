import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PROJECT_REPOSITORY,
  type ProjectRepository,
  type ProjectWithMembersAndCount,
} from './ports/project.repository.js';
import { ProjectDomainError } from '../domain/project.entity.js';

export interface UpdateProjectCommand {
  projectId: string;
  name?: string;
  description?: string | null;
}

/**
 * Apply name / description changes to an existing project. Key is
 * intentionally immutable (entity enforces).
 */
@Injectable()
export class UpdateProjectUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly repo: ProjectRepository,
  ) {}

  async execute(
    cmd: UpdateProjectCommand,
  ): Promise<ProjectWithMembersAndCount> {
    const project = await this.repo.findById(cmd.projectId);
    if (!project) throw new NotFoundException('Project not found');

    try {
      project.update({ name: cmd.name, description: cmd.description });
    } catch (err) {
      if (err instanceof ProjectDomainError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
    await this.repo.save(project);

    const view = await this.repo.loadUpdateView(project.id);
    if (!view) throw new NotFoundException('Project not found after update');
    return view;
  }
}
