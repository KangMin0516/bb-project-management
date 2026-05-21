import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { issueRepository } from '@/features/issue/repository'
import { projectRepository } from '@/features/project/repository'
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

  const project = useQuery({ queryKey: ['project', projectId], queryFn: () => projectRepository.findOne(projectId), enabled })
  const members = useQuery({ queryKey: ['members', projectId], queryFn: () => projectRepository.listMembers(projectId), enabled })
  const labels = useQuery({ queryKey: ['labels', projectId], queryFn: () => projectRepository.listLabels(projectId), enabled })
  const components = useQuery({ queryKey: ['components', projectId], queryFn: () => componentApi.list(projectId), enabled })

  const list = useQuery({
    queryKey: ['issues', projectId, listParams],
    queryFn: () => issueRepository.findInProjectRaw(projectId, listParams),
    enabled,
  })

  const invalidateList = () => {
    queryClient.invalidateQueries({ queryKey: ['issues', projectId] })
    // TOC sidebar / page depend on Module ↔ Epic parent links — any
    // list-side change (Epic re-parent inline, delete, …) can shift them.
    queryClient.invalidateQueries({ queryKey: ['toc', projectId] })
  }

  const epicChange = useMutation({
    mutationFn: ({ issueId, parentId }: { issueId: string; parentId: string | null }) =>
      issueRepository.update(projectId, issueId, { parentId }),
    onSuccess: invalidateList,
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to change epic'), 'error'),
  })

  const remove = useMutation({
    mutationFn: (issueId: string) => issueRepository.remove(projectId, issueId),
    onSuccess: invalidateList,
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to delete issue'), 'error'),
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
