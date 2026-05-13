import { useMutation, useQueryClient } from '@tanstack/react-query'
import { issueRepository } from '@/features/issue/repository'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'

/** Board-specific mutations: drag-drop reorder + status/parent updates from sub-task toggles. */
export function useBoardMutations(projectId: string) {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['board', projectId] })

  const reorder = useMutation({
    mutationFn: (args: { issueId: string; status: string; order: number }) =>
      issueRepository.reorder(projectId, args.issueId, { status: args.status, order: args.order }),
    onSuccess: invalidate,
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to reorder issue')),
  })

  const updateIssue = useMutation({
    mutationFn: (args: { issueId: string; data: { status?: string; parentId?: string | null } }) =>
      issueRepository.update(projectId, args.issueId, args.data),
    onSuccess: invalidate,
  })

  return { reorder, updateIssue }
}
