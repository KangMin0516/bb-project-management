import { useProfileMutations } from '@/features/auth/hooks/useProfileMutations'
import ProfileForm from '@/features/auth/components/ProfileForm'
import ChangePasswordForm from '@/features/auth/components/ChangePasswordForm'

export default function ProfilePage() {
  const { updateProfile, changePassword } = useProfileMutations()

  return (
    <div className="mx-auto max-w-xl space-y-8 p-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">My Profile</h1>

      <ProfileForm
        isSaving={updateProfile.isPending}
        onSave={(name) => updateProfile.mutate({ name })}
      />

      <ChangePasswordForm
        isChanging={changePassword.isPending}
        onChange={(data) => changePassword.mutate(data)}
      />
    </div>
  )
}
