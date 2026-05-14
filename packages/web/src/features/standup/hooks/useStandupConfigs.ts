import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { standupApi } from '@/features/standup/api'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'

/**
 * Returns the standup config list + create/update/delete/trigger/toggle
 * mutations. Toggling enabled fires `updateConfig` so the timestamp +
 * audit trail behave like any other edit.
 */
export function useStandupConfigs() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['standup-configs'] })

  const query = useQuery({ queryKey: ['standup-configs'], queryFn: standupApi.listConfigs })

  const create = useMutation({
    mutationFn: (data: Record<string, unknown>) => standupApi.createConfig(data),
    onSuccess: () => {
      invalidate()
      useToastStore.getState().addToast('Config created')
    },
    onError: (err) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed')),
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => standupApi.updateConfig(id, data),
    onSuccess: () => {
      invalidate()
      useToastStore.getState().addToast('Config updated')
    },
    onError: (err) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed')),
  })

  const remove = useMutation({
    mutationFn: (id: string) => standupApi.deleteConfig(id),
    onSuccess: invalidate,
    onError: (err) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed')),
  })

  const trigger = useMutation({
    mutationFn: (id: string) => standupApi.triggerConfig(id),
    onSuccess: () => useToastStore.getState().addToast('Standup triggered!'),
    onError: (err) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed')),
  })

  const toggleEnabled = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => standupApi.updateConfig(id, { enabled }),
    onSuccess: invalidate,
  })

  return { configs: query.data ?? [], create, update, remove, trigger, toggleEnabled }
}
