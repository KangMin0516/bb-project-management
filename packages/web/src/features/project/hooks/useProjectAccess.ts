import { useQuery } from '@tanstack/react-query'
import { projectRepository } from '@/features/project/repository'
import { useAuthStore } from '@/features/auth/store'
import type { ProjectWithJoinStatus } from '@/features/project/api'

interface ProjectAccess {
  isLoading: boolean
  project: ProjectWithJoinStatus | null
  isMember: boolean
}

/**
 * Resolve a project (by id or key) from the shared `projects-all` cache
 * and decide whether the current user can view its sub-routes. Superusers
 * bypass membership exactly like the backend `ProjectMemberGuard`.
 */
export function useProjectAccess(projectIdOrKey: string | undefined): ProjectAccess {
  const user = useAuthStore((s) => s.user)
  const query = useQuery({
    queryKey: ['projects-all'],
    queryFn: projectRepository.findAllWithMembership,
    enabled: !!user,
  })

  if (!projectIdOrKey) return { isLoading: false, project: null, isMember: false }
  if (query.isLoading) return { isLoading: true, project: null, isMember: false }

  const project =
    query.data?.find((p) => p.id === projectIdOrKey || p.key === projectIdOrKey) ?? null
  const isMember = !!project?.isMember || !!user?.isSuperuser
  return { isLoading: false, project, isMember }
}
