import { useMutation, useQueryClient } from '@tanstack/react-query'
import { projectApi } from '@/features/project/api'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'

/**
 * Project-level update and delete mutations. `onDeleted` runs after a
 * successful delete (typically a redirect — there's no project to
 * invalidate once it's gone).
 */
export function useProjectMutations(projectId: string, onDeleted?: () => void) {
  const queryClient = useQueryClient()

  const update = useMutation({
    mutationFn: (data: { name: string; description?: string }) => projectApi.update(projectId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to update project')),
  })

  const remove = useMutation({
    mutationFn: () => projectApi.delete(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      onDeleted?.()
    },
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to delete project')),
  })

  return { update, remove }
}
