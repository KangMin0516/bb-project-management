import type { JoinRequest } from '../../domain/join-request.entity.js';

/**
 * Repository contract for the JoinRequest aggregate. Use cases depend
 * on this interface (via the JOIN_REQUEST_REPOSITORY symbol); the
 * Prisma implementation lives in infrastructure/.
 */
export const JOIN_REQUEST_REPOSITORY = Symbol('JOIN_REQUEST_REPOSITORY');

export interface ProjectMemberSummary {
  userId: string;
  role: 'ADMIN' | 'PM' | 'DEVELOPER';
}

export interface PendingForProjectListItem {
  request: JoinRequest;
  requester: { id: string; name: string; email: string; avatar: string | null };
}

export interface MyJoinRequestListItem {
  request: JoinRequest;
  project: { id: string; name: string; key: string };
}

export interface JoinRequestRepository {
  /** Lookup by id, regardless of status. */
  findById(id: string): Promise<JoinRequest | null>;

  /** Pending request for (requester, project) — used in duplicate check. */
  findActiveForRequester(
    requesterId: string,
    projectId: string,
  ): Promise<JoinRequest | null>;

  /** Persist a new or modified aggregate. */
  save(request: JoinRequest): Promise<void>;

  /** Hard-delete a request (cancel + re-request cleanup). */
  delete(id: string): Promise<void>;

  /** Lookup join request by id and project — throws if mismatch. */
  findInProject(id: string, projectId: string): Promise<JoinRequest | null>;

  // ── Cross-domain helpers required by use cases ─────────────
  //
  // These reach into Project / ProjectMember tables. Keeping them here
  // (vs separate ProjectMemberRepository) is pragmatic: every callsite
  // is the join-request flow, and they're trivial queries that don't
  // warrant a dedicated repository just for two methods.

  isMemberOfProject(userId: string, projectId: string): Promise<boolean>;

  /** Resolve project key → uuid, or pass UUID through unchanged. Returns null when not found. */
  resolveProjectId(idOrKey: string): Promise<string | null>;

  /** Project meta needed for notifications + Slack copy. */
  loadProjectMeta(
    projectId: string,
  ): Promise<{ id: string; name: string; key: string } | null>;

  /** Requester info for response payloads + notifications. */
  loadRequesterMeta(
    userId: string,
  ): Promise<{
    id: string;
    name: string;
    email: string;
    avatar: string | null;
  } | null>;

  /** Listings — return joined view objects rather than bare entities so
   *  the controller layer can render directly. */
  listPendingForProject(
    projectId: string,
  ): Promise<PendingForProjectListItem[]>;
  listForRequester(requesterId: string): Promise<MyJoinRequestListItem[]>;

  /** Admins + PMs of a project (for Slack DM fan-out on create). */
  listAdminsAndPms(
    projectId: string,
  ): Promise<{ userId: string; slackUserId: string | null }[]>;

  /**
   * Approve transaction: persist the request transition AND upsert the
   * project member in one `$transaction`. Kept on the repository
   * because the unit-of-work boundary is a persistence concern.
   */
  approveAndAddMember(request: JoinRequest): Promise<void>;
}
