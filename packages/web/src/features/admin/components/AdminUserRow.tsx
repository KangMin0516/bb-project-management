import type { AdminUser } from '@/entities/user/api'
import { useImagePreviewStore } from '@/shared/lib/imagePreview'
import { cn } from '@/shared/lib/utils'
import { confirmDialog } from '@/shared/ui/confirm-dialog'
import UserStatusBadge from './UserStatusBadge'
import UserActions from './UserActions'

interface AdminUserRowProps {
  user: AdminUser
  currentUserId: string
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onSuspend: (id: string) => void
  onActivate: (id: string) => void
  onEdit: (u: AdminUser) => void
  onResetPassword: (u: AdminUser) => void
  onDelete: (id: string) => void
}

export default function AdminUserRow({ user, currentUserId, ...handlers }: AdminUserRowProps) {
  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <Avatar user={user} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{user.name}</span>
          {user.isSuperuser && (
            <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600">SUPER</span>
          )}
        </div>
        <div className="truncate text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
      </div>
      <UserStatusBadge status={user.status} />
      <span className="text-xs text-gray-400 dark:text-gray-500">{new Date(user.createdAt).toLocaleDateString()}</span>
      <UserActions
        user={user}
        isSelf={user.id === currentUserId}
        onApprove={() => handlers.onApprove(user.id)}
        onReject={() => handlers.onReject(user.id)}
        onSuspend={() => handlers.onSuspend(user.id)}
        onActivate={() => handlers.onActivate(user.id)}
        onEdit={() => handlers.onEdit(user)}
        onResetPassword={() => handlers.onResetPassword(user)}
        onDelete={async () => {
          if (await confirmDialog({
            title: `Delete user "${user.name}"?`,
            description: 'This is a soft delete.',
            confirmLabel: 'Delete',
            destructive: true,
          })) handlers.onDelete(user.id)
        }}
      />
    </div>
  )
}

function Avatar({ user }: { user: AdminUser }) {
  const open = () => user.avatar && useImagePreviewStore.getState().open(user.avatar, user.name)
  return (
    <button
      onClick={open}
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-medium text-primary-700 overflow-hidden',
        user.avatar && 'cursor-pointer hover:ring-2 hover:ring-primary-300 transition',
      )}
      type="button"
    >
      {user.avatar
        ? <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
        : user.name.charAt(0).toUpperCase()}
    </button>
  )
}
