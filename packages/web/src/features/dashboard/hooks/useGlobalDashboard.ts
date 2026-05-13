import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dashboardApi } from '@/features/dashboard/api'
import { issueApi } from '@/features/issue/api'

export function useGlobalDashboard() {
  const queryClient = useQueryClient()

  const dashboard = useQuery({
    queryKey: ['global-dashboard'],
    queryFn: dashboardApi.getMyDashboard,
  })

  const toggleFocus = useMutation({
    mutationFn: ({ projectId, issueId, focusDate }: { projectId: string; issueId: string; focusDate: string | null }) =>
      issueApi.update(projectId, issueId, { focusDate }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['global-dashboard'] }),
  })

  return { data: dashboard.data, isLoading: dashboard.isLoading, toggleFocus }
}
