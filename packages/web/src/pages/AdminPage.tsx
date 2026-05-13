import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useAuthStore } from '@/features/auth/store'
import { useAdminUsers } from '@/features/admin/hooks/useAdminUsers'
import { useDebouncedValue } from '@/shared/lib/useDebouncedValue'
import { DEBOUNCE_DELAY } from '@/shared/config/constants'
import TabSwitcher from '@/shared/ui/atoms/TabSwitcher'
import AdminUserRow from '@/features/admin/components/AdminUserRow'
import EditUserModal from '@/features/admin/components/EditUserModal'
import ResetPasswordModal from '@/features/admin/components/ResetPasswordModal'
import type { AdminUser } from '@/entities/user/api'

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'REJECTED', label: 'Rejected' },
] as const

/**
 * Superuser-only user management. Filters + search are driven by URL-
 * agnostic local state (no need to share the filter externally), and
 * mutations are bundled in useAdminUsers for consistent toast behaviour.
 */
export default function AdminPage() {
  const currentUser = useAuthStore((s) => s.user)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, DEBOUNCE_DELAY)

  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [resetPasswordUser, setResetPasswordUser] = useState<AdminUser | null>(null)

  const admin = useAdminUsers({
    status: statusFilter,
    search: debouncedSearch,
    enabled: !!currentUser?.isSuperuser,
  })

  if (!currentUser?.isSuperuser) return <Navigate to="/" replace />

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">User Management</h1>

      <div className="flex items-center gap-4">
        <TabSwitcher options={STATUS_TABS} value={statusFilter} onChange={setStatusFilter} />
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none"
          />
        </div>
      </div>

      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {admin.users?.map((u) => (
            <AdminUserRow
              key={u.id}
              user={u}
              currentUserId={currentUser.id}
              onApprove={(id) => admin.approve.mutate(id)}
              onReject={(id) => admin.reject.mutate(id)}
              onSuspend={(id) => admin.suspend.mutate(id)}
              onActivate={(id) => admin.activate.mutate(id)}
              onEdit={setEditingUser}
              onResetPassword={setResetPasswordUser}
              onDelete={(id) => admin.remove.mutate(id)}
            />
          ))}
          {admin.users?.length === 0 && (
            <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">No users found</div>
          )}
        </div>
      </section>

      {editingUser && (
        <EditUserModal
          user={editingUser}
          isPending={admin.update.isPending}
          onSave={(data) => {
            admin.update.mutate(data, { onSuccess: () => setEditingUser(null) })
          }}
          onClose={() => setEditingUser(null)}
        />
      )}

      {resetPasswordUser && (
        <ResetPasswordModal
          user={resetPasswordUser}
          isPending={admin.resetPassword.isPending}
          onReset={(newPassword) => {
            admin.resetPassword.mutate(
              { id: resetPasswordUser.id, newPassword },
              { onSuccess: () => setResetPasswordUser(null) },
            )
          }}
          onClose={() => setResetPasswordUser(null)}
        />
      )}
    </div>
  )
}
