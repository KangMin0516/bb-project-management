import { describe, expect, it, jest } from '@jest/globals';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ArchiveProjectUseCase } from './archive-project.use-case.js';
import { UnarchiveProjectUseCase } from './unarchive-project.use-case.js';
import { ProjectArchivedEvent } from '../domain/events/project-archived.event.js';
import { ProjectUnarchivedEvent } from '../domain/events/project-unarchived.event.js';
import { Project } from '../domain/project.entity.js';
import type { ProjectRepository } from './ports/project.repository.js';
import type { OutboxEventBus } from '../../outbox/outbox-event-bus.js';

const VIEW = {
  id: 'p-1',
  name: 'Alpha',
  key: 'ALP',
  description: null,
  archivedAt: null,
  archivedById: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  members: [],
  _count: { issues: 0 },
};

function makeRepo(initial: Project) {
  const repo: Partial<ProjectRepository> = {
    findById: jest.fn(async () => initial),
    findByKey: jest.fn(async () => null),
    save: jest.fn(async () => undefined),
    loadUpdateView: jest.fn(async () => VIEW),
    listArchived: jest.fn(async () => []),
  };
  return repo as ProjectRepository;
}

function makeBus(): OutboxEventBus {
  return {
    publish: jest.fn(async () => undefined),
  } as unknown as OutboxEventBus;
}

function activeProject(): Project {
  return Project.create({
    id: 'p-1',
    name: 'Alpha',
    key: 'ALP',
    creatorId: 'u-1',
  });
}

function archivedProject(): Project {
  const p = activeProject();
  p.archive('u-1');
  // Drain creation + archive events to keep tests isolated.
  p.pullEvents();
  return p;
}

describe('ArchiveProjectUseCase', () => {
  it('archives an active project + emits ProjectArchivedEvent', async () => {
    const project = activeProject();
    project.pullEvents(); // drain ProjectCreated
    const repo = makeRepo(project);
    const bus = makeBus();
    const uc = new ArchiveProjectUseCase(repo, bus);

    const result = await uc.execute({ projectId: 'p-1', actorId: 'u-9' });

    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(project.isArchived).toBe(true);
    expect(project.archivedById).toBe('u-9');
    expect(bus.publish).toHaveBeenCalledTimes(1);
    const published = (bus.publish as jest.Mock).mock.calls[0][0] as {
      type: string;
      aggregateType: string;
      aggregateId: string;
    };
    expect(published.type).toBe(ProjectArchivedEvent.type);
    expect(published.aggregateType).toBe('Project');
    expect(published.aggregateId).toBe('p-1');
    expect(result).toBe(VIEW);
  });

  it('accepts a key in place of a UUID', async () => {
    const project = activeProject();
    project.pullEvents();
    const repo: Partial<ProjectRepository> = {
      findById: jest.fn(async () => null),
      findByKey: jest.fn(async () => project),
      save: jest.fn(async () => undefined),
      loadUpdateView: jest.fn(async () => VIEW),
    };
    const uc = new ArchiveProjectUseCase(repo as ProjectRepository, makeBus());

    await uc.execute({ projectId: 'ALP', actorId: 'u-9' });

    expect(repo.findById).toHaveBeenCalledWith('ALP');
    expect(repo.findByKey).toHaveBeenCalledWith('ALP');
    expect(project.isArchived).toBe(true);
  });

  it('throws 404 when the project does not exist', async () => {
    const repo: Partial<ProjectRepository> = {
      findById: jest.fn(async () => null),
      findByKey: jest.fn(async () => null),
    };
    const uc = new ArchiveProjectUseCase(repo as ProjectRepository, makeBus());

    await expect(
      uc.execute({ projectId: 'missing', actorId: 'u-1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws 409 when the project is already archived', async () => {
    const project = archivedProject();
    const repo = makeRepo(project);
    const bus = makeBus();
    const uc = new ArchiveProjectUseCase(repo, bus);

    await expect(
      uc.execute({ projectId: 'p-1', actorId: 'u-9' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repo.save).not.toHaveBeenCalled();
    expect(bus.publish).not.toHaveBeenCalled();
  });
});

describe('UnarchiveProjectUseCase', () => {
  it('unarchives a previously archived project + emits ProjectUnarchivedEvent', async () => {
    const project = archivedProject();
    const repo = makeRepo(project);
    const bus = makeBus();
    const uc = new UnarchiveProjectUseCase(repo, bus);

    await uc.execute({ projectId: 'p-1', actorId: 'u-9' });

    expect(project.isArchived).toBe(false);
    expect(project.archivedById).toBeNull();
    expect(bus.publish).toHaveBeenCalledTimes(1);
    const published = (bus.publish as jest.Mock).mock.calls[0][0] as {
      type: string;
    };
    expect(published.type).toBe(ProjectUnarchivedEvent.type);
  });

  it('throws 409 when the project is not archived', async () => {
    const project = activeProject();
    project.pullEvents();
    const repo = makeRepo(project);
    const bus = makeBus();
    const uc = new UnarchiveProjectUseCase(repo, bus);

    await expect(
      uc.execute({ projectId: 'p-1', actorId: 'u-9' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repo.save).not.toHaveBeenCalled();
    expect(bus.publish).not.toHaveBeenCalled();
  });

  it('accepts a key in place of a UUID', async () => {
    const project = archivedProject();
    const repo: Partial<ProjectRepository> = {
      findById: jest.fn(async () => null),
      findByKey: jest.fn(async () => project),
      save: jest.fn(async () => undefined),
      loadUpdateView: jest.fn(async () => VIEW),
    };
    const uc = new UnarchiveProjectUseCase(
      repo as ProjectRepository,
      makeBus(),
    );

    await uc.execute({ projectId: 'ALP', actorId: 'u-9' });

    expect(repo.findById).toHaveBeenCalledWith('ALP');
    expect(repo.findByKey).toHaveBeenCalledWith('ALP');
    expect(project.isArchived).toBe(false);
  });

  it('throws 404 when the project does not exist', async () => {
    const repo: Partial<ProjectRepository> = {
      findById: jest.fn(async () => null),
      findByKey: jest.fn(async () => null),
    };
    const uc = new UnarchiveProjectUseCase(
      repo as ProjectRepository,
      makeBus(),
    );

    await expect(
      uc.execute({ projectId: 'missing', actorId: 'u-1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
