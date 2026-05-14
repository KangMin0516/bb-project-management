import { Check, X, UserX, UserCheck, Pencil, KeyRound, Trash2 } from 'lucide-react'
import type { AdminUser } from '@/entities/user/api'

interface UserActionsProps {
  user: AdminUser
  isSelf: boolean
  onApprove: () => void
  onReject: () => void
  onSuspend: () => void
  onActivate: () => void
  onEdit: () => void
  onResetPassword: () => void
  onDelete: () => void
}

/**
 * Strategy-driven action button row. Visible buttons depend on the user's
 * status (PENDING shows approve/reject; ACTIVE shows suspend; etc.) and
 * never show destructive actions against the current user.
 */
export default function UserActions(props: UserActionsProps) {
  const { user, isSelf } = props

  return (
    <div className="flex items-center gap-1">
      {user.status === 'PENDING' && (
        <>
          <IconButton onClick={props.onApprove} title="Approve" tone="green">
            <Check className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton onClick={props.onReject} title="Reject" tone="red">
            <X className="h-3.5 w-3.5" />
          </IconButton>
        </>
      )}
      {user.status === 'ACTIVE' && !isSelf && (
        <IconButton onClick={props.onSuspend} title="Suspend" tone="amber">
          <UserX className="h-3.5 w-3.5" />
        </IconButton>
      )}
      {user.status === 'REJECTED' && (
        <IconButton onClick={props.onActivate} title="Activate" tone="green-soft">
          <UserCheck className="h-3.5 w-3.5" />
        </IconButton>
      )}
      <IconButton onClick={props.onEdit} title="Edit" tone="primary">
        <Pencil className="h-3.5 w-3.5" />
      </IconButton>
      <IconButton onClick={props.onResetPassword} title="Reset Password" tone="blue">
        <KeyRound className="h-3.5 w-3.5" />
      </IconButton>
      {!isSelf && (
        <IconButton onClick={props.onDelete} title="Delete" tone="red-soft">
          <Trash2 className="h-3.5 w-3.5" />
        </IconButton>
      )}
    </div>
  )
}

const TONE_CLASS = {
  green: 'bg-green-50 text-green-600 hover:bg-green-100',
  red: 'bg-red-50 text-red-600 hover:bg-red-100',
  amber: 'bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-amber-50 hover:text-amber-600',
  primary: 'bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-primary-50 hover:text-primary-600',
  blue: 'bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-blue-50 hover:text-blue-600',
  'green-soft': 'bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-green-50 hover:text-green-600',
  'red-soft': 'bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-red-50 hover:text-red-600',
} as const

function IconButton({ onClick, title, tone, children }: { onClick: () => void; title: string; tone: keyof typeof TONE_CLASS; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title} className={`rounded-md p-1.5 ${TONE_CLASS[tone]}`}>
      {children}
    </button>
  )
}
