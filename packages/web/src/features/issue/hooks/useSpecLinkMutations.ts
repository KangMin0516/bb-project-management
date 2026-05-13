import { useMutation, useQueryClient } from '@tanstack/react-query'
import { issueApi } from '@/features/issue/api'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'

/** Create / delete bundle for issue-to-spec links. */
export function useSpecLinkMutations(projectId: string, issueId: string, onCreated?: () => void) {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['issue', projectId, issueId] })

  const create = useMutation({
    mutationFn: (data: { specId: string; sectionSlug?: string }) =>
      issueApi.createSpecLink(projectId, issueId, data),
    onSuccess: () => { invalidate(); onCreated?.() },
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to link spec')),
  })

  const remove = useMutation({
    mutationFn: (linkId: string) => issueApi.deleteSpecLink(projectId, issueId, linkId),
    onSuccess: invalidate,
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to remove spec link')),
  })

  return { create, remove }
}
