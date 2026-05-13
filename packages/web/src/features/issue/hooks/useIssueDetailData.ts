import { useQuery } from '@tanstack/react-query'
import { issueApi } from '@/features/issue/api'
import { projectApi } from '@/features/project/api'
import { componentApi } from '@/features/project/component-api'

/**
 * Aggregates every query the IssueDetailPanel needs into one hook so the
 * panel can stay a composition root. Keys mirror the keys other features
 * already use so optimistic updates from the board / list flow through.
 *
 * @param skipEpics  Pass true when the open issue is itself an epic — we
 *                   don't need the epic dropdown on epics.
 */
export function useIssueDetailData(projectId: string, issueId: string, skipEpics: boolean) {
  const detailQuery = useQuery({
    queryKey: ['issue', projectId, issueId],
    queryFn: () => issueApi.get(projectId, issueId),
  })

  const membersQuery = useQuery({
    queryKey: ['members', projectId],
    queryFn: () => projectApi.listMembers(projectId),
  })

  const labelsQuery = useQuery({
    queryKey: ['labels', projectId],
    queryFn: () => projectApi.listLabels(projectId),
  })

  const componentsQuery = useQuery({
    queryKey: ['components', projectId],
    queryFn: () => componentApi.list(projectId),
  })

  const epicsQuery = useQuery({
    queryKey: ['issues', projectId, 'epics'],
    queryFn: () => issueApi.list(projectId, { type: 'EPIC', limit: '200' }),
    select: (data) => data.items,
    enabled: !skipEpics,
  })

  return {
    detail: detailQuery.data,
    members: membersQuery.data,
    projectLabels: labelsQuery.data,
    projectComponents: componentsQuery.data,
    epics: epicsQuery.data,
  }
}
