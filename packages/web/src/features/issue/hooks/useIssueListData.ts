import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { issueApi } from '@/features/issue/api'
import { projectApi } from '@/features/project/api'
import { componentApi } from '@/features/project/component-api'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'

interface UseIssueListDataOptions {
  projectId: string
  /** Query params already serialised by the page (limit, status, sort, etc.). */
  listParams: Record<string, string>
}

/**
 * The data bundle behind the issues list view: project metadata, the
 * project's members/labels/components for filter chips, the paginated
 * issue list, and the two mutations the page can fire (epic-change +
 * delete). All cache invalidations route through one helper.
 */
export function useIssueListData({ projectId, listParams }: UseIssueListDataOptions) {
  const queryClient = useQueryClient()
  const enabled = !!projectId

  const project = useQuery({ queryKey: ['project', projectId], queryFn: () => projectApi.get(projectId), enabled })
  const members = useQuery({ queryKey: ['members', projectId], queryFn: () => projectApi.listMembers(projectId), enabled })
  const labels = useQuery({ queryKey: ['labels', projectId], queryFn: () => projectApi.listLabels(projectId), enabled })
  const components = useQuery({ queryKey: ['components', projectId], queryFn: () => componentApi.list(projectId), enabled })

  const list = useQuery({
    queryKey: ['issues', projectId, listParams],
    queryFn: () => issueApi.list(projectId, listParams),
    enabled,
  })

  const invalidateList = () => queryClient.invalidateQueries({ queryKey: ['issues', projectId] })

  const epicChange = useMutation({
    mutationFn: ({ issueId, parentId }: { issueId: string; parentId: string | null }) =>
      issueApi.update(projectId, issueId, { parentId }),
    onSuccess: invalidateList,
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to change epic')),
  })

  const remove = useMutation({
    mutationFn: (issueId: string) => issueApi.delete(projectId, issueId),
    onSuccess: invalidateList,
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to delete issue')),
  })

  return {
    project: project.data,
    members: members.data,
    projectLabels: labels.data,
    projectComponents: components.data,
    list: list.data,
    isLoading: list.isLoading,
    epicChange,
    remove,
  }
}
