import type { MemberDetailResponse } from '@/features/dashboard/api'
import { cn } from '@/shared/lib/utils'

interface MemberStatsRowProps {
  todayStats: MemberDetailResponse['todayStats']
}

interface StatCardData {
  label: string
  value: number
  icon: string
  color: string
  bg: string
}

export default function MemberStatsRow({ todayStats }: MemberStatsRowProps) {
  const overdueZero = todayStats.overdueCount === 0
  const cards: StatCardData[] = [
    { label: 'Focus', value: todayStats.focusCount, icon: '🎯', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    { label: 'Todo', value: todayStats.todoCount, icon: '📋', color: 'text-blue-500 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: 'In Progress', value: todayStats.inProgressCount, icon: '🔄', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: 'Done Today', value: todayStats.completedCount, icon: '✅', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
    {
      label: 'Overdue', value: todayStats.overdueCount, icon: '⚠️',
      color: overdueZero ? 'text-gray-400' : 'text-red-600 dark:text-red-400',
      bg: overdueZero ? 'bg-gray-50 dark:bg-gray-800' : 'bg-red-50 dark:bg-red-900/20',
    },
  ]

  return (
    <div className="mb-6 grid grid-cols-5 gap-3">
      {cards.map((c) => (
        <div key={c.label} className={cn('rounded-xl border border-gray-200 dark:border-gray-700 p-3 text-center', c.bg)}>
          <div className="text-sm">{c.icon}</div>
          <div className={cn('text-xl font-bold', c.color)}>{c.value}</div>
          <div className="text-[10px] text-gray-500 dark:text-gray-400">{c.label}</div>
        </div>
      ))}
    </div>
  )
}
