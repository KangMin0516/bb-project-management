import { useRef, useState } from 'react'
import { useAuthStore } from '@/features/auth/store'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'

interface ProfileFormProps {
  isSaving: boolean
  onSave: (name: string) => void
}

/**
 * Avatar picker + name field. Avatar upload calls the auth store
 * directly because it manages the cached user data; name editing
 * routes through the parent's onSave.
 */
export default function ProfileForm({ isSaving, onSave }: ProfileFormProps) {
  const { user, uploadAvatar } = useAuthStore()
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(user?.name ?? '')

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await uploadAvatar(file)
      useToastStore.getState().addToast('Avatar updated')
    } catch (err) {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to upload avatar'))
    }
    e.target.value = ''
  }

  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
      <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Profile</h2>
      <div className="flex items-start gap-5">
        <div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleAvatarUpload}
          />
          <button
            onClick={() => avatarInputRef.current?.click()}
            className="group relative flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-lg font-medium text-primary-700 overflow-hidden"
            title="Change avatar"
          >
            {user?.avatar
              ? <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
              : user?.name?.charAt(0).toUpperCase()}
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 transition">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
          </button>
        </div>
        <div className="flex-1 space-y-3">
          <Field label="Email">
            <input
              value={user?.email ?? ''}
              disabled
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-400 dark:text-gray-500"
            />
          </Field>
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            />
          </Field>
          <button
            onClick={() => name && onSave(name)}
            disabled={!name || name === user?.name || isSaving}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">{label}</label>
      {children}
    </div>
  )
}
