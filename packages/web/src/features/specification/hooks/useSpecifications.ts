import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type SpecStatus } from '@/features/specification/api'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'
import { specRepository } from '@/features/specification/repository'

/**
 * Bundles the project's spec list + (optionally) one spec detail. Each
 * mutation invalidates the right key — update touches both list and
 * detail because the list shows the comment count which can shift.
 */
export function useSpecifications(projectId: string, selectedId: string | null) {
  const queryClient = useQueryClient()
  const enabled = !!projectId
  const invalidateList = () => queryClient.invalidateQueries({ queryKey: ['specifications', projectId] })
  const invalidateDetail = () => queryClient.invalidateQueries({ queryKey: ['specification', projectId, selectedId] })

  const list = useQuery({
    queryKey: ['specifications', projectId],
    queryFn: () => specRepository.findInProject(projectId),
    enabled,
  })

  const detail = useQuery({
    queryKey: ['specification', projectId, selectedId],
    queryFn: () => specRepository.findOne(projectId, selectedId!),
    enabled: enabled && !!selectedId,
  })

  const create = useMutation({
    mutationFn: (data: { title: string; content: string; category?: string }) => specRepository.create(projectId, data),
    onSuccess: invalidateList,
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to create specification'), 'error'),
  })

  const update = useMutation({
    mutationFn: (data: { content?: string; status?: SpecStatus }) => specRepository.update(projectId, selectedId!, data),
    onSuccess: () => { invalidateList(); invalidateDetail() },
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to update specification'), 'error'),
  })

  const remove = useMutation({
    mutationFn: () => specRepository.remove(projectId, selectedId!),
    onSuccess: invalidateList,
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to delete specification'), 'error'),
  })

  return { list: list.data, detail: detail.data, isLoading: list.isLoading, create, update, remove }
}
