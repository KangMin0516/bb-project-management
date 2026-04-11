import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STATUS_COLORS, PRIORITY_COLORS } from '@/lib/constants'
import type { OverdueIssue } from '@/api/dashboard'
import InfoTooltip from '@/components/ui/InfoTooltip'

interface Props {
  issues: OverdueIssue[]
  projectKey: string
  projectId: string
  onIssueClick: (issueId: string) => void
}

function daysOverdue(dueDate: string): number {
  const due = new Date(dueDate)
  const now = new Date()
  now.setUTCHours(0, 0, 0, 0)
  due.setUTCHours(0, 0, 0, 0)
  return Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
}

export default function OverdueAlert({ issues, projectKey, onIssueClick }: Props) {
  if (issues.length === 0) return null

  return (
    <div className="rounded-xl border border-red-200 bg-red-50/50 p-5">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-red-500" />
        <h2 className="text-sm font-semibold text-red-800">
          Overdue Issues
        </h2>
        <InfoTooltip
          iconClassName="text-red-400 hover:bg-red-100 hover:text-red-600"
          lines={[
            { lang: 'EN', text: 'Issues past their due date that are still open. These need immediate attention.' },
            { lang: 'KR', text: '마감일이 지났지만 아직 완료되지 않은 이슈입니다. 우선 처리가 필요합니다.' },
            { lang: 'VN', text: 'Các issue đã quá hạn nhưng chưa hoàn thành. Cần xử lý ngay.' },
          ]}
        />
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
          {issues.length}
        </span>
      </div>

      {/* Issue list */}
      <div className="space-y-1.5">
        {issues.map((issue) => {
          const days = daysOverdue(issue.dueDate)
          return (
            <div
              key={issue.id}
              onClick={() => onIssueClick(issue.id)}
              className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-red-100/50"
            >
              <span className="font-mono text-xs text-red-400">
                {projectKey}-{issue.number}
              </span>
              <span className="flex-1 truncate text-sm font-medium text-red-900">
                {issue.title}
              </span>
              {issue.assignee && (
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-[9px] font-medium text-red-700">
                  {issue.assignee.name?.charAt(0).toUpperCase() || '?'}
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <div className={cn('h-2 w-2 rounded-full', STATUS_COLORS[issue.status])} />
                <span className="text-xs text-red-600">{issue.status.replace(/_/g, ' ')}</span>
              </div>
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 text-[10px] font-medium',
                  PRIORITY_COLORS[issue.priority],
                )}
              >
                {issue.priority}
              </span>
              <span className="shrink-0 text-xs font-medium text-red-600">
                {days}d overdue
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
