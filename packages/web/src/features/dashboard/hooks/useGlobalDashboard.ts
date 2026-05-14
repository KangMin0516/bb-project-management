import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dashboardApi } from '@/features/dashboard/api'
import { issueRepository } from '@/features/issue/repository'

export function useGlobalDashboard() {
  const queryClient = useQueryClient()

  const dashboard = useQuery({
    queryKey: ['global-dashboard'],
    queryFn: dashboardApi.getMyDashboard,
  })

  const toggleFocus = useMutation({
    mutationFn: ({ projectId, issueId, focusDate }: { projectId: string; issueId: string; focusDate: string | null }) =>
      issueRepository.update(projectId, issueId, { focusDate }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['global-dashboard'] }),
  })

  return { data: dashboard.data, isLoading: dashboard.isLoading, toggleFocus }
}
