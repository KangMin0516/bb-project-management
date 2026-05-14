import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { projectRepository } from '@/features/project/repository'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'

export function useProjectLabels(projectId: string) {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['labels', projectId] })

  const labelsQuery = useQuery({
    queryKey: ['labels', projectId],
    queryFn: () => projectRepository.listLabels(projectId),
    enabled: !!projectId,
  })

  const create = useMutation({
    mutationFn: (data: { name: string; color: string }) => projectRepository.createLabel(projectId, data),
    onSuccess: invalidate,
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to create label')),
  })

  const seed = useMutation({
    mutationFn: () => projectRepository.seedLabels(projectId),
    onSuccess: invalidate,
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to seed labels')),
  })

  return { labels: labelsQuery.data, create, seed }
}
