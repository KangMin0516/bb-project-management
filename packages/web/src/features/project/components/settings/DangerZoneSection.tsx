import { confirmDialog } from '@/shared/ui/confirm-dialog'

interface DangerZoneSectionProps {
  onDelete: () => void
  /** Open issue count, shown in the archive confirm to set expectations. */
  openIssueCount?: number
  /** When supplied (superuser only), renders the Archive action above Delete. */
  onArchive?: () => void
}

export default function DangerZoneSection({
  onDelete,
  openIssueCount,
  onArchive,
}: DangerZoneSectionProps) {
  const confirmDelete = async () => {
    if (await confirmDialog({
      title: 'Are you sure you want to delete this project?',
      description: 'This cannot be undone.',
      confirmLabel: 'Delete Project',
      destructive: true,
    })) {
      onDelete()
    }
  }

  const confirmArchive = async () => {
    if (!onArchive) return
    const issueLine =
      typeof openIssueCount === 'number' && openIssueCount > 0
        ? ` ${openIssueCount} issue${openIssueCount === 1 ? '' : 's'} will be archived along with the project.`
        : ''
    if (
      await confirmDialog({
        title: 'Archive this project?',
        description: `Members will lose access until a superuser unarchives it.${issueLine}`,
        confirmLabel: 'Archive',
      })
    ) {
      onArchive()
    }
  }

  return (
    <section className="rounded-xl border border-red-200 bg-white dark:bg-gray-800 p-5">
      <h2 className="mb-2 text-sm font-semibold text-red-600">Danger Zone</h2>
      {onArchive && (
        <div className="mb-4 border-b border-gray-100 dark:border-gray-700 pb-4">
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
            Archive hides the project from every member, dashboard and search result.
            Superusers can unarchive it later from the Archived tab on the Projects page.
          </p>
          <button
            onClick={confirmArchive}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            Archive Project
          </button>
        </div>
      )}
      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">Deleting a project is irreversible.</p>
      <button
        onClick={confirmDelete}
        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
      >
        Delete Project
      </button>
    </section>
  )
}
