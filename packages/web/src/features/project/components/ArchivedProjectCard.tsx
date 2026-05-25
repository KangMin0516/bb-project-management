import { Archive, TicketCheck } from 'lucide-react'
import { useUnarchiveProject } from '@/features/project/hooks/useArchiveProject'
import { confirmDialog } from '@/shared/ui/confirm-dialog'
import type { ArchivedProject } from '@/features/project/api'

interface ArchivedProjectCardProps {
  project: ArchivedProject
}

/**
 * Card shown under the Projects > Archived tab. Superuser-only.
 * Clicking the body is intentionally inert — to enter the project, the
 * user must unarchive first. The Unarchive button confirms before
 * restoring so a mis-click can't undo someone else's archive.
 */
export default function ArchivedProjectCard({ project }: ArchivedProjectCardProps) {
  const unarchive = useUnarchiveProject(project.id)

  const handleUnarchive = async () => {
    const ok = await confirmDialog({
      title: `Unarchive "${project.name}"?`,
      description:
        'The project will reappear in every member list, dashboard and search result.',
      confirmLabel: 'Unarchive',
    })
    if (ok) unarchive.mutate()
  }

  const archivedAtLabel = new Date(project.archivedAt).toLocaleDateString()

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-5 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-200 dark:bg-gray-700 px-2 py-0.5 font-medium text-gray-600 dark:text-gray-300">
          <Archive className="h-3 w-3" />
          Archived
        </span>
        <span className="text-gray-400 dark:text-gray-500">
          {archivedAtLabel}
          {project.archivedBy ? ` · by ${project.archivedBy.name}` : ''}
        </span>
      </div>
      <div className="mb-1 font-mono text-xs text-gray-400 dark:text-gray-500">{project.key}</div>
      <div className="mb-2 text-lg font-semibold text-gray-700 dark:text-gray-300">{project.name}</div>
      {project.description && (
        <p className="mb-3 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{project.description}</p>
      )}
      <div className="mb-4 flex gap-4 text-xs text-gray-400 dark:text-gray-500">
        <span className="flex items-center gap-1">
          <TicketCheck className="h-3.5 w-3.5" /> {project.issueCount.total} issues
          <span className="text-gray-400 dark:text-gray-500">
            ({project.issueCount.done} done)
          </span>
        </span>
      </div>
      <button
        type="button"
        onClick={handleUnarchive}
        disabled={unarchive.isPending}
        className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
      >
        {unarchive.isPending ? 'Unarchiving…' : 'Unarchive'}
      </button>
    </div>
  )
}
