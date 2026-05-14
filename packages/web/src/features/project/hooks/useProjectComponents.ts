import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { componentApi, type Component, type CreateComponentPayload, type UpdateComponentPayload } from '@/features/project/component-api'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'

export function useProjectComponents(projectId: string) {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['components', projectId] })

  const componentsQuery = useQuery({
    queryKey: ['components', projectId],
    queryFn: () => componentApi.list(projectId),
    enabled: !!projectId,
  })

  const create = useMutation({
    mutationFn: (data: CreateComponentPayload) => componentApi.create(projectId, data),
    onSuccess: invalidate,
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to create component'), 'error'),
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateComponentPayload }) =>
      componentApi.update(projectId, id, data),
    onSuccess: invalidate,
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to update component'), 'error'),
  })

  const remove = useMutation({
    mutationFn: (id: string) => componentApi.delete(projectId, id),
    onSuccess: invalidate,
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to delete component'), 'error'),
  })

  return { components: componentsQuery.data, create, update, remove }
}

export type { Component }
