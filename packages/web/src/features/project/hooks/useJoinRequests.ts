import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { projectRepository } from '@/features/project/repository'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'

/**
 * Returns the pending join-requests for a project plus approve/reject
 * actions. Skips the network call entirely when `enabled` is false —
 * non-admins shouldn't fire 403s.
 */
export function useJoinRequests(projectId: string, enabled: boolean) {
  const queryClient = useQueryClient()
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['join-requests', projectId] })
    queryClient.invalidateQueries({ queryKey: ['members', projectId] })
  }

  const requestsQuery = useQuery({
    queryKey: ['join-requests', projectId],
    queryFn: () => projectRepository.listJoinRequests(projectId),
    enabled: !!projectId && enabled,
  })

  const approve = useMutation({
    mutationFn: (requestId: string) => projectRepository.approveJoinRequest(projectId, requestId),
    onSuccess: invalidate,
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to approve request'), 'error'),
  })

  const reject = useMutation({
    mutationFn: ({ requestId, reason }: { requestId: string; reason?: string }) =>
      projectRepository.rejectJoinRequest(projectId, requestId, reason ? { reason } : undefined),
    onSuccess: invalidate,
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to reject request'), 'error'),
  })

  return { requests: requestsQuery.data, approve, reject }
}
