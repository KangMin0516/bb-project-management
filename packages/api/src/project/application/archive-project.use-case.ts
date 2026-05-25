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
import { ProjectArchivedEvent } from '../domain/events/project-archived.event.js';
import { ProjectDomainError } from '../domain/project.entity.js';

export interface ArchiveProjectCommand {
  projectId: string;
  actorId: string;
}

/**
 * Soft-archive a project. The project disappears from every member-
 * facing list, dashboard, standup, and external/MCP surface (see the
 * `archivedAt: null` filters added to those queries). Superusers can
 * still see it under the Archived tab and call `unarchive` to restore.
 *
 * Emits `ProjectArchivedEvent` on the outbox so future subscribers
 * (share-link revoke, channel notification, etc.) can hook in without
 * editing this use case.
 */
@Injectable()
export class ArchiveProjectUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly repo: ProjectRepository,
    private readonly outboxBus: OutboxEventBus,
  ) {}

  async execute(
    cmd: ArchiveProjectCommand,
  ): Promise<ProjectWithMembersAndCount> {
    // Accept both UUID and human key, mirroring `GET /api/projects/:id`.
    const project =
      (await this.repo.findById(cmd.projectId)) ??
      (await this.repo.findByKey(cmd.projectId));
    if (!project) throw new NotFoundException('Project not found');

    try {
      project.archive(cmd.actorId);
    } catch (err) {
      if (
        err instanceof ProjectDomainError &&
        err.code === 'ALREADY_ARCHIVED'
      ) {
        throw new ConflictException(err.message);
      }
      throw err;
    }
    await this.repo.save(project);

    // Best-effort outbox append. We don't share a tx with `repo.save()`
    // today — if the outbox append fails the project is still archived
    // (acceptable: there are no consumers yet, and the audit columns
    // `archivedAt` / `archivedById` carry the durable trail).
    for (const event of project.pullEvents()) {
      if (event instanceof ProjectArchivedEvent) {
        await this.outboxBus.publish({
          type: ProjectArchivedEvent.type,
          aggregateType: 'Project',
          aggregateId: project.id,
          payload: {
            projectId: event.projectId,
            key: event.key,
            actorId: event.actorId,
            archivedAt: event.archivedAt.toISOString(),
          },
        });
      }
    }

    const view = await this.repo.loadUpdateView(project.id);
    if (!view) throw new NotFoundException('Project not found after archive');
    return view;
  }
}
