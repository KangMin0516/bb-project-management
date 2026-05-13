import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { projectApi } from '@/features/project/api'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'

/**
 * Manages the member list + add/remove/role-update mutations for one
 * project. Centralising invalidation here means screens just call the
 * returned `add()` / `remove()` / `updateRole()` without touching cache.
 */
export function useProjectMembers(projectId: string) {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['members', projectId] })

  const membersQuery = useQuery({
    queryKey: ['members', projectId],
    queryFn: () => projectApi.listMembers(projectId),
    enabled: !!projectId,
  })

  const add = useMutation({
    mutationFn: (data: { userId: string; role: string }) => projectApi.addMember(projectId, data),
    onSuccess: invalidate,
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to add member')),
  })

  const remove = useMutation({
    mutationFn: (memberId: string) => projectApi.removeMember(projectId, memberId),
    onSuccess: invalidate,
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to remove member')),
  })

  const updateRole = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      projectApi.updateMember(projectId, memberId, { role }),
    onSuccess: invalidate,
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to update role')),
  })

  return { members: membersQuery.data, add, remove, updateRole }
}
