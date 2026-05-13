import { useNavigate } from 'react-router-dom'
import type { ProjectSummary } from '@/features/dashboard/api'

export default function ProjectSummaryCards({ projects }: { projects: ProjectSummary[] }) {
  const navigate = useNavigate()
  if (projects.length === 0) return null

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Projects</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => {
          const completion = p.totalIssues ? Math.round((p.doneIssues / p.totalIssues) * 100) : 0
          return (
            <div
              key={p.id}
              onClick={() => navigate(`/projects/${p.key}`)}
              className="cursor-pointer rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 transition hover:border-primary-300 hover:shadow-sm"
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded bg-primary-50 px-2 py-0.5 text-xs font-bold text-primary-700">{p.key}</span>
                <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{p.name}</span>
              </div>
              <div className="mb-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>{p.totalIssues} issues</span>
                <span>{completion}% done</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700">
                <div className="h-1.5 rounded-full bg-green-500 transition-all" style={{ width: `${completion}%` }} />
              </div>
              {p.myIssueCount > 0 && (
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className="font-medium text-gray-700 dark:text-gray-300">{p.myIssueCount}</span> assigned to you
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
