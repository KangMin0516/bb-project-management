import { useMutation, useQueryClient } from '@tanstack/react-query'
import { issueApi, type IssueLinkType } from '@/features/issue/api'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'

/**
 * Create / delete bundle for issue-to-issue links. Centralised so every
 * link UI piece (modal, row, future bulk actions) shares the same toast
 * + invalidation behaviour.
 */
export function useIssueLinkMutations(projectId: string, issueId: string, onCreated?: () => void) {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['issue', projectId, issueId] })

  const create = useMutation({
    mutationFn: (data: { targetIssueId: string; type: IssueLinkType }) =>
      issueApi.createLink(projectId, issueId, data),
    onSuccess: () => { invalidate(); onCreated?.() },
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to create link')),
  })

  const remove = useMutation({
    mutationFn: (linkId: string) => issueApi.deleteLink(projectId, issueId, linkId),
    onSuccess: invalidate,
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to delete link')),
  })

  return { create, remove }
}
