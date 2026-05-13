import { useNavigate } from 'react-router-dom'
import { Users, CheckCircle2, AlertTriangle, Inbox } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import Tooltip from './Tooltip'

interface KpiCardData {
  icon: React.ReactNode
  label: string
  tooltip: string
  value: number
  bg: string
  href?: string
}

interface TeamKpiCardsProps {
  activeMembers: number
  completedToday: number
  overdueTotal: number
  unassignedTotal: number
}

export default function TeamKpiCards({ activeMembers, completedToday, overdueTotal, unassignedTotal }: TeamKpiCardsProps) {
  const cards: KpiCardData[] = [
    { icon: <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />, label: 'Active Members', tooltip: '현재 활성(ACTIVE) 상태인 전체 팀원 수', value: activeMembers, bg: 'bg-blue-50 dark:bg-blue-900/30' },
    { icon: <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />, label: 'Completed Today', tooltip: '오늘 DONE으로 변경된 이슈 총 수', value: completedToday, bg: 'bg-green-50 dark:bg-green-900/30', href: '/admin/issues?filter=completed_today' },
    { icon: <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />, label: 'Overdue', tooltip: '기한이 지난 미완료 이슈 총 수', value: overdueTotal, bg: 'bg-red-50 dark:bg-red-900/30', href: '/admin/issues?filter=overdue' },
    { icon: <Inbox className="h-5 w-5 text-gray-600 dark:text-gray-400" />, label: 'Unassigned', tooltip: '담당자가 없는 미완료 이슈 총 수', value: unassignedTotal, bg: 'bg-gray-100 dark:bg-gray-700', href: '/admin/issues?filter=unassigned' },
  ]

  return (
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((c) => <KpiCard key={c.label} {...c} />)}
    </div>
  )
}

function KpiCard({ icon, label, tooltip, value, bg, href }: KpiCardData) {
  const navigate = useNavigate()
  return (
    <Tooltip text={tooltip}>
      <div
        onClick={href ? () => navigate(href) : undefined}
        className={cn(
          'rounded-xl border border-gray-200 dark:border-gray-700 p-4 w-full',
          bg,
          href && 'cursor-pointer hover:ring-2 hover:ring-primary-400/50 transition',
        )}
      >
        <div className="mb-2">{icon}</div>
        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      </div>
    </Tooltip>
  )
}
