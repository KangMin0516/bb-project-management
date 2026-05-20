import { useQuery } from '@tanstack/react-query'
import { issueRepository } from '@/features/issue/repository'
import { projectRepository } from '@/features/project/repository'

/**
 * Calendar pulls the same 200-issue batch as Timeline. The backend caps
 * the list endpoint at `@Max(200)` on `limit` ([query-issue.dto.ts]) —
 * an earlier draft passed 500 here and silently got 400'd, leaving the
 * grid empty even when issues had `dueDate` set.
 */
const CALENDAR_LIMIT = 200

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
