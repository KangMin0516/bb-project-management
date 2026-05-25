import { useMutation, useQueryClient } from '@tanstack/react-query'
import { projectRepository } from '@/features/project/repository'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'

/**
 * Soft-archives a project. Superuser-only on the server; the UI hides
 * the trigger for everyone else. After success, every cache that lists
 * projects has to be refreshed so the project disappears from the
 * sidebar, dashboards and search.
 */
/**
 * Every query that aggregates across projects has to be refreshed
 * because an archived project must disappear (or reappear on
 * unarchive) from the sidebar, both dashboards, search and the
 * Archived tab itself.
 */
function invalidateAfterArchiveChange(
  queryClient: ReturnType<typeof useQueryClient>,
  projectId: string,
) {
  queryClient.invalidateQueries({ queryKey: ['projects'] })
  queryClient.invalidateQueries({ queryKey: ['projects-all'] })
  queryClient.invalidateQueries({ queryKey: ['projects-archived'] })
  queryClient.invalidateQueries({ queryKey: ['project', projectId] })
  queryClient.invalidateQueries({ queryKey: ['global-dashboard'] })
  queryClient.invalidateQueries({ queryKey: ['team-dashboard'] })
}

export function useArchiveProject(projectId: string, onSuccess?: () => void) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => projectRepository.archive(projectId),
    onSuccess: () => {
      invalidateAfterArchiveChange(queryClient, projectId)
      useToastStore.getState().addToast('Project archived', 'success')
      onSuccess?.()
    },
    onError: (err: unknown) => {
      useToastStore
        .getState()
        .addToast(getErrorMessage(err, 'Failed to archive project'), 'error')
    },
  })
}

export function useUnarchiveProject(projectId: string, onSuccess?: () => void) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => projectRepository.unarchive(projectId),
    onSuccess: () => {
      invalidateAfterArchiveChange(queryClient, projectId)
      useToastStore.getState().addToast('Project unarchived', 'success')
      onSuccess?.()
    },
    onError: (err: unknown) => {
      useToastStore
        .getState()
        .addToast(getErrorMessage(err, 'Failed to unarchive project'), 'error')
    },
  })
}
