import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  PROJECT_REPOSITORY,
  type ProjectRepository,
  type ProjectWithMembersAndCount,
} from './ports/project.repository.js';
import { Project, ProjectDomainError } from '../domain/project.entity.js';

const DEFAULT_LABELS = [
  { name: 'Bug', color: '#EF4444' },
  { name: 'Feature', color: '#3B82F6' },
  { name: 'Improvement', color: '#8B5CF6' },
  { name: 'Documentation', color: '#6B7280' },
  { name: 'Urgent', color: '#F59E0B' },
  { name: 'Design', color: '#EC4899' },
];

export interface CreateProjectCommand {
  name: string;
  key: string;
  description?: string;
  creatorId: string;
}

/**
 * Create a new project with:
 *  - key uniqueness pre-check (P-C1)
 *  - creator added as ADMIN (P-C2)
 *  - all ACTIVE superusers auto-added as ADMIN (P-C3)
 *  - 6 default labels seeded (P-C4) with skipDuplicates (P-C5)
 *  - **atomically** — single `$transaction` (fixes P7)
 */
@Injectable()
export class CreateProjectUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly repo: ProjectRepository,
  ) {}

  async execute(
    cmd: CreateProjectCommand,
  ): Promise<ProjectWithMembersAndCount> {
    // Pre-check uniqueness so we can return a friendlier message than
    // the raw P2002 → 409 from the global filter. (Race with concurrent
    // create still surfaces via the DB unique index, mapped to 409 by
    // GlobalExceptionFilter.)
    const existing = await this.repo.findByKey(cmd.key);
    if (existing) {
      throw new ConflictException(`Project key "${cmd.key}" already exists`);
    }

    let project: Project;
    try {
      project = Project.create({
        id: randomUUID(),
        name: cmd.name,
        key: cmd.key,
        description: cmd.description,
        creatorId: cmd.creatorId,
      });
    } catch (err) {
      if (err instanceof ProjectDomainError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }

    const superuserIds = await this.repo.listActiveSuperuserIds();
    const memberUserIds = [
      ...new Set<string>([cmd.creatorId, ...superuserIds]),
    ];

    return this.repo.createAtomic(project, memberUserIds, DEFAULT_LABELS);
  }
}
