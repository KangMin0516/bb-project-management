import { cn } from '@/shared/lib/utils'

const STATUS_CLASS: Record<string, string> = {
  ACTIVE: 'bg-green-50 text-green-700',
  PENDING: 'bg-amber-50 text-amber-700',
  REJECTED: 'bg-red-50 text-red-700',
}

export default function UserStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', STATUS_CLASS[status] || 'bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300')}>
      {status}
    </span>
  )
}
