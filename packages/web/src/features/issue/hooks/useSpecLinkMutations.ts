import { useMutation, useQueryClient } from '@tanstack/react-query'
import { issueRepository } from '@/features/issue/repository'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'

/** Create / delete bundle for issue-to-spec links. */
export function useSpecLinkMutations(projectId: string, issueId: string, onCreated?: () => void) {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['issue', projectId, issueId] })

  const create = useMutation({
    mutationFn: (data: { specId: string; sectionSlug?: string }) =>
      issueRepository.createSpecLink(projectId, issueId, data),
    onSuccess: () => { invalidate(); onCreated?.() },
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to link spec'), 'error'),
  })

  const remove = useMutation({
    mutationFn: (linkId: string) => issueRepository.deleteSpecLink(projectId, issueId, linkId),
    onSuccess: invalidate,
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to remove spec link'), 'error'),
  })

  return { create, remove }
}
