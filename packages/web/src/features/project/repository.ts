import {
  projectApi,
  type ArchivedProject,
  type Project,
  type ProjectWithJoinStatus,
} from '@/features/project/api'

/**
 * Repository layer for Project. Mirrors the Issue repository pattern:
 * domain-named methods that hide the HTTP shape from callers.
 */
export const projectRepository = {
  /** Projects the current user is a member of. */
  findMine(): Promise<Project[]> {
    return projectApi.list()
  },

  /** Every project the user can see, with their membership/join status. */
  findAllWithMembership(): Promise<ProjectWithJoinStatus[]> {
    return projectApi.listAll()
  },

  /** One project with members + labels populated. */
  findOne: projectApi.get,

  /** Lifecycle. */
  create: projectApi.create,
  update: projectApi.update,
  remove: projectApi.delete,

  /** Archive (superuser-only). */
  archive: projectApi.archive,
  unarchive: projectApi.unarchive,
  listArchived(): Promise<ArchivedProject[]> {
    return projectApi.listArchived()
  },

  /** Member management. */
  listMembers: projectApi.listMembers,
  addMember: projectApi.addMember,
  updateMember: projectApi.updateMember,
  removeMember: projectApi.removeMember,

  /** Labels. */
  listLabels: projectApi.listLabels,
  createLabel: projectApi.createLabel,
  removeLabel: projectApi.removeLabel,
  seedLabels: projectApi.seedLabels,

  /** Join requests (admin-side). */
  listJoinRequests: projectApi.listJoinRequests,
  approveJoinRequest: projectApi.approveJoinRequest,
  rejectJoinRequest: projectApi.rejectJoinRequest,

  /** Join requests (requester-side). */
  myJoinRequests: projectApi.myJoinRequests,
  requestToJoin: projectApi.createJoinRequest,
  cancelJoinRequest: projectApi.cancelJoinRequest,
}

export type ProjectRepository = typeof projectRepository
