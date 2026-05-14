import { useQuery } from '@tanstack/react-query'
import { issueRepository } from '@/features/issue/repository'
import { projectRepository } from '@/features/project/repository'

/**
 * The two queries every timeline screen needs: the project (for header) and
 * the issue list (capped at 200 — timelines should chart visible work, not
 * paginate). Keys mirror the conventions used elsewhere so cross-feature
 * mutations invalidate consistently.
 */
export function useTimelineData(projectId: string) {
  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectRepository.findOne(projectId),
    enabled: !!projectId,
  })

  const issuesQuery = useQuery({
    queryKey: ['issues', projectId, 'timeline'],
    queryFn: () => issueRepository.findInProjectRaw(projectId, { limit: '200' }),
    enabled: !!projectId,
  })

  return {
    project: projectQuery.data,
    issues: issuesQuery.data?.items ?? [],
    isLoading: issuesQuery.isLoading,
  }
}
