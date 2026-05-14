import { useState } from 'react'
import type { AdminUser } from '@/entities/user/api'
import ModalDialog from './ModalDialog'

interface ResetPasswordModalProps {
  user: AdminUser
  isPending: boolean
  onReset: (newPassword: string) => void
  onClose: () => void
}

export default function ResetPasswordModal({ user, isPending, onReset, onClose }: ResetPasswordModalProps) {
  const [newPassword, setNewPassword] = useState('')
  const canSubmit = newPassword.length >= 8 && !isPending

  return (
    <ModalDialog title={`Reset Password for ${user.name}`} onClose={onClose}>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">New Password</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Minimum 8 characters"
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
        />
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
          Cancel
        </button>
        <button
          onClick={() => onReset(newPassword)}
          disabled={!canSubmit}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {isPending ? 'Resetting...' : 'Reset Password'}
        </button>
      </div>
    </ModalDialog>
  )
}
