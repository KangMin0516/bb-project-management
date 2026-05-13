import type { StandupReportEntry } from '@/features/dashboard/api'

interface StandupAnswersProps {
  reports: StandupReportEntry[]
}

/** Expanded standup Q&A — only renders ANSWERED reports with at least one answer. */
export default function StandupAnswers({ reports }: StandupAnswersProps) {
  const visible = reports.filter((r) => r.status === 'ANSWERED' && r.answers.length > 0)

  return (
    <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-3">
      <div className="ml-14 space-y-3">
        {visible.map((r) => (
          <div key={r.configName}>
            {visible.length > 1 && (
              <div className="mb-1 text-[10px] font-medium text-gray-400 dark:text-gray-500">{r.configName}</div>
            )}
            <div className="space-y-2">
              {r.answers.map((a, idx) => (
                <div key={idx} className="text-xs">
                  <div className="font-medium text-gray-500 dark:text-gray-400">{a.question}</div>
                  <div className="mt-0.5 text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{a.answer}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
