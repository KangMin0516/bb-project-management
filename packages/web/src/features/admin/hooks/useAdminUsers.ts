import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { userRepository } from '@/entities/user/repository'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'

interface UseAdminUsersOptions {
  status: string
  search: string
  enabled: boolean
}

/**
 * Bundles every user-admin mutation (approve, reject, suspend, activate,
 * update, reset password, delete) with consistent toast feedback. Each
 * mutation invalidates `['admin-users']` so the table re-renders.
 */
export function useAdminUsers({ status, search, enabled }: UseAdminUsersOptions) {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-users'] })

  const list = useQuery({
    queryKey: ['admin-users', status, search],
    queryFn: () => userRepository.admin.list({ status: status || undefined, search: search || undefined }),
    enabled,
  })

  const approve = useMutation({
    mutationFn: (id: string) => userRepository.approve(id),
    onSuccess: () => { invalidate(); useToastStore.getState().addToast('User approved', 'success') },
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to approve user'), 'error'),
  })

  const reject = useMutation({
    mutationFn: (id: string) => userRepository.reject(id),
    onSuccess: () => { invalidate(); useToastStore.getState().addToast('User rejected', 'success') },
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to reject user'), 'error'),
  })

  const suspend = useMutation({
    mutationFn: (id: string) => userRepository.admin.suspend(id),
    onSuccess: () => { invalidate(); useToastStore.getState().addToast('User suspended', 'success') },
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to suspend user'), 'error'),
  })

  const activate = useMutation({
    mutationFn: (id: string) => userRepository.admin.activate(id),
    onSuccess: () => { invalidate(); useToastStore.getState().addToast('User activated', 'success') },
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to activate user'), 'error'),
  })

  const remove = useMutation({
    mutationFn: (id: string) => userRepository.admin.remove(id),
    onSuccess: () => { invalidate(); useToastStore.getState().addToast('User deleted', 'success') },
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to delete user'), 'error'),
  })

  const update = useMutation({
    mutationFn: (data: { id: string; name: string; email: string; isSuperuser: boolean }) =>
      userRepository.admin.update(data.id, { name: data.name, email: data.email, isSuperuser: data.isSuperuser }),
    onSuccess: () => { invalidate(); useToastStore.getState().addToast('User updated', 'success') },
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to update user'), 'error'),
  })

  const resetPassword = useMutation({
    mutationFn: (data: { id: string; newPassword: string }) => userRepository.admin.resetPassword(data.id, data.newPassword),
    onSuccess: () => useToastStore.getState().addToast('Password reset successfully', 'success'),
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to reset password'), 'error'),
  })

  return {
    users: list.data,
    approve,
    reject,
    suspend,
    activate,
    remove,
    update,
    resetPassword,
  }
}
