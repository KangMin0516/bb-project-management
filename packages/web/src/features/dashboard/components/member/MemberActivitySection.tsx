import { useState } from 'react'
import { Activity, ChevronDown, ChevronRight } from 'lucide-react'
import type { MemberDetailResponse } from '@/features/dashboard/api'
import { formatDateLabel, formatFieldChange } from '@/features/dashboard/lib/activityFormat'

interface MemberActivitySectionProps {
  activityLog: MemberDetailResponse['activityLog']
}

export default function MemberActivitySection({ activityLog }: MemberActivitySectionProps) {
  const [open, setOpen] = useState(true)
  if (activityLog.length === 0) return null

  return (
    <div className="mt-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-4 py-3 text-left">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary-600" />
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Recent Activity</span>
          <span className="rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
            7 days
          </span>
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
      </button>
      {open && (
        <div className="border-t border-gray-100 dark:border-gray-700">
          {activityLog.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-400">No recent activity</p>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {activityLog.map(({ date, entries }) => (
                <div key={date} className="px-4 py-3">
                  <div className="mb-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
                    {formatDateLabel(date)}
                    <span className="ml-1.5 text-gray-400 dark:text-gray-500 font-normal">({entries.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {entries.map((entry, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <span className="shrink-0 font-mono text-primary-600 dark:text-primary-400">
                          {entry.projectKey}-{entry.issueNumber}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="text-gray-700 dark:text-gray-300">
                            {formatFieldChange(entry.field, entry.oldValue, entry.newValue)}
                          </span>
                          <span className="ml-1.5 text-gray-400 dark:text-gray-500 truncate">{entry.issueTitle}</span>
                        </span>
                        <span className="shrink-0 text-[10px] text-gray-400">
                          {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
