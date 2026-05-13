import { userApi, type User, type AdminUser } from '@/entities/user/api'

/**
 * Repository layer for User. Splits the two access tiers:
 * - `userRepository.search()` / `findOne()` for member-style lookups
 *   any logged-in user can hit
 * - `userRepository.admin.*` for the superuser-only admin panel
 */
export const userRepository = {
  /** Search visible users by name/email. Empty string = "all visible users". */
  search(query?: string): Promise<User[]> {
    return userApi.list(query)
  },

  /** Lookup a single user by id. */
  findOne(id: string): Promise<User> {
    return userApi.get(id)
  },

  /** Pending-registration users awaiting superuser approval. */
  findPendingApproval: userApi.listPending,
  approve: userApi.approve,
  reject: userApi.reject,

  /** Superuser-only operations. Grouped to keep call sites unambiguous. */
  admin: {
    list: userApi.adminList,
    update: userApi.adminUpdate,
    resetPassword: userApi.adminResetPassword,
    suspend: userApi.adminSuspend,
    activate: userApi.adminActivate,
    remove: userApi.adminDelete,
  },
}

export type UserRepository = typeof userRepository
export type { User, AdminUser }
