import { validateProjectKey, type ProjectKeyError } from './project-key.vo.js';
import { ProjectCreatedEvent } from './events/project-created.event.js';

export type ProjectDomainErrorCode = ProjectKeyError | 'INVARIANT';

export class ProjectDomainError extends Error {
  constructor(
    readonly code: ProjectDomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ProjectDomainError';
  }
}

export interface ProjectProps {
  id: string;
  name: string;
  key: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewProjectInput {
  id: string;
  name: string;
  key: string;
  description?: string | null;
  creatorId: string;
}

/**
 * Project aggregate-ish root. Business rules are thin (this is mostly
 * a labelled bag of issues) — the entity exists primarily for key
 * validation, the creation event, and a uniform place to put any
 * rename / archive / scope-change logic that gets added later.
 */
export class Project {
  private readonly _events: object[] = [];

  private constructor(private props: ProjectProps) {}

  // ─── Factory ──────────────────────────────────────────────

  static create(input: NewProjectInput, now: Date = new Date()): Project {
    const keyErr = validateProjectKey(input.key);
    if (keyErr) throw new ProjectDomainError(keyErr, keyMessage(keyErr));
    const name = input.name.trim();
    if (!name) {
      throw new ProjectDomainError('INVARIANT', 'Project name is required');
    }

    const project = new Project({
      id: input.id,
      name,
      key: input.key,
      description: (input.description ?? '').trim() || null,
      createdAt: now,
      updatedAt: now,
    });

    project._events.push(
      new ProjectCreatedEvent(project.id, project.key, input.creatorId, now),
    );
    return project;
  }

  static fromPersistence(props: ProjectProps): Project {
    return new Project(props);
  }

  // ─── Read accessors ───────────────────────────────────────

  get id() {
    return this.props.id;
  }
  get name() {
    return this.props.name;
  }
  get key() {
    return this.props.key;
  }
  get description() {
    return this.props.description;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }

  toJSON(): Readonly<ProjectProps> {
    return { ...this.props };
  }

  pullEvents(): object[] {
    const out = this._events.slice();
    this._events.length = 0;
    return out;
  }

  // ─── Behaviours ───────────────────────────────────────────

  /**
   * Apply partial updates to mutable fields. Only `name` and
   * `description` are mutable — the key is immutable post-create to
   * keep issue ID stability (issues reference projectId, but display
   * the key as "<KEY>-N" which would silently change otherwise).
   */
  update(
    changes: { name?: string; description?: string | null },
    now: Date = new Date(),
  ): void {
    if (changes.name !== undefined) {
      const name = changes.name.trim();
      if (!name) {
        throw new ProjectDomainError('INVARIANT', 'Project name is required');
      }
      this.props.name = name;
    }
    if (changes.description !== undefined) {
      const desc = (changes.description ?? '').trim() || null;
      this.props.description = desc;
    }
    this.props.updatedAt = now;
  }
}

function keyMessage(code: ProjectKeyError): string {
  switch (code) {
    case 'EMPTY':
      return 'Project key is required';
    case 'TOO_LONG':
      return 'Project key must be 16 characters or fewer';
    case 'INVALID_CHARS':
      return 'Project key must start with an uppercase letter and contain only A–Z, 0–9, _';
  }
}
