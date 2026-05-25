import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OutboxEventBus } from '../../outbox/outbox-event-bus.js';
import {
  PROJECT_REPOSITORY,
  type ProjectRepository,
  type ProjectWithMembersAndCount,
} from './ports/project.repository.js';
import { ProjectDomainError } from '../domain/project.entity.js';
import { ProjectUnarchivedEvent } from '../domain/events/project-unarchived.event.js';

export interface UnarchiveProjectCommand {
  projectId: string;
  actorId: string;
}

/** Restore a previously archived project — opposite of `Archive`. */
@Injectable()
export class UnarchiveProjectUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly repo: ProjectRepository,
    private readonly outboxBus: OutboxEventBus,
  ) {}

  async execute(
    cmd: UnarchiveProjectCommand,
  ): Promise<ProjectWithMembersAndCount> {
    // Accept both UUID and human key, mirroring `GET /api/projects/:id`.
    const project =
      (await this.repo.findById(cmd.projectId)) ??
      (await this.repo.findByKey(cmd.projectId));
    if (!project) throw new NotFoundException('Project not found');

    try {
      project.unarchive(cmd.actorId);
    } catch (err) {
      if (err instanceof ProjectDomainError && err.code === 'NOT_ARCHIVED') {
        throw new ConflictException(err.message);
      }
      throw err;
    }
    await this.repo.save(project);

    for (const event of project.pullEvents()) {
      if (event instanceof ProjectUnarchivedEvent) {
        await this.outboxBus.publish({
          type: ProjectUnarchivedEvent.type,
          aggregateType: 'Project',
          aggregateId: project.id,
          payload: {
            projectId: event.projectId,
            key: event.key,
            actorId: event.actorId,
          },
        });
      }
    }

    const view = await this.repo.loadUpdateView(project.id);
    if (!view) throw new NotFoundException('Project not found after unarchive');
    return view;
  }
}
