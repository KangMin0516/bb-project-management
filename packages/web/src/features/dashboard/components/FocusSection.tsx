import { Zap, Clock } from 'lucide-react'
import type { Issue } from '@/features/issue/api'
import InfoTooltip from '@/shared/ui/atoms/InfoTooltip'
import MyIssueRow from './MyIssueRow'

interface FocusSectionProps {
  workingNow: Issue[]
  plannedToday: Issue[]
  projectKey: string
  onIssueClick: (issue: Issue) => void
  onToggleFocus: (issue: Issue) => void
}

export default function FocusSection({ workingNow, plannedToday, projectKey, onIssueClick, onToggleFocus }: FocusSectionProps) {
  const total = workingNow.length + plannedToday.length

  return (
    <div className="mb-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Zap className="h-4 w-4 text-amber-500" />
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Today's Focus</h2>
        <InfoTooltip lines={[
          { lang: 'EN', text: "Issues you plan to focus on today. Click the star (★) to add. 'Working Now' = in progress, 'Planned Today' = queued." },
          { lang: 'KR', text: '오늘 집중할 이슈 모음입니다. 별(★)을 클릭하여 추가합니다. Working Now=진행 중, Planned Today=오늘 예정.' },
          { lang: 'VN', text: "Các issue tập trung hôm nay. Nhấn ngôi sao (★) để thêm. 'Working Now' = đang làm, 'Planned Today' = dự kiến hôm nay." },
        ]} />
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
              iconClass="h-2 w-2 animate-pulse rounded-full bg-blue-500"
              labelClass="text-xs font-medium text-blue-700"
              issues={workingNow}
              projectKey={projectKey}
              onIssueClick={onIssueClick}
              onToggleFocus={onToggleFocus}
            />
          )}
          {plannedToday.length > 0 && (
            <div>
              <div className="mb-1.5 flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-gray-400 dark:text-gray-500" />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Planned Today</span>
              </div>
              <div className="space-y-1">
                {plannedToday.map((issue) => (
                  <MyIssueRow
                    key={issue.id}
                    issue={issue}
                    projectKey={projectKey}
                    focused
                    onToggleFocus={onToggleFocus}
                    onClick={() => onIssueClick(issue)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Group({
  label,
  iconClass,
  labelClass,
  issues,
  projectKey,
  onIssueClick,
  onToggleFocus,
}: {
  label: string
  iconClass: string
  labelClass: string
  issues: Issue[]
  projectKey: string
  onIssueClick: (issue: Issue) => void
  onToggleFocus: (issue: Issue) => void
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5">
        <div className={iconClass} />
        <span className={labelClass}>{label}</span>
      </div>
      <div className="space-y-1">
        {issues.map((issue) => (
          <MyIssueRow
            key={issue.id}
            issue={issue}
            projectKey={projectKey}
            focused
            onToggleFocus={onToggleFocus}
            onClick={() => onIssueClick(issue)}
          />
        ))}
      </div>
    </div>
  )
}
