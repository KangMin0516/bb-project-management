import { useState } from 'react'
import { ChevronDown, ChevronRight, MessageSquare } from 'lucide-react'
import { STANDUP_STATUS_CONFIG, getBestStandupStatus } from '@/shared/config/constants'
import { cn } from '@/shared/lib/utils'
import type { MemberDetailResponse } from '@/features/dashboard/api'

interface MemberStandupSectionProps {
  standup: MemberDetailResponse['standup']
}

export default function MemberStandupSection({ standup }: MemberStandupSectionProps) {
  const [open, setOpen] = useState(true)
  if (standup.length === 0) return null

  const bestStatus = getBestStandupStatus(standup.map((r) => r.status))
  const statusCfg = STANDUP_STATUS_CONFIG[bestStatus] ?? STANDUP_STATUS_CONFIG.UNANSWERED
  const answered = standup.filter((r) => r.status === 'ANSWERED' && r.answers.length > 0)

  return (
    <div className="mb-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-4 py-3 text-left">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary-600" />
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Today's Standup</span>
          <span className={cn('text-[11px] font-medium', statusCfg.color)}>{statusCfg.label}</span>
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
      </button>
      {open && (
        <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-3">
          {answered.length === 0 ? (
            <p className="text-sm text-gray-400">No answers yet</p>
          ) : (
            <div className="space-y-4">
              {answered.map((r) => (
                <div key={r.configName}>
                  {standup.length > 1 && (
                    <div className="mb-1.5 text-[10px] font-medium text-gray-400 dark:text-gray-500">{r.configName}</div>
                  )}
                  <div className="space-y-2">
                    {r.answers.map((a, i) => (
                      <div key={i} className="text-xs">
                        <div className="font-medium text-gray-500 dark:text-gray-400">{a.question}</div>
                        <div className="mt-0.5 text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{a.answer}</div>
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
