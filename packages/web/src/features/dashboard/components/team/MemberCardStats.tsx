import type { TeamMember } from '@/features/dashboard/api'
import { cn } from '@/shared/lib/utils'
import Tooltip from './Tooltip'

interface MemberCardStatsProps {
  today: TeamMember['today']
}

interface StatDef {
  label: string
  tooltip: string
  value: number
  color: string
  icon: string
}

export default function MemberCardStats({ today }: MemberCardStatsProps) {
  const stats: StatDef[] = [
    { label: 'Focus', tooltip: '오늘 포커스로 설정된 이슈 수', value: today.focusCount, color: 'text-amber-600 dark:text-amber-400', icon: '🎯' },
    { label: 'Todo', tooltip: '할 일(TODO) 상태인 이슈 수', value: today.todoCount, color: 'text-blue-400 dark:text-blue-300', icon: '📋' },
    { label: 'Progress', tooltip: '현재 진행 중(IN_PROGRESS)인 이슈 수', value: today.inProgressCount, color: 'text-blue-600 dark:text-blue-400', icon: '🔄' },
    { label: 'Done', tooltip: '오늘 완료(DONE)한 이슈 수', value: today.completedCount, color: 'text-green-600 dark:text-green-400', icon: '✅' },
    {
      label: 'Overdue',
      tooltip: '기한이 지난 미완료 이슈 수',
      value: today.overdueCount,
      color: today.overdueCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-500',
      icon: '⚠️',
    },
  ]

  return (
    <div className="flex items-center gap-3 text-xs">
      {stats.map((s) => (
        <Tooltip key={s.label} text={s.tooltip}>
          <div className="flex flex-col items-center min-w-[48px]">
            <span className="text-[10px] text-gray-400 dark:text-gray-500">{s.icon}</span>
            <span className={cn('text-sm font-semibold', s.color)}>{s.value}</span>
            <span className="text-[9px] text-gray-400 dark:text-gray-500 leading-none mt-0.5">{s.label}</span>
          </div>
        </Tooltip>
      ))}
    </div>
  )
}
