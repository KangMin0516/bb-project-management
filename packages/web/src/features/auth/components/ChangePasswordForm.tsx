import { useState } from 'react'

interface ChangePasswordFormProps {
  isChanging: boolean
  onChange: (data: { currentPassword: string; newPassword: string }) => void
  onSuccess?: () => void
}

const MIN_PASSWORD_LENGTH = 8

export default function ChangePasswordForm({ isChanging, onChange, onSuccess }: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')

  const submit = () => {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters`)
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setError('')
    onChange({ currentPassword, newPassword })
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    onSuccess?.()
  }

  const canSubmit = currentPassword && newPassword && confirmPassword && !isChanging

  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
      <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Change Password</h2>
      <div className="space-y-3">
        <PasswordField label="Current Password" value={currentPassword} onChange={setCurrentPassword} />
        <PasswordField label="New Password" value={newPassword} onChange={setNewPassword} />
        <PasswordField label="Confirm New Password" value={confirmPassword} onChange={setConfirmPassword} />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {isChanging ? 'Changing...' : 'Change Password'}
        </button>
      </div>
    </section>
  )
}

function PasswordField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">{label}</label>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
      />
    </div>
  )
}
