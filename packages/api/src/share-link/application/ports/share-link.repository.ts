/**
 * Repository port for ShareLink. Keeps domain decisions (`canUnlock`,
 * `recordFailure`) in the entity and persistence in the Prisma impl.
 *
 * Use-case → repo split mirrors IssueModule (refactor-plan §6.3 /
 * §7.6). Tests inject a fake repo; runtime wires `SHARE_LINK_REPOSITORY`
 * to `ShareLinkPrismaRepository` via the module provider.
 */

export const SHARE_LINK_REPOSITORY = Symbol('SHARE_LINK_REPOSITORY');

export type ShareScopeLiteral = 'TIMELINE' | 'BOARD' | 'CALENDAR' | 'LISTS';

export interface ShareLinkRow {
  id: string;
  token: string;
  passcodeHash: string;
  scopes: ShareScopeLiteral[];
  expiresAt: Date | null;
  revokedAt: Date | null;
  lastAccessedAt: Date | null;
  accessCount: number;
  failedAttempts: number;
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
  projectId: string;
  createdById: string;
}

export interface ShareLinkWithCreator extends ShareLinkRow {
  createdBy: { id: string; name: string; avatar: string | null };
}

export interface CreateShareLinkInput {
  token: string;
  passcodeHash: string;
  scopes: ShareScopeLiteral[];
  expiresAt: Date | null;
  projectId: string;
  createdById: string;
}

export interface ShareLinkRepository {
  create(input: CreateShareLinkInput): Promise<ShareLinkRow>;
  findByToken(token: string): Promise<ShareLinkRow | null>;
  findByIdScoped(id: string, projectId: string): Promise<ShareLinkRow | null>;
  findByProject(projectId: string): Promise<ShareLinkWithCreator[]>;
  recordSuccess(id: string, now: Date): Promise<void>;
  recordFailure(
    id: string,
    failedAttempts: number,
    lockedUntil: Date | null,
  ): Promise<void>;
  revoke(id: string, now: Date): Promise<ShareLinkRow>;
  rotatePasscode(id: string, passcodeHash: string): Promise<ShareLinkRow>;
  hardDelete(id: string): Promise<void>;
}
