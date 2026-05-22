import { useQuery } from '@tanstack/react-query'
import { issueRepository } from '@/features/issue/repository'
import { projectRepository } from '@/features/project/repository'
import { getMonthGrid } from '@/features/calendar/lib'

/**
 * Backend caps `limit` at 200 ([query-issue.dto.ts:@Max(200)]). The
 * calendar narrows the request to the visible month grid via the
 * `dueDateFrom` / `dueDateTo` filters (PM-53) so the cap only applies
 * to issues that would actually render — no silent data loss on large
 * projects with thousands of issues across many months.
 */
const CALENDAR_LIMIT = 200

export function useCalendarData(
  projectId: string,
  cursorMonth: Date,
  options: { includeArchived?: boolean } = {},
) {
  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectRepository.findOne(projectId),
    enabled: !!projectId,
  })

  // Grid covers padding days from prev/next months, so the range spans
  // ~35-42 days. Send the start of the first cell and the end of the
  // last cell as ISO instants.
  const grid = getMonthGrid(cursorMonth.getFullYear(), cursorMonth.getMonth())
  const firstCell = grid[0]
  const lastCell = grid[grid.length - 1]
  const dueDateFrom = new Date(
    firstCell.getFullYear(),
    firstCell.getMonth(),
    firstCell.getDate(),
    0, 0, 0, 0,
  ).toISOString()
  const dueDateTo = new Date(
    lastCell.getFullYear(),
    lastCell.getMonth(),
    lastCell.getDate(),
    23, 59, 59, 999,
  ).toISOString()

  const monthKey = `${cursorMonth.getFullYear()}-${cursorMonth.getMonth()}`
  const issuesQuery = useQuery({
    queryKey: ['issues', projectId, 'calendar', monthKey, options.includeArchived ? 'archived' : 'active'],
    queryFn: () =>
      issueRepository.findInProjectRaw(projectId, {
        limit: String(CALENDAR_LIMIT),
        dueDateFrom,
        dueDateTo,
        ...(options.includeArchived ? { includeArchived: 'true' } : {}),
      }),
    enabled: !!projectId,
  })

  return {
    project: projectQuery.data,
    issues: issuesQuery.data?.items ?? [],
    total: issuesQuery.data?.total ?? 0,
    isLoading: issuesQuery.isLoading,
  }
}
