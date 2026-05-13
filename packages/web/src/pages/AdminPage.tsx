import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { userApi, type AdminUser } from '@/entities/user/api'
import { useAuthStore } from '@/features/auth/store'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'
import { Navigate } from 'react-router-dom'
import {
  Search,
  Check,
  X,
  Pencil,
  Trash2,
  KeyRound,
  ShieldCheck,
  ShieldOff,
  UserCheck,
  UserX,
} from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { DEBOUNCE_DELAY } from '@/shared/config/constants'
import { useImagePreviewStore } from '@/shared/lib/imagePreview'

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'REJECTED', label: 'Rejected' },
] as const

const statusBadge = (status: string) => {
  switch (status) {
    case 'ACTIVE':
      return 'bg-green-50 text-green-700'
    case 'PENDING':
      return 'bg-amber-50 text-amber-700'
    case 'REJECTED':
      return 'bg-red-50 text-red-700'
    default:
      return 'bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300'
  }
}

export default function AdminPage() {
  const currentUser = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()

  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editSuperuser, setEditSuperuser] = useState(false)
  const [resetPasswordUser, setResetPasswordUser] = useState<AdminUser | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), DEBOUNCE_DELAY)
    return () => clearTimeout(timer)
  }, [search])

  const { data: users } = useQuery({
    queryKey: ['admin-users', statusFilter, debouncedSearch],
    queryFn: () => userApi.adminList({ status: statusFilter || undefined, search: debouncedSearch || undefined }),
    enabled: !!currentUser?.isSuperuser,
  })

  const invalidateUsers = () => queryClient.invalidateQueries({ queryKey: ['admin-users'] })
  const updateUser = useMutation({
    mutationFn: () => userApi.adminUpdate(editingUser!.id, {
      name: editName,
      email: editEmail,
      isSuperuser: editSuperuser,
    }),
    onSuccess: () => { invalidateUsers(); setEditingUser(null); useToastStore.getState().addToast('User updated', 'success') },
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to update user'), 'error'),
  })

  const resetPassword = useMutation({
    mutationFn: () => userApi.adminResetPassword(resetPasswordUser!.id, newPassword),
    onSuccess: () => { setResetPasswordUser(null); setNewPassword(''); useToastStore.getState().addToast('Password reset successfully', 'success') },
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to reset password'), 'error'),
  })

  const suspendUser = useMutation({
    mutationFn: (id: string) => userApi.adminSuspend(id),
    onSuccess: () => { invalidateUsers(); useToastStore.getState().addToast('User suspended', 'success') },
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to suspend user'), 'error'),
  })

  const activateUser = useMutation({
    mutationFn: (id: string) => userApi.adminActivate(id),
    onSuccess: () => { invalidateUsers(); useToastStore.getState().addToast('User activated', 'success') },
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to activate user'), 'error'),
  })

  const approveUser = useMutation({
    mutationFn: (id: string) => userApi.approve(id),
    onSuccess: () => { invalidateUsers(); useToastStore.getState().addToast('User approved', 'success') },
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to approve user'), 'error'),
  })

  const rejectUser = useMutation({
    mutationFn: (id: string) => userApi.reject(id),
    onSuccess: () => { invalidateUsers(); useToastStore.getState().addToast('User rejected', 'success') },
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to reject user'), 'error'),
  })

  const deleteUser = useMutation({
    mutationFn: (id: string) => userApi.adminDelete(id),
    onSuccess: () => { invalidateUsers(); useToastStore.getState().addToast('User deleted', 'success') },
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to delete user'), 'error'),
  })

  const startEdit = (u: AdminUser) => {
    setEditingUser(u)
    setEditName(u.name)
    setEditEmail(u.email)
    setEditSuperuser(u.isSuperuser)
  }

  if (!currentUser?.isSuperuser) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">User Management</h1>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-gray-700 p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition',
                statusFilter === tab.key
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
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

      {/* User List */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {users?.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-5 py-3">
              <div
                className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-medium text-primary-700 overflow-hidden', u.avatar && 'cursor-pointer hover:ring-2 hover:ring-primary-300 transition')}
                onClick={() => u.avatar && useImagePreviewStore.getState().open(u.avatar, u.name)}
              >
                {u.avatar ? (
                  <img src={u.avatar} alt={u.name} className="h-full w-full object-cover" />
                ) : (
                  u.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{u.name}</span>
                  {u.isSuperuser && (
                    <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600">
                      SUPER
                    </span>
                  )}
                </div>
                <div className="truncate text-xs text-gray-500 dark:text-gray-400">{u.email}</div>
              </div>
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', statusBadge(u.status))}>
                {u.status}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {new Date(u.createdAt).toLocaleDateString()}
              </span>

              {/* Actions */}
              <div className="flex items-center gap-1">
                {u.status === 'PENDING' && (
                  <>
                    <button
                      onClick={() => approveUser.mutate(u.id)}
                      className="rounded-md bg-green-50 p-1.5 text-green-600 hover:bg-green-100"
                      title="Approve"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => rejectUser.mutate(u.id)}
                      className="rounded-md bg-red-50 p-1.5 text-red-600 hover:bg-red-100"
                      title="Reject"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
                {u.status === 'ACTIVE' && u.id !== currentUser.id && (
                  <button
                    onClick={() => suspendUser.mutate(u.id)}
                    className="rounded-md bg-gray-50 dark:bg-gray-900 p-1.5 text-gray-500 dark:text-gray-400 hover:bg-amber-50 hover:text-amber-600"
                    title="Suspend"
                  >
                    <UserX className="h-3.5 w-3.5" />
                  </button>
                )}
                {u.status === 'REJECTED' && (
                  <button
                    onClick={() => activateUser.mutate(u.id)}
                    className="rounded-md bg-gray-50 dark:bg-gray-900 p-1.5 text-gray-500 dark:text-gray-400 hover:bg-green-50 hover:text-green-600"
                    title="Activate"
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => startEdit(u)}
                  className="rounded-md bg-gray-50 dark:bg-gray-900 p-1.5 text-gray-500 dark:text-gray-400 hover:bg-primary-50 hover:text-primary-600"
                  title="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => { setResetPasswordUser(u); setNewPassword('') }}
                  className="rounded-md bg-gray-50 dark:bg-gray-900 p-1.5 text-gray-500 dark:text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                  title="Reset Password"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                </button>
                {u.id !== currentUser.id && (
                  <button
                    onClick={() => {
                      if (confirm(`Delete user "${u.name}"? This is a soft delete.`)) {
                        deleteUser.mutate(u.id)
                      }
                    }}
                    className="rounded-md bg-gray-50 dark:bg-gray-900 p-1.5 text-gray-500 dark:text-gray-400 hover:bg-red-50 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
          {users?.length === 0 && (
            <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">No users found</div>
          )}
        </div>
      </section>

      {/* Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEditingUser(null)}>
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-gray-800 p-6 shadow-xl dark:shadow-gray-900/50" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Edit User</h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Name</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Email</label>
                <input
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={editSuperuser}
                  onChange={(e) => setEditSuperuser(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                Superuser
                {editSuperuser ? (
                  <ShieldCheck className="h-4 w-4 text-indigo-500" />
                ) : (
                  <ShieldOff className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                )}
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setEditingUser(null)}
                className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:bg-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={() => updateUser.mutate()}
                disabled={!editName || !editEmail || updateUser.isPending}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {updateUser.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetPasswordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setResetPasswordUser(null)}>
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-gray-800 p-6 shadow-xl dark:shadow-gray-900/50" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
              Reset Password for {resetPasswordUser.name}
            </h2>
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
              <button
                onClick={() => setResetPasswordUser(null)}
                className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:bg-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={() => resetPassword.mutate()}
                disabled={newPassword.length < 8 || resetPassword.isPending}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {resetPassword.isPending ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
