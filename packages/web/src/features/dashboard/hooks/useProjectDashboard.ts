import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dashboardApi } from '@/features/dashboard/api'
import { issueApi } from '@/features/issue/api'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'

export function useProjectDashboard(projectId: string) {
  const queryClient = useQueryClient()

  const stats = useQuery({
    queryKey: ['dashboard', projectId],
    queryFn: () => dashboardApi.getStats(projectId),
    enabled: !!projectId,
  })

  const toggleFocus = useMutation({
    mutationFn: ({ issueId, focusDate }: { issueId: string; focusDate: string | null }) =>
      issueApi.update(projectId, issueId, { focusDate }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard', projectId] }),
    onError: (err) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to toggle focus'), 'error'),
  })

  return { stats: stats.data, isLoading: stats.isLoading, toggleFocus }
}
