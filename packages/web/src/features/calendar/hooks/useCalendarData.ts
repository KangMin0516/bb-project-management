import { useQuery } from '@tanstack/react-query'
import { issueRepository } from '@/features/issue/repository'
import { projectRepository } from '@/features/project/repository'

/**
 * Calendar pulls up to 500 issues — far more than the 50-item default
 * paginated list, but bounded so a single tenant with 5000 open issues
 * doesn't melt the browser. Same shape as `useTimelineData`; both views
 * are date-driven and benefit from seeing the full project at once.
 */
const CALENDAR_LIMIT = 500

export function useCalendarData(projectId: string) {
  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectRepository.findOne(projectId),
    enabled: !!projectId,
  })

  const issuesQuery = useQuery({
    queryKey: ['issues', projectId, 'calendar'],
    queryFn: () =>
      issueRepository.findInProjectRaw(projectId, { limit: String(CALENDAR_LIMIT) }),
    enabled: !!projectId,
  })

  return {
    project: projectQuery.data,
    issues: issuesQuery.data?.items ?? [],
    isLoading: issuesQuery.isLoading,
  }
}
