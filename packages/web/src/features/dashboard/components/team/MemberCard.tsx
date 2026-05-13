import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight, MessageSquare } from 'lucide-react'
import type { TeamMember, StandupReportEntry } from '@/features/dashboard/api'
import { STANDUP_STATUS_CONFIG, getBestStandupStatus } from '@/shared/config/constants'
import { cn } from '@/shared/lib/utils'
import { getMemberStatus, STATUS_CONFIG, type StatusIndicator } from '@/features/dashboard/lib/teamStatus'
import Tooltip from './Tooltip'
import MemberCardStats from './MemberCardStats'
import StandupAnswers from './StandupAnswers'

interface MemberCardProps {
  member: TeamMember
  standupReports?: StandupReportEntry[]
}

const STATUS_PILL_CLASS: Record<StatusIndicator, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  light: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  idle: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  overloaded: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
}

export default function MemberCard({ member, standupReports }: MemberCardProps) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)

  const status = getMemberStatus(member)
  const config = STATUS_CONFIG[status]
  const { today, overall } = member

  const completionRate = overall.totalHistorical > 0
    ? Math.round((overall.doneHistorical / overall.totalHistorical) * 100)
    : 0

  const standupStatus = useMemo(() => {
    if (!standupReports || standupReports.length === 0) return null
    return getBestStandupStatus(standupReports.map((r) => r.status))
  }, [standupReports])

  const standupCfg = standupStatus ? STANDUP_STATUS_CONFIG[standupStatus] : null
  const hasAnswers = standupReports?.some((r) => r.status === 'ANSWERED' && r.answers.length > 0)

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 transition">
      <div
        onClick={() => navigate(`/admin/members/${member.user.id}`)}
        className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition cursor-pointer"
      >
        <Tooltip text={config.tooltip}>
          <div className="relative shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/40 text-sm font-medium text-primary-700 dark:text-primary-300 overflow-hidden">
              {member.user.avatar
                ? <img src={member.user.avatar} alt={member.user.name} className="h-full w-full object-cover" />
                : member.user.name.charAt(0).toUpperCase()}
            </div>
            <span className={cn('absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-gray-800', config.dot)} />
          </div>
        </Tooltip>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{member.user.name}</span>
            <Tooltip text={config.tooltip}>
              <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', STATUS_PILL_CLASS[status])}>
                {config.label}
              </span>
            </Tooltip>
            {standupCfg && hasAnswers ? (
              <button
                onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
                className={cn('flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium cursor-pointer hover:opacity-80', standupCfg.bgColor, standupCfg.color)}
              >
                <MessageSquare className="h-2.5 w-2.5" />
                {standupCfg.label}
                {expanded ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
              </button>
            ) : standupCfg ? (
              <span className={cn('flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium', standupCfg.bgColor, standupCfg.color)}>
                <MessageSquare className="h-2.5 w-2.5" />
                {standupCfg.label}
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-1">
            {member.projects.length > 0 ? (
              member.projects.map((p) => (
                <span key={p.id} className="rounded bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400">
                  {p.key} <span className="text-gray-400 dark:text-gray-500">{p.role}</span>
                </span>
              ))
            ) : (
              <span className="text-[10px] text-gray-400 dark:text-gray-500 italic">no projects</span>
            )}
          </div>
        </div>

        <MemberCardStats today={today} />

        <Tooltip text={`활성 이슈 ${overall.totalActive}개 / 전체 ${overall.totalHistorical}개 중 ${overall.doneHistorical}개 완료 (${completionRate}%)`}>
          <div className="w-24 shrink-0">
            <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 mb-1">
              <span>{overall.totalActive} active</span>
              <span>{completionRate}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700">
              <div className="h-1.5 rounded-full bg-green-500 transition-all" style={{ width: `${completionRate}%` }} />
            </div>
          </div>
        </Tooltip>
      </div>

      {expanded && hasAnswers && standupReports && <StandupAnswers reports={standupReports} />}
    </div>
  )
}
