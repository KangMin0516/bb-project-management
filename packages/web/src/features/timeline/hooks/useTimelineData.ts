import { useQuery } from '@tanstack/react-query'
import { issueApi } from '@/features/issue/api'
import { projectApi } from '@/features/project/api'

/**
 * The two queries every timeline screen needs: the project (for header) and
 * the issue list (capped at 200 — timelines should chart visible work, not
 * paginate). Keys mirror the conventions used elsewhere so cross-feature
 * mutations invalidate consistently.
 */
export function useTimelineData(projectId: string) {
  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectApi.get(projectId),
    enabled: !!projectId,
  })

  const issuesQuery = useQuery({
    queryKey: ['issues', projectId, 'timeline'],
    queryFn: () => issueApi.list(projectId, { limit: '200' }),
    enabled: !!projectId,
  })

  return {
    project: projectQuery.data,
    issues: issuesQuery.data?.items ?? [],
    isLoading: issuesQuery.isLoading,
  }
}
