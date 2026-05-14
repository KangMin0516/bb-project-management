import { confirmDialog } from '@/shared/ui/confirm-dialog'

interface DangerZoneSectionProps {
  onDelete: () => void
}

export default function DangerZoneSection({ onDelete }: DangerZoneSectionProps) {
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

  return (
    <section className="rounded-xl border border-red-200 bg-white dark:bg-gray-800 p-5">
      <h2 className="mb-2 text-sm font-semibold text-red-600">Danger Zone</h2>
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
