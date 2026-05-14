import { useState } from 'react'
import { ShieldCheck, ShieldOff } from 'lucide-react'
import type { AdminUser } from '@/entities/user/api'
import ModalDialog from '@/features/admin/components/ModalDialog'

interface EditUserModalProps {
  user: AdminUser
  isPending: boolean
  onSave: (data: { id: string; name: string; email: string; isSuperuser: boolean }) => void
  onClose: () => void
}

export default function EditUserModal({ user, isPending, onSave, onClose }: EditUserModalProps) {
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [isSuperuser, setIsSuperuser] = useState(user.isSuperuser)

  const submit = () => onSave({ id: user.id, name, email, isSuperuser })

  return (
    <ModalDialog title="Edit User" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
          />
        </Field>
        <Field label="Email">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
          />
        </Field>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={isSuperuser}
            onChange={(e) => setIsSuperuser(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600"
          />
          Superuser
          {isSuperuser ? <ShieldCheck className="h-4 w-4 text-indigo-500" /> : <ShieldOff className="h-4 w-4 text-gray-400 dark:text-gray-500" />}
        </label>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={!name || !email || isPending}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {isPending ? 'Saving...' : 'Save'}
        </button>
      </div>
    </ModalDialog>
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
