import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/features/auth/api'
import { useAuthStore } from '@/features/auth/store'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'

/**
 * Profile + password mutations for the My Profile page. `loadUser` is
 * called after a successful update so the global auth store reflects
 * the new name immediately.
 */
export function useProfileMutations() {
  const loadUser = useAuthStore((s) => s.loadUser)

  const updateProfile = useMutation({
    mutationFn: (data: { name: string }) => authApi.updateProfile(data),
    onSuccess: () => {
      loadUser()
      useToastStore.getState().addToast('Profile updated')
    },
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to update profile')),
  })

  const changePassword = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) => authApi.changePassword(data),
    onSuccess: () => useToastStore.getState().addToast('Password changed successfully'),
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to change password')),
  })

  return { updateProfile, changePassword }
}
