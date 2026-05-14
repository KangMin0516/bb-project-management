import { describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, ConflictException } from '@nestjs/common';
import type { ProjectRepository } from './ports/project.repository.js';
import { Project } from '../domain/project.entity.js';
import { CreateProjectUseCase } from './create-project.use-case.js';

function makeRepo(
  overrides: Partial<ProjectRepository> = {},
): ProjectRepository {
  return {
    findById: jest.fn(),
    findByKey: jest.fn(async () => null),
    save: jest.fn(),
    delete: jest.fn(),
    createAtomic: jest.fn(async (project: Project, members, labels) => ({
      id: project.id,
      name: project.name,
      key: project.key,
      description: project.description,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      members: members.map((userId) => ({
        id: `m-${userId}`,
        role: 'ADMIN' as const,
        user: { id: userId, email: `${userId}@x`, name: userId, avatar: null },
      })),
      _count: { issues: 0 },
      __labelsSeeded: labels.length,
    })),
    listForUser: jest.fn(async () => []),
    listAllWithMembership: jest.fn(async () => []),
    findWithDetails: jest.fn(),
    loadUpdateView: jest.fn(),
    listActiveSuperuserIds: jest.fn(async () => []),
    ...overrides,
  } as unknown as ProjectRepository;
}

describe('CreateProjectUseCase', () => {
  it('throws Conflict when key already exists (P-C1)', async () => {
    const existing = Project.create({
      id: 'p-old',
      name: 'old',
      key: 'ALP',
      creatorId: 'u-x',
    });
    const repo = makeRepo({ findByKey: jest.fn(async () => existing) });
    const uc = new CreateProjectUseCase(repo);

    await expect(
      uc.execute({ name: 'Alpha', key: 'ALP', creatorId: 'u-1' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws BadRequest on invalid key format', async () => {
    const uc = new CreateProjectUseCase(makeRepo());

    await expect(
      uc.execute({ name: 'Alpha', key: 'lower', creatorId: 'u-1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('seeds the 6 default labels (P-C4) on happy path', async () => {
    const createAtomic = jest.fn(async (project: Project, members, labels) => ({
      id: project.id,
      name: project.name,
      key: project.key,
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      members: [],
      _count: { issues: 0 },
      __labelsSeeded: labels.length,
    }));
    const repo = makeRepo({ createAtomic });
    const uc = new CreateProjectUseCase(repo);

    await uc.execute({ name: 'Alpha', key: 'ALP', creatorId: 'u-1' });

    const labelsArg = (createAtomic as jest.Mock).mock.calls[0][2] as Array<{
      name: string;
    }>;
    expect(labelsArg).toHaveLength(6);
    expect(labelsArg.map((l) => l.name)).toEqual([
      'Bug',
      'Feature',
      'Improvement',
      'Documentation',
      'Urgent',
      'Design',
    ]);
  });

  it('adds creator + all ACTIVE superusers as ADMIN (P-C2/P-C3)', async () => {
    const createAtomic = jest.fn(async (project: Project, members, labels) => ({
      id: project.id,
      name: project.name,
      key: project.key,
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      members: [],
      _count: { issues: 0 },
      __labelsSeeded: labels.length,
    }));
    const repo = makeRepo({
      listActiveSuperuserIds: jest.fn(async () => ['u-super-1', 'u-super-2']),
      createAtomic,
    });
    const uc = new CreateProjectUseCase(repo);

    await uc.execute({ name: 'Alpha', key: 'ALP', creatorId: 'u-creator' });

    const membersArg = (createAtomic as jest.Mock).mock.calls[0][1] as string[];
    expect(membersArg.sort()).toEqual(
      ['u-creator', 'u-super-1', 'u-super-2'].sort(),
    );
  });

  it('de-duplicates when the creator is also a superuser', async () => {
    const createAtomic = jest.fn(async (project: Project, members, labels) => ({
      id: project.id,
      name: project.name,
      key: project.key,
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      members: [],
      _count: { issues: 0 },
      __labelsSeeded: labels.length,
    }));
    const repo = makeRepo({
      listActiveSuperuserIds: jest.fn(async () => ['u-creator']),
      createAtomic,
    });
    const uc = new CreateProjectUseCase(repo);

    await uc.execute({ name: 'Alpha', key: 'ALP', creatorId: 'u-creator' });

    const membersArg = (createAtomic as jest.Mock).mock.calls[0][1] as string[];
    expect(membersArg).toEqual(['u-creator']);
  });
});
