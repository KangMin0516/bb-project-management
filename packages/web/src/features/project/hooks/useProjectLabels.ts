import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { projectApi } from '@/features/project/api'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'

export function useProjectLabels(projectId: string) {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['labels', projectId] })

  const labelsQuery = useQuery({
    queryKey: ['labels', projectId],
    queryFn: () => projectApi.listLabels(projectId),
    enabled: !!projectId,
  })

  const create = useMutation({
    mutationFn: (data: { name: string; color: string }) => projectApi.createLabel(projectId, data),
    onSuccess: invalidate,
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to create label')),
  })

  const seed = useMutation({
    mutationFn: () => projectApi.seedLabels(projectId),
    onSuccess: invalidate,
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to seed labels')),
  })

  return { labels: labelsQuery.data, create, seed }
}
