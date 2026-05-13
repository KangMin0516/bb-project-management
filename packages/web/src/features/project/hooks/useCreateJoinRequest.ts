import { useMutation, useQueryClient } from '@tanstack/react-query'
import { projectApi } from '@/features/project/api'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'

/**
 * Sends "request to join" for the projects-all list. Invalidates the
 * list so the pending-request state shows up immediately.
 */
export function useCreateJoinRequest(onSuccess?: () => void) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, message }: { projectId: string; message?: string }) =>
      projectApi.createJoinRequest(projectId, message ? { message } : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects-all'] })
      useToastStore.getState().addToast('Join request sent', 'success')
      onSuccess?.()
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to send join request'))
    },
  })
}
