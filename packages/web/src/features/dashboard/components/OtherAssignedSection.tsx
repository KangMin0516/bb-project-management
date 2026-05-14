import { useMemo, useState } from 'react'
import type { Issue } from '@/features/issue/api'
import { PRIORITY_ORDER } from '@/shared/config/constants'
import { cn } from '@/shared/lib/utils'
import MyIssueRow from './MyIssueRow'

type SortMode = 'dueDate' | 'priority'

interface OtherAssignedSectionProps {
  issues: Issue[]
  projectKey: string
  onIssueClick: (issue: Issue) => void
  onToggleFocus: (issue: Issue) => void
}

const SORT_MODES: ReadonlyArray<[SortMode, string]> = [
  ['dueDate', 'Due Date'],
  ['priority', 'Priority'],
]

export default function OtherAssignedSection({ issues, projectKey, onIssueClick, onToggleFocus }: OtherAssignedSectionProps) {
  const [sortMode, setSortMode] = useState<SortMode>('dueDate')

  const sorted = useMemo(() => {
    if (issues.length === 0) return []
    if (sortMode !== 'priority') return issues
    return [...issues].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9))
  }, [issues, sortMode])

  if (sorted.length === 0) return null

  return (
    <div className="mb-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Other Assigned ({sorted.length})</h2>
        <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-gray-700 p-0.5">
          {SORT_MODES.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSortMode(key)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition',
                sortMode === key
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1">
        {sorted.map((issue) => (
          <MyIssueRow
            key={issue.id}
            issue={issue}
            projectKey={projectKey}
            focused={false}
            onToggleFocus={onToggleFocus}
            onClick={() => onIssueClick(issue)}
          />
        ))}
      </div>
    </div>
  )
}
