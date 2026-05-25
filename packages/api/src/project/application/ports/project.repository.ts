import type { Project } from '../../domain/project.entity.js';

export const PROJECT_REPOSITORY = Symbol('PROJECT_REPOSITORY');

// ─── Read-view DTOs ─────────────────────────────────────────
// Returned from the list/find-with-details helpers. They are shaped
// to match the legacy HTTP responses (verified against
// behavior-preservation-checklist §3). Controllers can pass them
// through without further mapping.

export interface ProjectMemberSummary {
  id: string;
  role: 'ADMIN' | 'PM' | 'DEVELOPER';
  user: { id: string; email: string; name: string; avatar: string | null };
}

export interface ProjectLabelSummary {
  id: string;
  name: string;
  color: string;
}

export interface ProjectWithCounts {
  id: string;
  name: string;
  key: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count: { issues: number; members: number };
}

export interface ProjectWithMembership {
  id: string;
  name: string;
  key: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count: { issues: number; members: number };
  isMember: boolean;
  myRole: 'ADMIN' | 'PM' | 'DEVELOPER' | null;
  pendingJoinRequest: { id: string; status: string } | null;
}

export interface ProjectWithDetails {
  id: string;
  name: string;
  key: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  members: ProjectMemberSummary[];
  labels: ProjectLabelSummary[];
  _count: { issues: number };
}

/** Shape returned by `createAtomic` — feeds the controller's
 *  create-response, identical to the legacy `prisma.project.create`
 *  with member include. `archivedAt` / `archivedById` are surfaced
 *  here so the archive / unarchive responses are distinguishable from
 *  a plain update. */
export interface ProjectWithMembersAndCount {
  id: string;
  name: string;
  key: string;
  description: string | null;
  archivedAt: Date | null;
  archivedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  members: ProjectMemberSummary[];
  _count: { issues: number };
}

export interface DefaultLabelSeed {
  name: string;
  color: string;
}

/** Row returned by `listArchived` for the superuser-only archived tab. */
export interface ArchivedProjectView {
  id: string;
  name: string;
  key: string;
  description: string | null;
  archivedAt: Date;
  archivedBy: { id: string; name: string; email: string } | null;
  issueCount: { total: number; done: number };
}

export interface ProjectRepository {
  // ── Aggregate ops ────────────────────────────────────────
  /** Includes archived rows — domain layer needs the full state. */
  findById(id: string): Promise<Project | null>;
  findByKey(key: string): Promise<Project | null>;
  save(project: Project): Promise<void>;
  delete(id: string): Promise<void>;

  /**
   * Atomic create. Fixes the P7 split-transaction bug from the legacy
   * service: project row + initial members + default label rows are
   * all committed (or rolled back) together. Returns the inflated
   * row with members for the response.
   */
  createAtomic(
    project: Project,
    memberUserIds: string[],
    defaultLabels: DefaultLabelSeed[],
  ): Promise<ProjectWithMembersAndCount>;

  // ── Read views ────────────────────────────────────────────
  // All read views exclude archived projects unless the caller passes
  // `includeArchived: true`. Archive is a soft delete for non-superuser
  // surfaces (lists, sidebar, project detail).
  listForUser(userId: string): Promise<ProjectWithCounts[]>;
  listAllWithMembership(userId: string): Promise<ProjectWithMembership[]>;
  findWithDetails(
    idOrKey: string,
    opts?: { includeArchived?: boolean },
  ): Promise<ProjectWithDetails | null>;

  /** Snapshot-of-write for the update endpoint. */
  loadUpdateView(id: string): Promise<ProjectWithMembersAndCount | null>;

  /** Superuser-only — feeds the Archived tab. */
  listArchived(): Promise<ArchivedProjectView[]>;

  // ── Cross-domain helper ──────────────────────────────────
  /** Active superuser IDs — used by Create to auto-add them as ADMIN. */
  listActiveSuperuserIds(): Promise<string[]>;
}
