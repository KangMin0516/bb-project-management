import { Zap, Clock } from 'lucide-react'
import type { GlobalIssue } from '@/features/dashboard/api'
import GlobalIssueRow from './GlobalIssueRow'

interface GlobalFocusPanelProps {
  workingNow: GlobalIssue[]
  plannedToday: GlobalIssue[]
  onToggleFocus: (issue: GlobalIssue) => void
  onIssueClick: (issue: GlobalIssue) => void
}

export default function GlobalFocusPanel({ workingNow, plannedToday, onToggleFocus, onIssueClick }: GlobalFocusPanelProps) {
  const total = workingNow.length + plannedToday.length

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Zap className="h-4 w-4 text-amber-500" />
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Today's Focus</h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">{total}</span>
      </div>

      {total === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400 dark:text-gray-500">
          Click the star on any issue below to add it to today's focus
        </p>
      ) : (
        <div className="space-y-3">
          {workingNow.length > 0 && (
            <Group
              label="Working Now"
              indicator={<div className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />}
              labelClass="text-xs font-medium text-blue-700"
              issues={workingNow}
              onToggleFocus={onToggleFocus}
              onIssueClick={onIssueClick}
            />
          )}
          {plannedToday.length > 0 && (
            <Group
              label="Planned Today"
              indicator={<Clock className="h-3 w-3 text-gray-400 dark:text-gray-500" />}
              labelClass="text-xs font-medium text-gray-500 dark:text-gray-400"
              issues={plannedToday}
              onToggleFocus={onToggleFocus}
              onIssueClick={onIssueClick}
            />
          )}
        </div>
      )}
    </div>
  )
}

function Group({
  label,
  indicator,
  labelClass,
  issues,
  onToggleFocus,
  onIssueClick,
}: {
  label: string
  indicator: React.ReactNode
  labelClass: string
  issues: GlobalIssue[]
  onToggleFocus: (issue: GlobalIssue) => void
  onIssueClick: (issue: GlobalIssue) => void
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5">
        {indicator}
        <span className={labelClass}>{label}</span>
      </div>
      <div className="space-y-1">
        {issues.map((issue) => (
          <GlobalIssueRow
            key={issue.id}
            issue={issue}
            focused
            onToggleFocus={onToggleFocus}
            onClick={() => onIssueClick(issue)}
          />
        ))}
      </div>
    </div>
  )
}
