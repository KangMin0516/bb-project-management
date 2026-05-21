import { useMemo } from 'react'
import { useAuthStore } from '@/features/auth/store'
import { useProjectMembers } from '@/features/project/hooks/useProjectMembers'

export type ProjectRole = 'ADMIN' | 'PM' | 'DEVELOPER' | null

/**
 * Resolve the caller's role on `projectId`. Returns `null` while the
 * member list is loading or the user isn't a member.
 *
 * Used to gate share-link UI (Share button, manage page) to PM↑.
 * Permission is also enforced server-side — this is purely so the UI
 * doesn't dangle a button that always 403s.
 */
export function useProjectRole(projectId: string | undefined): ProjectRole {
  const userId = useAuthStore((s) => s.user?.id)
  const { members } = useProjectMembers(projectId ?? '')
  return useMemo(() => {
    if (!userId || !members) return null
    const me = members.find((m) => m.userId === userId)
    return (me?.role as ProjectRole) ?? null
  }, [userId, members])
}

export function isPmOrAdmin(role: ProjectRole): boolean {
  return role === 'ADMIN' || role === 'PM'
}
