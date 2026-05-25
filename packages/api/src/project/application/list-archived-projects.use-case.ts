import { Inject, Injectable } from '@nestjs/common';
import {
  PROJECT_REPOSITORY,
  type ArchivedProjectView,
  type ProjectRepository,
} from './ports/project.repository.js';

/** Superuser-only — feeds the "Archived" tab on the Projects page. */
@Injectable()
export class ListArchivedProjectsUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly repo: ProjectRepository,
  ) {}

  execute(): Promise<ArchivedProjectView[]> {
    return this.repo.listArchived();
  }
}
