import { useMemo, useState } from 'react'
import { FolderKanban } from 'lucide-react'
import { isOverdue, todayDateString, isFocusToday } from '@/shared/lib/time'
import { PRIORITY_ORDER } from '@/shared/config/constants'
import { cn } from '@/shared/lib/utils'
import { useGlobalDashboard } from '@/features/dashboard/hooks/useGlobalDashboard'
import GlobalFocusPanel from '@/features/dashboard/components/GlobalFocusPanel'
import GlobalOverduePanel from '@/features/dashboard/components/GlobalOverduePanel'
import GlobalIssueRow from '@/features/dashboard/components/GlobalIssueRow'
import ProjectSummaryCards from '@/features/dashboard/components/ProjectSummaryCards'
import IssueDetailPanel from '@/features/issue/components/IssueDetailPanel'
import { issueRepository } from '@/features/issue/repository'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'
import type { GlobalIssue, GlobalOverdueIssue } from '@/features/dashboard/api'
import type { Issue } from '@/features/issue/api'

type SortMode = 'dueDate' | 'priority'

/**
 * Personal cross-project dashboard composition root. Buckets, sort, and
 * project filter live as local state; data + mutations come from
 * useGlobalDashboard.
 */
export default function GlobalDashboardPage() {
  const [sortMode, setSortMode] = useState<SortMode>('dueDate')
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [selectedIssue, setSelectedIssue] = useState<{ issue: Issue; projectKey: string; projectId: string } | null>(null)

  const { data, isLoading, toggleFocus } = useGlobalDashboard()

  // Memoise the array fallbacks so dependent useMemos don't re-run every render
  // (a fresh `[]` would mismatch reference equality each time `data` is undefined).
  const focusIssues = useMemo(() => data?.focusIssues ?? [], [data?.focusIssues])
  const myIssues = useMemo(() => data?.myIssues ?? [], [data?.myIssues])
  const overdueIssues = data?.overdueIssues ?? []
  const projects = data?.projects ?? []

  const workingNow = useMemo(() => focusIssues.filter((i) => i.status === 'IN_PROGRESS'), [focusIssues])
  const plannedToday = useMemo(() => focusIssues.filter((i) => i.status !== 'IN_PROGRESS'), [focusIssues])

  const filtered = useMemo(() => {
    const items = projectFilter === 'all' ? myIssues : myIssues.filter((i) => i.project.id === projectFilter)
    if (sortMode !== 'priority') return items
    return [...items].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9))
  }, [myIssues, projectFilter, sortMode])

  const grouped = useMemo(() => {
    const map = new Map<string, { project: GlobalIssue['project']; issues: GlobalIssue[] }>()
    for (const issue of filtered) {
      const key = issue.project.id
      if (!map.has(key)) map.set(key, { project: issue.project, issues: [] })
      map.get(key)!.issues.push(issue)
    }
    return [...map.values()]
  }, [filtered])

  const overdueCount = useMemo(
    () => [...focusIssues, ...myIssues].filter((i) => isOverdue(i.dueDate)).length,
    [focusIssues, myIssues],
  )

  const openIssue = (issue: GlobalIssue) =>
    setSelectedIssue({ issue, projectKey: issue.project.key, projectId: issue.projectId })

  // Overdue rows ship a slim payload — fetch the full Issue before
  // handing it to the detail panel.
  const openOverdueIssue = (overdue: GlobalOverdueIssue) => {
    issueRepository.findOne(overdue.project.id, overdue.id).then(
      (full) => setSelectedIssue({ issue: full, projectKey: overdue.project.key, projectId: overdue.project.id }),
      (err) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to load issue'), 'error'),
    )
  }

  const handleToggleFocus = (issue: GlobalIssue) => {
    const focused = isFocusToday(issue.focusDate)
    toggleFocus.mutate({ projectId: issue.projectId, issueId: issue.id, focusDate: focused ? null : todayDateString() })
  }

  if (isLoading || !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="mb-6 text-xl font-bold text-gray-900 dark:text-gray-100">My Dashboard</h1>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GlobalFocusPanel
          workingNow={workingNow}
          plannedToday={plannedToday}
          onToggleFocus={handleToggleFocus}
          onIssueClick={openIssue}
        />
        <GlobalOverduePanel
          issues={overdueIssues}
          totalOverdueCount={overdueCount}
          onIssueClick={openOverdueIssue}
        />
      </div>

      <div className="mb-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">My Issues ({filtered.length})</h2>
          <div className="flex items-center gap-3">
            <FilterTabs value={projectFilter} onChange={setProjectFilter} options={[{ value: 'all', label: 'All' }, ...projects.map((p) => ({ value: p.id, label: p.key }))]} />
            <FilterTabs<SortMode>
              value={sortMode}
              onChange={setSortMode}
              options={[{ value: 'dueDate', label: 'Due Date' }, { value: 'priority', label: 'Priority' }]}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">No issues assigned to you</p>
        ) : (
          <div className="space-y-4">
            {grouped.map((group) => (
              <div key={group.project.id}>
                <div className="mb-1.5 flex items-center gap-2">
                  <FolderKanban className="h-3 w-3 text-gray-400 dark:text-gray-500" />
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    {group.project.key} — {group.project.name}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">({group.issues.length})</span>
                </div>
                <div className="space-y-1">
                  {group.issues.map((issue) => (
                    <GlobalIssueRow
                      key={issue.id}
                      issue={issue}
                      focused={isFocusToday(issue.focusDate)}
                      onToggleFocus={handleToggleFocus}
                      onClick={() => openIssue(issue)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ProjectSummaryCards projects={projects} />

      {selectedIssue && (
        <IssueDetailPanel
          projectId={selectedIssue.projectId}
          projectKey={selectedIssue.projectKey}
          issue={selectedIssue.issue}
          onClose={() => setSelectedIssue(null)}
          onNavigate={(issue) => setSelectedIssue({ issue, projectKey: selectedIssue.projectKey, projectId: selectedIssue.projectId })}
        />
      )}
    </div>
  )
}

interface FilterTabsProps<T extends string> {
  value: T
  onChange: (next: T) => void
  options: Array<{ value: T; label: string }>
}

function FilterTabs<T extends string>({ value, onChange, options }: FilterTabsProps<T>) {
  return (
    <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-gray-700 p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium transition',
            value === opt.value
              ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
